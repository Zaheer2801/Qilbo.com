// New store sign-up: saving, validation, honeypot, rate limit, approve/decline.
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import assert from 'assert';
import { saveSignup, listStores, decideStore, signupAlert, joinPage } from '../src/signup.js';

const raw = new DatabaseSync(':memory:');
raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
for (const st of fs.readFileSync(new URL('../migrate/v7_store_signups.sql', import.meta.url), 'utf8').split(';').map((x) => x.trim()).filter((x) => x && !x.startsWith('--') || x.includes('ALTER') || x.includes('UPDATE') || x.includes('CREATE'))) {
  try { raw.exec(st); } catch (e) { if (!/duplicate column/.test(e.message)) throw e; }
}
const db = { prepare: (sql) => ({ _b: [], bind(...a) { this._b = a; return this; },
  first() { return raw.prepare(sql).get(...this._b) || null; }, all() { return { results: raw.prepare(sql).all(...this._b) }; },
  run() { const r = raw.prepare(sql).run(...this._b); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }) };

const good = { store_name: 'Casper Smoke Shop', store_type: 'Smoke & vape shop', city: 'Eustis', state: 'fl', zip: '32726', owner_name: 'Zaheer',
  phone: '(334) 220-2926', email: 'x@y.com', pos: 'Clover', registers: '2', distributors: ['Core-Mark / McLane', 'Nope'], problems: ['Best sellers run out'],
  alerts: ['Telegram', 'WhatsApp (coming soon)'], goal_spirits: '40', agree: true };

const bad = await saveSignup(db, { store_name: '' }, '1.1.1.1');
assert.equal(bad.ok, false); assert.ok(bad.errors.length >= 4);
const bot = await saveSignup(db, { ...good, website: 'spam' }, '1.1.1.1');
assert.equal(bot.ok, true); assert.equal(raw.prepare('SELECT COUNT(*) n FROM stores').get().n, 1, 'honeypot saves nothing');

const r = await saveSignup(db, good, '1.1.1.1');
assert.equal(r.ok, true); assert.equal(r.code, 'QLB-0002');
const row = raw.prepare('SELECT * FROM stores WHERE id=?').get(r.id);
assert.equal(row.status, 'pending'); assert.equal(row.state, 'FL'); assert.equal(row.store_type, 'smoke');
const prof = JSON.parse(row.profile);
assert.deepEqual(prof.distributors, ['Core-Mark / McLane']); assert.deepEqual(prof.alerts, ['Telegram']); assert.equal(prof.margin_goals.spirits, 40);
console.log(signupAlert(r));

for (let i = 0; i < 5; i++) await saveSignup(db, good, '2.2.2.2');
const limited = await saveSignup(db, good, '2.2.2.2');
assert.equal(limited.ok, false, 'rate limited after 5 an hour');

const list = await listStores(db);
assert.ok(list[0].status === 'pending' && !('signup_ip' in list[0]));
assert.equal((await decideStore(db, r.id, 'approve')).status, 'pilot');
await assert.rejects(() => decideStore(db, 1, 'decline'), /Not allowed/);
assert.ok(joinPage().includes('Register your store'));
console.log('signup tests passed');
