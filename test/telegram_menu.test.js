// Telegram buttons and sub-menus, run against a local copy of the store database.
// Usage: node test/telegram_menu.test.js path/to/store.db
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import assert from 'assert';
import { handleUpdate, parseRange } from '../src/telegram.js';

assert.deepEqual(parseRange('11/01 to 11/15', '2026-11-17'), ['2026-11-01', '2026-11-15']);
assert.deepEqual(parseRange('Nov 3', '2026-11-17'), ['2026-11-03', '2026-11-03']);
assert.deepEqual(parseRange('2026-10-01 - 2026-10-31', '2026-11-17'), ['2026-10-01', '2026-10-31']);
assert.deepEqual(parseRange('oct 5 - oct 1', '2026-11-17'), ['2026-10-01', '2026-10-05']);
assert.equal(parseRange('hello', '2026-11-17'), null);

const path = process.argv[2];
if (!path) { console.log('parseRange ok (pass a store db to test the menus)'); process.exit(0); }
const raw = new DatabaseSync(path);
raw.exec(fs.readFileSync(new URL('../migrate/v6_brain_findings.sql', import.meta.url), 'utf8'));
const DB = {
  prepare: (sql) => ({ _b: [], bind(...a) { this._b = a; return this; },
    first() { return raw.prepare(sql).get(...this._b) || null; },
    all() { return { results: raw.prepare(sql).all(...this._b) }; },
    run() { const r = raw.prepare(sql).run(...this._b); return { meta: { changes: r.changes } }; } }),
  batch: async (s) => s.map((x) => x.run()),
};
const sent = [];
globalThis.fetch = async (url, opt) => { const body = JSON.parse(opt.body); sent.push({ method: url.split('/').pop(), body }); return new Response(JSON.stringify({ ok: true, result: {} })); };
const env = { DB, OWNER_CHAT_ID: '1', TELEGRAM_BOT_TOKEN: 'x', PUBLIC_URL: 'https://example' };
const say = (text) => handleUpdate(env, { message: { chat: { id: 1 }, text } });
const tap = (data) => handleUpdate(env, { callback_query: { id: 'q', data, message: { chat: { id: 1 }, message_id: 1 } } });
const last = () => sent.filter((s) => s.method === 'sendMessage').at(-1)?.body;
const buttons = (m) => (m?.reply_markup?.inline_keyboard || []).flat().map((x) => x.callback_data);

await say('/menu'); assert.ok(last().reply_markup.keyboard, 'menu keyboard');
await say('📊 Sales'); assert.ok(buttons(last()).includes('ms:7d'));
await tap('ms:7d'); assert.match(last().text, /sales|Sales/i); console.log('7d →', last().text.split('\n').slice(0, 2).join(' | '));
await tap('ms:custom'); await say('10/01 to 10/31'); console.log('custom →', last().text.split('\n').slice(0, 2).join(' | '));
await say('🧾 Invoices'); console.log('invoice buttons:', buttons(last()).join(', '));
await tap('mi:recent'); console.log('recent →', last().text.split('\n').slice(0, 3).join(' | '));
const dist = buttons(sent.filter((s) => s.method === 'sendMessage').at(-2).body).find((d) => d.startsWith('mid:'));
if (dist) { await tap(dist); console.log(dist, '→', last().text.split('\n').slice(0, 2).join(' | ')); }
await say('📦 Running low'); await tap('ml:out'); console.log('out →', last().text.split('\n').slice(0, 3).join(' | '));
await say('🛒 What to order'); const ob = buttons(last()); console.log('order buttons:', ob.join(', '));
if (ob.length) { await tap(ob[0]); console.log('order →', last().text.split('\n').slice(0, 3).join(' | ')); }
await say('🧠 What to fix'); await tap('mf:run'); console.log('fix →', last().text.split('\n').slice(0, 2).join(' | '));
await tap('mf:stock'); console.log('fix stock →', last().text.split('\n')[0]);
assert.ok(!sent.some((s) => /⚠️/.test(s.body.text || '')), 'no error messages: ' + (sent.find((s) => /⚠️/.test(s.body.text || ''))?.body.text));
console.log('telegram menu tests passed');
