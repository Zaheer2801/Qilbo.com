// Pilot store intake: setup link, upload page, Telegram linking and filing, email intake, onboarding checklist.
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import assert from 'assert';
import { saveSignup, decideStore } from '../src/signup.js';
import { guessKind, ensureToken, onboarding, storeEmail, intakePage, recentFiles } from '../src/intake.js';
import { handleUpdate } from '../src/telegram.js';
import worker from '../src/index.js';

const raw = new DatabaseSync(':memory:');
raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
for (const f of ['v6_brain_findings.sql', 'v7_store_signups.sql', 'v8_store_intake.sql']) {
  const sql = fs.readFileSync(new URL('../migrate/' + f, import.meta.url), 'utf8').replace(/--.*$/gm, '');
  for (const st of sql.split(';').map((x) => x.trim()).filter(Boolean)) {
    try { raw.exec(st); } catch (e) { if (!/duplicate column|already exists/.test(e.message)) throw e; }
  }
}
const stmt = (sql) => ({ _b: [], bind(...a) { this._b = a; return this; },
  first() { return raw.prepare(sql).get(...this._b) || null; }, all() { return { results: raw.prepare(sql).all(...this._b) }; },
  run() { const r = raw.prepare(sql).run(...this._b); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } });
const db = { prepare: stmt, batch: async (list) => list.map((s) => s.run()) };
const r2 = new Map();
const env = { DB: db, FILES: { put: async (k, v) => r2.set(k, v) }, OWNER_CHAT_ID: '100', TELEGRAM_BOT_TOKEN: 'T', INGEST_KEY: 'K', TELEGRAM_WEBHOOK_SECRET: 'S',
  APP_URL: 'https://app.test', INTAKE_INBOX: 'qilbo.inbox@gmail.com' };
const ctx = { waitUntil: (p) => p };

// Telegram API mock
const sent = [];
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('/file/bot')) return new Response(new Uint8Array([1, 2, 3, 4]));
  const method = url.split('/').pop();
  const body = opt.body ? JSON.parse(opt.body) : {};
  sent.push({ method, body });
  if (method === 'getFile') return Response.json({ ok: true, result: { file_path: 'photos/x.jpg' } });
  if (method === 'getMe') return Response.json({ ok: true, result: { username: 'QilboBot' } });
  return Response.json({ ok: true, result: { message_id: 9 } });
};
const lastTo = (chat) => [...sent].reverse().find((m) => String(m.body.chat_id) === String(chat));

// guessing file types
assert.equal(guessKind('Daily_Sales_Report_2026-11-05.csv', 'text/csv'), 'sales');
assert.equal(guessKind('IMG_2231.jpg', 'image/jpeg'), 'invoice');
assert.equal(guessKind('item_export.xlsx', ''), 'items');
assert.equal(guessKind('Nov deals.pdf', 'application/pdf'), 'deals');
assert.equal(guessKind('data.csv', 'text/csv'), 'other');
assert.equal(guessKind('data.csv', 'text/csv', 'sales'), 'sales');
assert.equal(storeEmail('qilbo.inbox@gmail.com', 'QLB-0002'), 'qilbo.inbox+qlb-0002@gmail.com');

// a store signs up; pending stores have no working setup link
const s = await saveSignup(db, { store_name: 'Casper Smoke Shop', store_type: 'Smoke & vape shop', city: 'Austin', state: 'TX', owner_name: 'Sam Lee', phone: '512 555 0100', agree: true }, '9.9.9.9');
const token = await ensureToken(db, s.id);
assert.equal(token, await ensureToken(db, s.id), 'token is stable');
let res = await worker.fetch(new Request(`https://app.test/s/${token}`), env, ctx);
assert.equal(res.status, 404, 'pending store: link not active yet');

// approve on Telegram → setup link + message to forward
await handleUpdate(env, { callback_query: { id: 'q', data: `sa:${s.id}`, message: { message_id: 1, chat: { id: 100 } } } });
assert.ok(sent.some((m) => String(m.body.text || '').includes(`https://app.test/s/${token}`)), 'owner gets setup link');
assert.ok(lastTo(100).body.text.startsWith('Hi Sam, welcome to Qilbo'));

// the setup page
res = await worker.fetch(new Request(`https://app.test/s/${token}`), env, ctx);
assert.equal(res.status, 200);
const html = await res.text();
assert.ok(html.includes('Set up Casper Smoke Shop') && html.includes(`t.me/QilboBot?start=${token}`) && html.includes('qilbo.inbox+qlb-0002@gmail.com'));
assert.equal((await worker.fetch(new Request('https://app.test/s/not-a-real-token-123456'), env, ctx)).status, 404);

// upload page: two sales reports, an item list, a bad file
const up = async (name, type, kind, bytes = 'a,b\n1,2') => {
  const fd = new FormData(); fd.append('file', new File([bytes], name, { type })); fd.append('kind', kind);
  const r = await worker.fetch(new Request(`https://app.test/s/${token}/upload`, { method: 'POST', body: fd }), env, ctx);
  return r.json();
};
let u = await up('Daily_Sales_Report_2026-11-01.csv', 'text/csv', 'sales');
assert.ok(u.ok && u.kind === 'sales' && u.report_date === '2026-11-01');
await up('Daily_Sales_Report_2026-11-02.csv', 'text/csv', 'sales');
await up('Daily_Sales_Report_2026-11-02.csv', 'text/csv', 'sales');   // same day twice counts once
u = await up('items.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'items');
assert.ok(u.ok && u.kind === 'items');
u = await up('virus.exe', 'application/x-msdownload', 'items');
assert.equal(u.ok, false);
assert.ok([...r2.keys()].every((k) => k.startsWith('stores/QLB-0002/')), 'files kept under the store');

let st = await (await worker.fetch(new Request(`https://app.test/s/${token}/status`), env, ctx)).json();
assert.equal(st.counts.sales_days, 2); assert.equal(st.counts.items, 1);
assert.equal(st.steps.find((x) => x.key === 'items').done, true);
assert.equal(st.ready, false);
await worker.fetch(new Request(`https://app.test/s/${token}/done`, { method: 'POST', body: JSON.stringify({ count: 4 }) }), env, ctx);
assert.ok(lastTo(100).body.text.includes('uploaded 4 files'));

// Telegram: a stranger gets a hint, nothing else
await handleUpdate(env, { message: { message_id: 2, chat: { id: 555, type: 'private' }, text: 'hello' } });
assert.ok(lastTo(555).body.text.includes('open the setup link'));
await handleUpdate(env, { message: { message_id: 3, chat: { id: 555, type: 'private' }, text: '/sales' } });
assert.ok(!lastTo(555).body.text.includes('$'), 'strangers never see store data');

// the store owner taps Connect Telegram
await handleUpdate(env, { message: { message_id: 4, chat: { id: 777, type: 'private' }, text: `/start ${token}` } });
assert.ok(lastTo(777).body.text.includes('connected to <b>Casper Smoke Shop</b>'));
assert.ok(sent.some((m) => String(m.body.chat_id) === '100' && /connected Telegram/.test(m.body.text)));

// sends an invoice photo
await handleUpdate(env, { message: { message_id: 5, chat: { id: 777, type: 'private' }, photo: [{ file_id: 'a', file_size: 10 }, { file_id: 'b', file_size: 2000 }] } });
let m = lastTo(777);
assert.ok(m.body.text.startsWith('✅ Saved as an invoice'), m.body.text);
const fileId = Number(m.body.reply_markup.inline_keyboard[0][0].callback_data.split(':')[1]);
// it was actually a deal sheet
await handleUpdate(env, { callback_query: { id: 'q2', data: `sk:${fileId}:deals`, message: { message_id: 9, chat: { id: 777 } } } });
m = lastTo(777);
assert.equal(m.method, 'editMessageText'); assert.ok(m.body.text.startsWith('✅ Saved as a deal sheet'));
assert.equal(raw.prepare('SELECT kind FROM store_files WHERE id=?').get(fileId).kind, 'deals');
// a CSV with no clue asks what it is
await handleUpdate(env, { message: { message_id: 6, chat: { id: 777, type: 'private' }, document: { file_id: 'c', file_name: 'data.csv', mime_type: 'text/csv', file_size: 50 } } });
assert.ok(lastTo(777).body.text.includes('What is this file?'));
// a question goes to the owner
await handleUpdate(env, { message: { message_id: 7, chat: { id: 777, type: 'private' }, text: 'Where do I find my item list in Clover?' } });
assert.ok(lastTo(100).body.text.includes('Where do I find my item list'));
// another store's button can't touch this store's files
await handleUpdate(env, { callback_query: { id: 'q3', data: `sk:${fileId}:items`, message: { message_id: 9, chat: { id: 555 } } } });
assert.equal(raw.prepare('SELECT kind FROM store_files WHERE id=?').get(fileId).kind, 'deals');

// email intake
res = await worker.fetch(new Request('https://app.test/ingest/store?code=QLB-0002&file=inv_4471.pdf&kind=invoice', { method: 'POST', headers: { 'x-ingest-key': 'K', 'content-type': 'application/pdf' }, body: new Uint8Array([1, 2, 3]) }), env, ctx);
assert.equal((await res.json()).kind, 'invoice');
res = await worker.fetch(new Request('https://app.test/ingest/store?code=QLB-0002&file=x.pdf', { method: 'POST', headers: { 'x-ingest-key': 'nope' }, body: 'x' }), env, ctx);
assert.equal(res.status, 401);
res = await worker.fetch(new Request('https://app.test/ingest/store?code=QLB-0001&file=x.pdf', { method: 'POST', headers: { 'x-ingest-key': 'K' }, body: 'x' }), env, ctx);
assert.equal(res.status, 404, 'Discount Liquor never goes through store intake');

const store = raw.prepare('SELECT * FROM stores WHERE id=?').get(s.id);
const ob = await onboarding(db, store);
assert.equal(ob.steps[0].done, true); assert.equal(ob.counts.invoice, 1); assert.equal(ob.counts.deals, 1);
fs.writeFileSync(new URL('../test/.intake_page.html', import.meta.url), intakePage(store, ob, await recentFiles(db, store.id), { botUser: 'QilboBot', email: storeEmail(env.INTAKE_INBOX, store.code) }));

// declined stores lose access
await decideStore(db, s.id, 'decline');
assert.equal((await worker.fetch(new Request(`https://app.test/s/${token}`), env, ctx)).status, 404);
console.log('intake tests passed');
