// New store sign-up: the public /join page (a 5-step onboarding form), saving a signup,
// and the owner's view of signups (list, approve as pilot, decline).
// A signup only creates a 'pending' store row. Nothing else in Qilbo changes for it until it is approved.

const STORE_TYPES = ['Liquor store', 'Convenience store', 'Smoke & vape shop', 'Mixed'];
const POS = ['NRS', 'Clover', 'Square', 'Modisoft', 'Verifone / Commander', 'Gilbarco Passport', 'Lightspeed', 'Other', 'No POS yet'];
const DISTRIBUTORS = ["Southern Glazer's", 'Breakthru Beverage', 'Republic National (RNDC)', 'Johnson Brothers', 'Wayne Densch', 'Gold Coast', 'Coca-Cola / Pepsi', 'Core-Mark / McLane', 'Other'];
const SALES = ['Under $30k a month', '$30k – $75k', '$75k – $150k', '$150k – $300k', 'Over $300k'];
const PROBLEMS = [
  "I don't know my real margin",
  'Wrong prices at the register',
  'I miss distributor deals',
  'Best sellers run out',
  'Money stuck in dead stock',
  'Invoices take too long',
  'Customers ask for things I forget',
  'Theft, voids or $0 sales',
];
const ALERTS = ['Telegram', 'Email', 'WhatsApp (coming soon)'];

const clean = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
const pickList = (v, allowed) => (Array.isArray(v) ? v : []).map((x) => clean(x, 60)).filter((x) => allowed.includes(x));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- saving a signup ----------
export async function saveSignup(db, body, ip = '') {
  if (body.website) return { ok: true, code: 'QLB-0000' }; // honeypot filled: a bot, pretend success
  const s = {
    name: clean(body.store_name, 80),
    store_type: STORE_TYPES.includes(body.store_type) ? body.store_type : null,
    address: clean(body.address, 120),
    city: clean(body.city, 60),
    state: clean(body.state, 2).toUpperCase(),
    zip: clean(body.zip, 10),
    owner_name: clean(body.owner_name, 80),
    phone: clean(body.phone, 30),
    email: clean(body.email, 120).toLowerCase(),
    pos: POS.includes(body.pos) ? body.pos : 'Other',
  };
  const errors = [];
  if (!s.name) errors.push('Store name is required.');
  if (!s.store_type) errors.push('Pick your store type.');
  if (!s.city || !/^[A-Z]{2}$/.test(s.state)) errors.push('City and a 2-letter state are required.');
  if (!s.owner_name) errors.push('Your name is required.');
  if (!/\d{7,}/.test(s.phone.replace(/\D/g, ''))) errors.push('A phone number is required.');
  if (s.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) errors.push('That email doesn’t look right.');
  if (!body.agree) errors.push('Please agree to the Terms and Privacy Policy.');
  if (errors.length) return { ok: false, errors };

  // Slow down repeat signups from one address (5 an hour)
  const recent = await db.prepare("SELECT COUNT(*) n FROM stores WHERE signup_ip = ? AND created_at > datetime('now','-1 hour')").bind(ip).first();
  if (ip && recent && recent.n >= 5) return { ok: false, errors: ['Too many signups from here. Try again in an hour.'] };

  const profile = {
    distributors: pickList(body.distributors, DISTRIBUTORS),
    distributors_other: clean(body.distributors_other, 120),
    registers: Math.max(0, Math.min(20, parseInt(body.registers, 10) || 0)) || null,
    sales_range: SALES.includes(body.sales_range) ? body.sales_range : null,
    report_email: ['yes', 'no', 'not sure'].includes(body.report_email) ? body.report_email : null,
    margin_goals: {
      spirits: clampPct(body.goal_spirits, 35), wine: clampPct(body.goal_wine, 30), beer: clampPct(body.goal_beer, 20), other: clampPct(body.goal_other, 30),
    },
    problems: pickList(body.problems, PROBLEMS),
    alerts: pickList(body.alerts, ALERTS.filter((a) => !/coming soon/.test(a))),
    best_time: clean(body.best_time, 40),
    notes: clean(body.notes, 500),
    intent: body.intent === 'demo' ? 'demo' : 'pilot',
    source: body.source === 'website' ? 'website' : 'join page',
    agreed_at: new Date().toISOString(),
  };
  const typeKey = /liquor/i.test(s.store_type) ? 'liquor' : /conven/i.test(s.store_type) ? 'convenience' : /smoke/i.test(s.store_type) ? 'smoke' : 'mixed';
  const ins = await db.prepare(`INSERT INTO stores(name, store_type, status, owner_name, phone, email, address, city, state, zip, pos, profile, signup_ip)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(s.name, typeKey, 'pending', s.owner_name, s.phone, s.email || null, s.address || null, s.city, s.state, s.zip || null, s.pos, JSON.stringify(profile), ip || null).run();
  const id = ins.meta?.last_row_id;
  const code = 'QLB-' + String(id).padStart(4, '0');
  await db.prepare('UPDATE stores SET code=? WHERE id=?').bind(code, id).run();
  return { ok: true, id, code, store: { ...s, profile } };
}
function clampPct(v, d) { const n = parseFloat(v); return Number.isFinite(n) ? Math.max(5, Math.min(80, Math.round(n))) : d; }

export async function listStores(db) {
  const rows = (await db.prepare('SELECT * FROM stores ORDER BY CASE status WHEN \'pending\' THEN 0 ELSE 1 END, id DESC').all()).results;
  return rows.map((r) => { const { signup_ip, ...rest } = r; return { ...rest, profile: safe(r.profile) }; });
}
export async function decideStore(db, id, decision) {
  const status = decision === 'approve' ? 'pilot' : decision === 'decline' ? 'declined' : null;
  if (!status || Number(id) === 1) throw new Error('Not allowed');
  const r = await db.prepare("UPDATE stores SET status=?, decided_at=datetime('now') WHERE id=?").bind(status, Number(id)).run();
  if (!r.meta?.changes) throw new Error('Store not found');
  return { id: Number(id), status };
}
function safe(s) { try { return s ? JSON.parse(s) : {}; } catch { return {}; } }

// Telegram note to the Qilbo owner when a store signs up
export function signupAlert(r) {
  const p = r.store.profile;
  return [
    `🆕 <b>${p.intent === 'demo' ? 'Demo request' : 'New store signed up'}</b> · ${r.code}${p.source === 'website' ? ' · from the website' : ''}`,
    `<b>${esc(r.store.name)}</b> (${esc(r.store.store_type)})`,
    `${esc([r.store.address, r.store.city, r.store.state, r.store.zip].filter(Boolean).join(', '))}`,
    `👤 ${esc(r.store.owner_name)} · 📞 ${esc(r.store.phone)}${r.store.email ? ' · ' + esc(r.store.email) : ''}`,
    `🖥 POS: ${esc(r.store.pos)}${p.registers ? ` · ${p.registers} register(s)` : ''}${p.sales_range ? ` · ${esc(p.sales_range)}` : ''}`,
    p.distributors.length ? `🚚 ${esc(p.distributors.join(', '))}${p.distributors_other ? ', ' + esc(p.distributors_other) : ''}` : '',
    p.problems.length ? `😣 ${esc(p.problems.join(' · '))}` : '',
    p.best_time ? `⏰ Best time to call: ${esc(p.best_time)}` : '',
    p.notes ? `📝 ${esc(p.notes)}` : '',
  ].filter(Boolean).join('\n');
}

// ---------- the /join page ----------
const opt = (list, name, type = 'radio', checked = []) => list.map((v) => `
  <label class="chip"><input type="${type}" name="${name}" value="${esc(v)}"${checked.includes(v) ? ' checked' : ''}${v.includes('coming soon') ? ' disabled' : ''}><span>${esc(v)}</span></label>`).join('');

export function joinPage(publicSite = 'https://qilbo.pages.dev') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Join Qilbo</title>
<meta name="description" content="Register your store for the Qilbo founding pilot.">
<meta name="theme-color" content="#0B2E8F">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gabarito:wght@700;800;900&family=Inter:wght@400;500;600&display=swap">
<style>
:root{--blue:#0B2E8F;--blue2:#1745C9;--soft:#E9EEFB;--ink:#0B1533;--muted:#525D78;--faint:#8790A8;--line:#E3E8F2;--bg:#F6F8FC;--ok:#0E8A5F;--bad:#C2283A;--r:16px}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:Inter,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
.top{background:var(--blue);color:#fff;padding:18px max(16px,env(safe-area-inset-left)) 70px}
.top-in{max-width:760px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand{font-family:Gabarito,sans-serif;font-weight:800;font-size:26px;color:#fff;text-decoration:none;display:flex;align-items:center;gap:8px}
.top a.small{color:#C9D5F7;font-size:14px;text-decoration:none}
.hero{max-width:760px;margin:26px auto 0}
.hero h1{font-family:Gabarito,sans-serif;font-weight:800;font-size:clamp(30px,5vw,42px);line-height:1.08;margin:0}
.hero p{color:#C9D5F7;margin:8px 0 0;max-width:56ch}
main{max-width:760px;margin:-46px auto 40px;padding:0 max(16px,env(safe-area-inset-left))}
.card{background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:0 24px 50px -30px rgba(11,21,51,.35);padding:26px}
.steps{display:flex;gap:6px;margin-bottom:22px}
.steps i{flex:1;height:6px;border-radius:3px;background:var(--line);transition:background .3s}
.steps i.on{background:var(--blue2)}
.step-label{font-size:13px;font-weight:600;color:var(--blue2);letter-spacing:.02em}
h2{font-family:Gabarito,sans-serif;font-weight:800;font-size:26px;margin:4px 0 4px}
.sub{color:var(--muted);margin:0 0 20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid .full{grid-column:1/-1}
label.f{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600;min-width:0}
label.f small{font-weight:400;color:var(--faint)}
input[type=text],input[type=tel],input[type=email],input[type=number],select,textarea{font:inherit;font-weight:400;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff;color:var(--ink);width:100%}
textarea{min-height:90px;resize:vertical}
input:focus,select:focus,textarea:focus{outline:2px solid var(--blue2);outline-offset:1px;border-color:transparent}
.group{margin-top:18px}
.group>b{display:block;font-size:14px;margin-bottom:8px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{position:relative}
.chip input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.chip span{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:9px 14px;font-size:14px;font-weight:500;background:#fff;cursor:pointer;transition:all .15s}
.chip input:checked+span{background:var(--blue);border-color:var(--blue);color:#fff}
.chip input:focus-visible+span{outline:2px solid var(--blue2);outline-offset:2px}
.chip input:disabled+span{opacity:.45;cursor:not-allowed}
.goals{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.goals label{font-size:13px;font-weight:600;display:flex;flex-direction:column;gap:6px}
.pctwrap{position:relative}.pctwrap input{padding-right:30px}.pctwrap:after{content:"%";position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--faint)}
.nav{display:flex;justify-content:space-between;align-items:center;margin-top:26px;gap:12px}
button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:13px 24px;cursor:pointer}
.next{background:var(--blue);color:#fff}
.next:hover{background:var(--blue2)}
.back{background:none;color:var(--muted);padding-left:0}
.err{background:#FDECEE;color:var(--bad);border-radius:12px;padding:10px 14px;font-size:14px;margin-top:14px}
.review{display:grid;gap:10px}
.review div{display:grid;grid-template-columns:140px 1fr;gap:10px;font-size:14px;border-bottom:1px dashed var(--line);padding-bottom:8px}
.review div span{color:var(--muted)}
.agree{display:flex;gap:10px;align-items:flex-start;margin-top:18px;font-size:14px}
.agree input{width:20px;height:20px;margin-top:2px;accent-color:var(--blue)}
.agree a{color:var(--blue2)}
.done{text-align:center;padding:16px 6px}
.done .tick{width:72px;height:72px;border-radius:50%;background:var(--soft);display:grid;place-items:center;margin:0 auto 12px}
.code{display:inline-block;font-family:Gabarito,sans-serif;font-weight:800;font-size:22px;background:var(--soft);color:var(--blue);padding:6px 16px;border-radius:12px;margin:8px 0 14px}
.next-steps{text-align:left;max-width:440px;margin:16px auto 0;padding:0;list-style:none;counter-reset:n}
.next-steps li{counter-increment:n;display:grid;grid-template-columns:28px 1fr;gap:10px;margin:10px 0;font-size:15px}
.next-steps li:before{content:counter(n);width:26px;height:26px;border-radius:50%;background:var(--blue);color:#fff;font-weight:700;font-size:13px;display:grid;place-items:center}
.hp{position:absolute;left:-5000px}
.foot{text-align:center;color:var(--faint);font-size:13px;margin-top:18px}
.foot a{color:var(--muted)}
[hidden]{display:none!important}
@media (max-width:620px){.grid{grid-template-columns:1fr}.goals{grid-template-columns:1fr 1fr}.card{padding:20px}.review div{grid-template-columns:1fr;gap:2px}}
</style>
</head>
<body>
<header class="top">
  <div class="top-in"><a class="brand" href="${publicSite}"><svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true"><path d="M 53.58 79.48 A 31 31 0 1 1 74.70 54.31" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/><path d="M 36 52 L 50 66 L 88 26" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>Qilbo</a><a class="small" href="${publicSite}">← Back to site</a></div>
  <div class="hero"><h1>Register your store</h1><p>Five quick steps. The founding pilot is free for 60 days, and Qilbo never changes your register.</p></div>
</header>
<main>
<form class="card" id="f" novalidate>
  <div class="steps" aria-hidden="true"><i class="on"></i><i></i><i></i><i></i><i></i></div>
  <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">

  <section data-step="1">
    <div class="step-label">Step 1 of 5</div>
    <h2>Your store</h2><p class="sub">Tell us where Qilbo will be working.</p>
    <div class="grid">
      <label class="f full">Store name<input type="text" name="store_name" id="store_name" autocomplete="organization" required></label>
      <div class="full group" style="margin-top:0"><b>Store type</b><div class="chips">${opt(STORE_TYPES, 'store_type')}</div></div>
      <label class="f full">Street address<input type="text" name="address" id="address" autocomplete="street-address"></label>
      <label class="f">City<input type="text" name="city" id="city" autocomplete="address-level2" required></label>
      <div class="grid" style="gap:10px"><label class="f">State<input type="text" name="state" id="state" maxlength="2" placeholder="FL" autocomplete="address-level1" required></label>
      <label class="f">ZIP<input type="text" name="zip" id="zip" inputmode="numeric" maxlength="10" autocomplete="postal-code"></label></div>
    </div>
  </section>

  <section data-step="2" hidden>
    <div class="step-label">Step 2 of 5</div>
    <h2>About you</h2><p class="sub">So we can set up your pilot with you.</p>
    <div class="grid">
      <label class="f full">Your name<input type="text" name="owner_name" id="owner_name" autocomplete="name" required></label>
      <label class="f">Phone or WhatsApp<input type="tel" name="phone" id="phone" autocomplete="tel" required></label>
      <label class="f">Email <small>optional</small><input type="email" name="email" id="email" autocomplete="email"></label>
      <label class="f full">Best time to call <small>optional</small><input type="text" name="best_time" id="best_time" placeholder="Weekdays after 2 PM"></label>
    </div>
  </section>

  <section data-step="3" hidden>
    <div class="step-label">Step 3 of 5</div>
    <h2>How you run it</h2><p class="sub">Qilbo reads what your register and distributors already send you.</p>
    <div class="grid">
      <label class="f">Your POS / register<select name="pos" id="pos">${POS.map((v) => `<option>${esc(v)}</option>`).join('')}</select></label>
      <label class="f">Number of registers<input type="number" name="registers" id="registers" min="1" max="20" value="1"></label>
    </div>
    <div class="group"><b>Does your POS email you a daily sales report?</b><div class="chips">${opt(['yes', 'no', 'not sure'], 'report_email')}</div></div>
    <div class="group"><b>Who do you buy from?</b><div class="chips">${opt(DISTRIBUTORS, 'distributors', 'checkbox')}</div></div>
    <label class="f group">Others <small>optional</small><input type="text" name="distributors_other" id="distributors_other" placeholder="Local beer distributor, cash & carry…"></label>
    <div class="group"><b>Monthly sales, roughly</b><div class="chips">${opt(SALES, 'sales_range')}</div></div>
  </section>

  <section data-step="4" hidden>
    <div class="step-label">Step 4 of 5</div>
    <h2>Your goals</h2><p class="sub">Qilbo checks every item against these margins every night.</p>
    <div class="goals">
      <label>Spirits<span class="pctwrap"><input type="number" name="goal_spirits" id="goal_spirits" value="35" min="5" max="80"></span></label>
      <label>Wine<span class="pctwrap"><input type="number" name="goal_wine" id="goal_wine" value="30" min="5" max="80"></span></label>
      <label>Beer<span class="pctwrap"><input type="number" name="goal_beer" id="goal_beer" value="20" min="5" max="80"></span></label>
      <label>Everything else<span class="pctwrap"><input type="number" name="goal_other" id="goal_other" value="30" min="5" max="80"></span></label>
    </div>
    <div class="group"><b>What hurts most right now?</b> <small style="color:var(--faint)">pick any</small><div class="chips" style="margin-top:8px">${opt(PROBLEMS, 'problems', 'checkbox')}</div></div>
    <div class="group"><b>Where should the morning brief go?</b><div class="chips">${opt(ALERTS, 'alerts', 'checkbox', ['Telegram'])}</div></div>
    <label class="f group">Anything else we should know? <small>optional</small><textarea name="notes" id="notes" maxlength="500"></textarea></label>
  </section>

  <section data-step="5" hidden>
    <div class="step-label">Step 5 of 5</div>
    <h2>Check and send</h2><p class="sub">You can change anything later.</p>
    <div class="review" id="review"></div>
    <label class="agree"><input type="checkbox" name="agree" id="agree"><span>I agree to the <a href="${publicSite}/terms.html" target="_blank" rel="noopener">Terms</a> and <a href="${publicSite}/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>. Qilbo is read-only: it never changes my register, orders or money.</span></label>
  </section>

  <section data-step="done" hidden>
    <div class="done">
      <div class="tick"><svg width="38" height="38" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#0B2E8F" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h2>You're on the list</h2>
      <div>Your store ID</div><div class="code" id="code">QLB-0000</div>
      <p class="sub" style="margin:0">Keep it handy. Here's what happens next:</p>
      <ol class="next-steps">
        <li><span>We call you within 24 hours to set a start date.</span></li>
        <li><span>You forward your POS daily report and distributor invoices to your Qilbo address. We help.</span></li>
        <li><span>You connect Telegram for your 9:45 AM morning brief.</span></li>
        <li><span>Qilbo runs its first night of checks and sends your first list of fixes.</span></li>
      </ol>
    </div>
  </section>

  <div class="err" id="err" role="alert" hidden></div>
  <div class="nav" id="nav">
    <button type="button" class="back" id="back" hidden>← Back</button>
    <button type="button" class="next" id="next">Continue</button>
  </div>
</form>
<p class="foot">Already a Qilbo store? <a href="/">Sign in</a></p>
</main>
<script>
(function(){
  var f=document.getElementById('f'), step=1, last=5;
  var secs=[].slice.call(f.querySelectorAll('section[data-step]')), bars=[].slice.call(f.querySelectorAll('.steps i'));
  var err=document.getElementById('err'), next=document.getElementById('next'), back=document.getElementById('back');
  function val(n){var el=f.elements[n]; if(!el) return ''; if(el.length!==undefined&&el.tagName!=='SELECT'){var o=[].slice.call(el).filter(function(x){return x.checked}); return el[0]&&el[0].type==='checkbox'?o.map(function(x){return x.value}):(o[0]?o[0].value:'')} return el.type==='checkbox'?el.checked:el.value.trim()}
  function show(n){ step=n; secs.forEach(function(s){s.hidden=s.dataset.step!==String(n)}); bars.forEach(function(b,i){b.classList.toggle('on',i<(n==='done'?5:n))});
    back.hidden=(n===1||n==='done'); document.getElementById('nav').hidden=(n==='done'); next.textContent=n===last?'Send':'Continue'; err.hidden=true;
    if(n===last) review(); window.scrollTo({top:0,behavior:'smooth'}); var first=f.querySelector('section[data-step="'+n+'"] input:not([type=hidden]),section[data-step="'+n+'"] select'); if(first&&n!=='done') setTimeout(function(){first.focus({preventScroll:true})},300); }
  function check(n){ var e=[];
    if(n===1){ if(!val('store_name')) e.push('Store name is required.'); if(!val('store_type')) e.push('Pick your store type.'); if(!val('city')) e.push('City is required.'); if(!/^[A-Za-z]{2}$/.test(val('state'))) e.push('Use the 2-letter state, like FL.'); }
    if(n===2){ if(!val('owner_name')) e.push('Your name is required.'); if(val('phone').replace(/\\D/g,'').length<7) e.push('A phone number is required.'); var em=val('email'); if(em&&!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(em)) e.push('That email doesn\\u2019t look right.'); }
    if(n===5){ if(!val('agree')) e.push('Please agree to the Terms and Privacy Policy.'); }
    if(e.length){ err.textContent=e.join(' '); err.hidden=false; return false } return true }
  function row(k,v){ var d=document.createElement('div'); var a=document.createElement('span'); a.textContent=k; var b=document.createElement('b'); b.textContent=v||'—'; d.append(a,b); return d }
  function review(){ var r=document.getElementById('review'); r.replaceChildren(
    row('Store', val('store_name')+' · '+val('store_type')),
    row('Address', [val('address'),val('city'),val('state').toUpperCase(),val('zip')].filter(Boolean).join(', ')),
    row('Owner', val('owner_name')+' · '+val('phone')+(val('email')?' · '+val('email'):'')),
    row('Register', val('pos')+' · '+val('registers')+' register(s)'+(val('report_email')?' · daily report email: '+val('report_email'):'')),
    row('Distributors', val('distributors').concat(val('distributors_other')?[val('distributors_other')]:[]).join(', ')),
    row('Margin goals', 'Spirits '+val('goal_spirits')+'% · Wine '+val('goal_wine')+'% · Beer '+val('goal_beer')+'% · Other '+val('goal_other')+'%'),
    row('Biggest pains', val('problems').join(' · ')),
    row('Morning brief', val('alerts').join(', '))) }
  back.onclick=function(){ if(step>1) show(step-1) };
  next.onclick=function(){ if(!check(step)) return; if(step<last) return show(step+1); send() };
  f.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target.tagName==='INPUT'){ e.preventDefault(); next.click() } });
  function send(){ next.disabled=true; next.textContent='Sending…';
    var body={}; ['website','store_name','store_type','address','city','state','zip','owner_name','phone','email','best_time','pos','registers','report_email','distributors','distributors_other','sales_range','goal_spirits','goal_wine','goal_beer','goal_other','problems','alerts','notes','agree'].forEach(function(k){body[k]=val(k)});
    fetch('/api/public/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json()}).then(function(d){
        if(!d.ok){ err.textContent=(d.errors||['Something went wrong. Please try again.']).join(' '); err.hidden=false; next.disabled=false; next.textContent='Send'; return }
        document.getElementById('code').textContent=d.code; show('done') })
      .catch(function(){ err.textContent='Couldn\\u2019t send. Check your connection and try again.'; err.hidden=false; next.disabled=false; next.textContent='Send' }) }
  show(1);
})();
</script>
</body>
</html>`;
}
