// Getting a new store's data into Qilbo, the easy way.
// Every approved store gets one private setup link. From it the owner can:
//   1. connect Telegram (one tap) and then just send photos / PDFs / reports to the bot,
//   2. drag and drop files on the setup page (item list, sales reports, invoices, deal sheets),
//   3. or forward emails to the store's own address (needs the StoreInbox Apps Script).
// Files are kept in R2 under stores/<code>/<kind>/... and logged in store_files. Discount Liquor (store 1)
// keeps its own pipeline and never goes through here.
import { dateFromFilename } from './ingest.js';

export const KINDS = {
  items: { label: 'Item list', one: 'item list', many: 'item lists' },
  sales: { label: 'Sales report', one: 'sales report', many: 'sales reports' },
  invoice: { label: 'Invoice', one: 'invoice', many: 'invoices' },
  deals: { label: 'Deal sheet', one: 'deal sheet', many: 'deal sheets' },
  other: { label: 'Other', one: 'file', many: 'files' },
};
export const MAX_BYTES = 25 * 1024 * 1024;
const DAILY_FILE_LIMIT = 400;
const OK_TYPE = /^(application\/pdf|image\/|text\/csv|text\/plain|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/octet-stream)/;
const OK_EXT = /\.(pdf|jpe?g|png|heic|heif|webp|csv|txt|xls|xlsx)$/i;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function newToken() {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const ELIGIBLE = "status IN ('pilot','active') AND id <> 1";

// Make sure a store has its private setup token; returns it.
export async function ensureToken(db, storeId) {
  const row = await db.prepare('SELECT intake_token FROM stores WHERE id=?').bind(Number(storeId)).first();
  if (!row) throw new Error('Store not found');
  if (row.intake_token) return row.intake_token;
  const t = newToken();
  await db.prepare('UPDATE stores SET intake_token=? WHERE id=? AND intake_token IS NULL').bind(t, Number(storeId)).run();
  return (await db.prepare('SELECT intake_token FROM stores WHERE id=?').bind(Number(storeId)).first()).intake_token;
}

export async function storeByToken(db, token) {
  if (!token || !/^[\w-]{16,64}$/.test(token)) return null;
  return db.prepare(`SELECT * FROM stores WHERE intake_token=? AND ${ELIGIBLE}`).bind(token).first();
}
export async function storeByChat(db, chatId) {
  return db.prepare(`SELECT * FROM stores WHERE tg_chat_id=? AND ${ELIGIBLE}`).bind(String(chatId)).first();
}
export async function storeByCode(db, code) {
  return db.prepare(`SELECT * FROM stores WHERE code=? AND ${ELIGIBLE}`).bind(String(code || '').toUpperCase()).first();
}

export function setupUrl(base, token) { return `${String(base).replace(/\/$/, '')}/s/${token}`; }

// Link a Telegram chat to the store that owns this token. One chat per store, one store per chat.
export async function linkChat(db, token, chatId) {
  const st = await storeByToken(db, token);
  if (!st) return null;
  await db.batch([
    db.prepare('UPDATE stores SET tg_chat_id=NULL WHERE tg_chat_id=? AND id<>?').bind(String(chatId), st.id),
    db.prepare("UPDATE stores SET tg_chat_id=?, tg_linked_at=datetime('now') WHERE id=?").bind(String(chatId), st.id),
  ]);
  return { ...st, tg_chat_id: String(chatId), already: st.tg_chat_id === String(chatId) };
}

// Best guess at what a file is, from its name and type. 'other' means ask the owner.
export function guessKind(name = '', mime = '', hint = '') {
  if (KINDS[hint] && hint !== 'other') return hint;
  const n = String(name).toLowerCase();
  if (/deal|promo|price.?book|post.?off|rebate|special/.test(n)) return 'deals';
  if (/invoice|inv[_\s-]?\d|bill|receipt|delivery|statement/.test(n)) return 'invoice';
  if (/sales|daily|z.?report|x.?report|shift|summary|eod|end.?of.?day/.test(n)) return 'sales';
  if (/item|product|inventory|catalog|plu|price.?list|export|stock/.test(n)) return 'items';
  if (/^image\//.test(mime) || /\.(jpe?g|png|heic|heif|webp)$/.test(n)) return 'invoice';
  if (mime === 'application/pdf' || /\.pdf$/.test(n)) return 'invoice';
  return 'other';
}

export function fileAllowed(name = '', mime = '', size = 0) {
  if (!size) return 'That file is empty.';
  if (size > MAX_BYTES) return 'That file is over 25 MB.';
  if (!OK_EXT.test(name) && !OK_TYPE.test(mime)) return 'Send a PDF, photo, CSV or Excel file.';
  return null;
}

// Save one file for a store: R2 + a row in store_files.
export async function saveStoreFile(env, store, { bytes, name, mime, kind, source, date }) {
  const db = env.DB;
  const size = bytes?.byteLength || 0;
  const bad = fileAllowed(name, mime, size);
  if (bad) return { ok: false, error: bad };
  const today = await db.prepare("SELECT COUNT(*) n FROM store_files WHERE store_id=? AND created_at >= datetime('now','-1 day')").bind(store.id).first();
  if ((today?.n || 0) >= DAILY_FILE_LIMIT) return { ok: false, error: 'Too many files today. Try again tomorrow.' };
  const k = guessKind(name, mime, kind);
  const reportDate = (k === 'sales' && (date || dateFromFilename(name))) || null;
  const safeName = String(name || 'file').replace(/[^\w.-]+/g, '_').slice(-120);
  const key = `stores/${store.code}/${k}/${new Date().toISOString().slice(0, 10)}/${Date.now()}_${safeName}`;
  if (env.FILES) await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime || 'application/octet-stream' } });
  const r = await db.prepare(`INSERT INTO store_files(store_id, kind, file_key, file_name, mime, size, source, report_date)
    VALUES (?,?,?,?,?,?,?,?)`).bind(store.id, k, key, String(name || safeName).slice(0, 200), mime || null, size, source, reportDate).run();
  return { ok: true, id: r.meta?.last_row_id, kind: k, report_date: reportDate, key };
}

export async function setFileKind(db, storeId, fileId, kind) {
  if (!KINDS[kind]) throw new Error('Unknown type');
  const f = await db.prepare('SELECT * FROM store_files WHERE id=? AND store_id=?').bind(Number(fileId), storeId).first();
  if (!f) throw new Error('File not found');
  const reportDate = kind === 'sales' ? (f.report_date || dateFromFilename(f.file_name)) : null;
  await db.prepare('UPDATE store_files SET kind=?, report_date=? WHERE id=?').bind(kind, reportDate, f.id).run();
  return { ...f, kind, report_date: reportDate };
}

// The onboarding checklist for one store.
export async function onboarding(db, store) {
  const rows = (await db.prepare(`SELECT kind, COUNT(*) n, COUNT(DISTINCT report_date) days, MIN(report_date) first, MAX(report_date) last
    FROM store_files WHERE store_id=? GROUP BY kind`).bind(store.id).all()).results;
  const by = Object.fromEntries(rows.map((r) => [r.kind, r]));
  const n = (k) => by[k]?.n || 0;
  const salesDays = by.sales ? Math.max(by.sales.days || 0, by.sales.days ? 0 : by.sales.n) : 0;
  const steps = [
    { key: 'telegram', title: 'Connect Telegram', detail: store.tg_chat_id ? 'Connected. Your morning brief will come here.' : 'One tap. Then you can just send photos to the bot.', done: !!store.tg_chat_id },
    { key: 'items', title: 'Send your item list', detail: n('items') ? `${n('items')} file${n('items') > 1 ? 's' : ''} received` : 'Export it from your POS once (Excel or CSV): item, size, price, cost, on hand.', done: n('items') > 0 },
    { key: 'sales', title: 'Send 30 days of sales reports', detail: salesDays ? `${salesDays} of 30 days received${by.sales?.first ? ` (${by.sales.first} to ${by.sales.last})` : ''}` : 'Your POS daily report: one file per day, or one report for the month.', done: salesDays >= 30, progress: Math.min(1, salesDays / 30) },
    { key: 'invoice', title: 'Send 2 months of invoices', detail: n('invoice') ? `${n('invoice')} invoice${n('invoice') > 1 ? 's' : ''} received` : 'Photos of paper invoices are fine. PDFs too.', done: n('invoice') >= 8, progress: Math.min(1, n('invoice') / 8) },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    counts: { items: n('items'), sales: n('sales'), sales_days: salesDays, invoice: n('invoice'), deals: n('deals'), other: n('other') },
    done: doneCount,
    total: steps.length,
    // Enough to send a first brief: an item list and a week of sales.
    ready: n('items') > 0 && salesDays >= 7,
  };
}

export function checklistText(store, ob, url) {
  const lines = [`<b>${esc(store.name)}</b> · ${esc(store.code)}`, `Setup: ${ob.done} of ${ob.total} done`, ''];
  for (const s of ob.steps) lines.push(`${s.done ? '✅' : '⬜️'} ${esc(s.title)}\n<i>${esc(s.detail)}</i>`);
  lines.push('', '📎 Send me a photo or PDF of any invoice, or your POS reports, and I’ll file them for you.');
  if (url) lines.push(`🔗 Upload many files at once: ${esc(url)}`);
  return lines.join('\n');
}

export async function recentFiles(db, storeId, limit = 12) {
  return (await db.prepare('SELECT id, kind, file_name, size, source, report_date, status, created_at FROM store_files WHERE store_id=? ORDER BY id DESC LIMIT ?')
    .bind(storeId, limit).all()).results;
}

// ---------- the store's setup page (/s/<token>) ----------
export function intakePage(store, ob, files, { botUser, email, publicSite = 'https://qilbo.pages.dev' } = {}) {
  const tgLink = botUser ? `https://t.me/${botUser}?start=${store.intake_token}` : '';
  const pct = Math.round((ob.steps.reduce((a, s) => a + (s.done ? 1 : (s.progress || 0)), 0) / ob.total) * 100);
  const step = (s, i) => `<li class="${s.done ? 'done' : ''}"><span class="n">${s.done ? '' : i + 1}</span><div><b>${esc(s.title)}</b><small>${esc(s.detail)}</small>${!s.done && s.progress ? `<i class="pb"><i style="width:${Math.round(s.progress * 100)}%"></i></i>` : ''}</div></li>`;
  const zone = (kind, title, hint, accept) => `<label class="zone" data-kind="${kind}">
      <input type="file" multiple accept="${accept}" data-kind="${kind}">
      <b>${title}</b><small>${hint}</small><span class="cnt" data-cnt="${kind}">${ob.counts[kind === 'sales' ? 'sales' : kind] || 0} received</span></label>`;
  const fileRow = (f) => `<li><span class="tag t-${esc(f.kind)}">${esc(KINDS[f.kind]?.label || f.kind)}</span><span class="fn">${esc(f.file_name)}</span><span class="src">${esc(f.source)}${f.report_date ? ' · ' + esc(f.report_date) : ''}</span></li>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Set up ${esc(store.name)} · Qilbo</title>
<meta name="theme-color" content="#0B2E8F">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gabarito:wght@700;800;900&family=Inter:wght@400;500;600&display=swap">
<style>
:root{--blue:#0B2E8F;--blue2:#1745C9;--soft:#E9EEFB;--ink:#0B1533;--muted:#525D78;--faint:#8790A8;--line:#E3E8F2;--bg:#F6F8FC;--ok:#0E8A5F;--okbg:#E6F5EE;--bad:#C2283A}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:Inter,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
.top{background:var(--blue);color:#fff;padding:18px 16px 76px}
.in{max-width:820px;margin:0 auto}
.brand{font-family:Gabarito,sans-serif;font-weight:800;font-size:24px;color:#fff;text-decoration:none}
.top h1{font-family:Gabarito,sans-serif;font-weight:800;font-size:clamp(28px,5vw,40px);line-height:1.1;margin:22px 0 4px}
.top p{color:#C9D5F7;margin:0}
.code{display:inline-block;background:rgba(255,255,255,.14);border-radius:8px;padding:2px 9px;font-weight:600;font-size:14px;margin-left:6px;vertical-align:middle}
main{max-width:820px;margin:-56px auto 40px;padding:0 16px;display:grid;gap:16px}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 24px 50px -32px rgba(11,21,51,.35);padding:24px}
h2{font-family:Gabarito,sans-serif;font-weight:800;font-size:22px;margin:0 0 4px}
.sub{color:var(--muted);margin:0 0 16px;font-size:15px}
.prog{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.bar{flex:1;height:10px;border-radius:9px;background:var(--line);overflow:hidden}
.bar i{display:block;height:100%;background:var(--blue2);border-radius:9px;transition:width .5s}
.prog b{font-family:Gabarito,sans-serif;font-size:22px;min-width:52px;text-align:right}
ol.check{list-style:none;margin:0;padding:0;display:grid;gap:14px}
ol.check li{display:flex;gap:12px;align-items:flex-start}
ol.check .n{flex:none;width:28px;height:28px;border-radius:50%;border:1.5px solid var(--line);display:grid;place-items:center;font-weight:700;font-size:13px;color:var(--muted)}
ol.check li.done .n{background:var(--ok) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4 8-9' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/14px no-repeat;border-color:var(--ok)}
ol.check b{display:block;font-size:15.5px}
ol.check small{display:block;color:var(--muted);font-size:14px}
.pb{display:block;height:5px;border-radius:5px;background:var(--line);margin-top:6px;max-width:260px;overflow:hidden}.pb i{display:block;height:100%;background:var(--blue2)}
.ready{margin-top:16px;background:var(--okbg);color:var(--ok);border-radius:12px;padding:10px 14px;font-size:14.5px;font-weight:600}
.ways{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.way{border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:6px}
.way b{font-size:15.5px}.way small{color:var(--muted);font-size:14px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--blue);color:#fff;font-weight:700;border-radius:999px;padding:11px 18px;text-decoration:none;margin-top:6px;border:0;font:inherit;font-weight:700;cursor:pointer}
.btn.ghost{background:var(--soft);color:var(--blue)}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:13.5px;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 10px;overflow-wrap:anywhere}
.zones{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.zone{position:relative;border:2px dashed #C9D3EA;border-radius:16px;padding:18px 16px;display:flex;flex-direction:column;gap:4px;cursor:pointer;transition:border-color .15s,background .15s;min-height:128px}
.zone:hover,.zone.over{border-color:var(--blue2);background:var(--soft)}
.zone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}
.zone b{font-size:15.5px}.zone small{color:var(--muted);font-size:13.5px}
.cnt{margin-top:auto;font-size:13px;font-weight:600;color:var(--blue2)}
ul.q,ul.files{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:6px;font-size:14px}
ul.q li{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed var(--line);padding-bottom:6px}
ul.q .st{flex:none;font-weight:600}.ok{color:var(--ok)}.bad{color:var(--bad)}.wait{color:var(--faint)}
ul.files li{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border-bottom:1px solid var(--line);padding:6px 0}
.fn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.src{color:var(--faint);font-size:12.5px}
.tag{font-size:12px;font-weight:700;border-radius:6px;padding:2px 8px;background:var(--soft);color:var(--blue)}
.t-sales{background:#E6F5EE;color:var(--ok)}.t-invoice{background:#FFF3E0;color:#9A5B00}.t-deals{background:#F3E8FD;color:#6B2BB0}.t-other{background:#EEF0F4;color:var(--muted)}
.foot{text-align:center;color:var(--faint);font-size:13px}
.foot a{color:var(--muted)}
@media (max-width:620px){.ways,.zones{grid-template-columns:1fr}.card{padding:20px 18px}}
</style>
</head>
<body>
<div class="top"><div class="in">
  <a class="brand" href="${esc(publicSite)}">Qilbo</a>
  <h1>Set up ${esc(store.name)}<span class="code">${esc(store.code)}</span></h1>
  <p>Send us what your store already has. Qilbo does the rest and sends your first list of fixes.</p>
</div></div>
<main>
  <section class="card" aria-labelledby="h-check">
    <h2 id="h-check">Your setup</h2>
    <div class="prog"><div class="bar"><i id="pbar" style="width:${pct}%"></i></div><b id="ppct">${pct}%</b></div>
    <ol class="check" id="check">${ob.steps.map(step).join('')}</ol>
    ${ob.ready ? '<div class="ready">You’ve sent enough for your first morning brief. We’ll send it after tonight’s check.</div>' : ''}
  </section>

  <section class="card" aria-labelledby="h-ways">
    <h2 id="h-ways">Easiest ways to send things</h2>
    <p class="sub">Use whichever is easiest. All of them land in the same place.</p>
    <div class="ways">
      <div class="way"><b>📲 Telegram</b><small>${store.tg_chat_id ? 'Connected. Just send photos of invoices or your POS reports to the Qilbo bot.' : 'Tap once to connect. Then snap invoices and send them, like a text.'}</small>
        ${tgLink ? `<a class="btn" href="${esc(tgLink)}" target="_blank" rel="noopener">${store.tg_chat_id ? 'Open Telegram' : 'Connect Telegram'}</a>` : ''}</div>
      ${email ? `<div class="way"><b>✉️ Email</b><small>Forward POS daily reports and distributor invoice emails here. Best: set a forwarding rule once.</small><div class="mono">${esc(email)}</div><button class="btn ghost" type="button" data-copy="${esc(email)}">Copy address</button></div>`
      : `<div class="way"><b>💻 This page</b><small>Drag files below, many at a time. Works on phone and computer. Bookmark this page to come back.</small></div>`}
    </div>
  </section>

  <section class="card" aria-labelledby="h-up">
    <h2 id="h-up">Upload files</h2>
    <p class="sub">Drop files on a box, or tap to pick. PDFs, photos, CSV and Excel, up to 25 MB each.</p>
    <div class="zones">
      ${zone('items', 'Item list', 'From your POS: item, size, price, cost, on hand', '.csv,.xls,.xlsx,.pdf,.txt')}
      ${zone('sales', 'Sales reports', 'Daily or monthly reports. The last 30 days.', '.csv,.xls,.xlsx,.pdf,.txt,image/*')}
      ${zone('invoice', 'Invoices', 'Last 2 months. Photos are fine.', '.pdf,image/*,.csv,.xls,.xlsx')}
      ${zone('deals', 'Deal sheets', 'Optional: distributor deals and price books', '.pdf,image/*,.csv,.xls,.xlsx')}
    </div>
    <ul class="q" id="queue" aria-live="polite"></ul>
  </section>

  <section class="card" aria-labelledby="h-files">
    <h2 id="h-files">Received</h2>
    <ul class="files" id="files">${files.length ? files.map(fileRow).join('') : '<li style="display:block;color:var(--faint)">Nothing yet.</li>'}</ul>
  </section>
  <p class="foot">Private link for ${esc(store.name)}. Don’t share it outside your store. Questions? Reply on Telegram. · <a href="${esc(publicSite)}/privacy.html">Privacy</a></p>
</main>
<script>
(function(){
  var base=location.pathname.replace(/\\/$/,''), q=document.getElementById('queue'), sent=0, busy=0;
  var LABEL={items:'Item list',sales:'Sales report',invoice:'Invoice',deals:'Deal sheet',other:'Other'};
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function refresh(){
    fetch(base+'/status').then(function(r){return r.json()}).then(function(s){
      if(!s.ok||!s.steps) return;
      document.getElementById('pbar').style.width=s.pct+'%'; document.getElementById('ppct').textContent=s.pct+'%';
      document.getElementById('check').innerHTML=s.steps.map(function(x,i){return '<li class="'+(x.done?'done':'')+'"><span class="n">'+(x.done?'':i+1)+'</span><div><b>'+esc(x.title)+'</b><small>'+esc(x.detail)+'</small>'+(!x.done&&x.progress?'<i class="pb"><i style="width:'+Math.round(x.progress*100)+'%"></i></i>':'')+'</div></li>'}).join('');
      ['items','sales','invoice','deals'].forEach(function(k){var el=document.querySelector('[data-cnt="'+k+'"]'); if(el) el.textContent=(s.counts[k]||0)+' received'});
      document.getElementById('files').innerHTML=s.files.map(function(f){return '<li><span class="tag t-'+esc(f.kind)+'">'+esc(LABEL[f.kind]||f.kind)+'</span><span class="fn">'+esc(f.file_name)+'</span><span class="src">'+esc(f.source)+(f.report_date?' · '+esc(f.report_date):'')+'</span></li>'}).join('')||'<li style="display:block;color:var(--faint)">Nothing yet.</li>';
    }).catch(function(){});
  }
  function upload(file,kind){
    var li=document.createElement('li'); li.innerHTML='<span class="fn">'+esc(file.name)+'</span><span class="st wait">Waiting…</span>'; q.prepend(li);
    var st=li.querySelector('.st');
    if(file.size>25*1024*1024){st.textContent='Too big (25 MB max)';st.className='st bad';return Promise.resolve()}
    var fd=new FormData(); fd.append('file',file); fd.append('kind',kind);
    busy++; st.textContent='Sending…';
    return fetch(base+'/upload',{method:'POST',body:fd}).then(function(r){return r.json()}).then(function(r){
      if(r.ok){sent++; st.textContent='✓ '+(LABEL[r.kind]||'Saved')+(r.report_date?' · '+r.report_date:''); st.className='st ok'}
      else{st.textContent=r.error||'Failed'; st.className='st bad'}
    }).catch(function(){st.textContent='Failed. Check your connection.'; st.className='st bad'})
      .then(function(){busy--});
  }
  function many(files,kind){
    var list=[].slice.call(files), i=0;
    function next(){ if(i>=list.length){ if(!busy){ refresh(); if(sent) fetch(base+'/done',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({count:sent})}).catch(function(){}); sent=0;} return; }
      var a=upload(list[i++],kind), b=i<list.length?upload(list[i++],kind):null; Promise.all([a,b]).then(next); }
    next();
  }
  [].forEach.call(document.querySelectorAll('.zone'),function(z){
    var inp=z.querySelector('input'), kind=z.dataset.kind;
    inp.addEventListener('change',function(){ if(inp.files.length) many(inp.files,kind); inp.value=''; });
    z.addEventListener('dragover',function(e){e.preventDefault(); z.classList.add('over')});
    z.addEventListener('dragleave',function(){z.classList.remove('over')});
    z.addEventListener('drop',function(e){e.preventDefault(); z.classList.remove('over'); if(e.dataTransfer.files.length) many(e.dataTransfer.files,kind)});
  });
  [].forEach.call(document.querySelectorAll('[data-copy]'),function(b){b.addEventListener('click',function(){
    navigator.clipboard&&navigator.clipboard.writeText(b.dataset.copy).then(function(){b.textContent='Copied ✓'; setTimeout(function(){b.textContent='Copy address'},1600)});
  })});
})();
</script>
</body>
</html>`;
}

export function pctOf(ob) {
  return Math.round((ob.steps.reduce((a, s) => a + (s.done ? 1 : (s.progress || 0)), 0) / ob.total) * 100);
}

// Store email address: Gmail plus-addressing on one Qilbo inbox, e.g. qilbo.inbox+qlb-0002@gmail.com
export function storeEmail(inbox, code) {
  if (!inbox || !/@/.test(inbox)) return '';
  const [u, d] = inbox.split('@');
  return `${u}+${String(code).toLowerCase()}@${d}`;
}
