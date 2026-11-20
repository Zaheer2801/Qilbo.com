// Shelf labels: finding items, sizes, UPCs, the PDF, and the Telegram flow.
// Usage: node test/labels.test.js [path/to/store.db]   (defaults to a small built-in fixture)
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import assert from 'assert';
import { findLabelItems, labelPdf, parseSize, upc12, upcModules, labelDate } from '../src/labels.js';
import { handleUpdate } from '../src/telegram.js';

let raw;
if (process.argv[2]) raw = new DatabaseSync(process.argv[2]);
else {
  raw = new DatabaseSync(':memory:');
  raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const ins = raw.prepare('INSERT INTO products(id, name, size, category, sub_category, price, price_source, active) VALUES (?,?,?,?,?,?,?,1)');
  ins.run(701, "Seagram's Extra Dry Gin 750ml", '750ml', 'Spirits', 'Gin', 18.99, 'manual');
  ins.run(1281, 'Seagrams Extra Dry gin 375 ml', '375ml', 'Spirits', 'Gin', 10.49, 'register');
  ins.run(1365, "Seagram's Distiller's Reserve Gin 750 ml", '750ml', 'Spirits', 'Gin', 16.63, 'estimated');
  ins.run(560, "Seagram's Ginger Ale 20 Oz", null, 'Beer & RTD', 'Beer', 1.86, 'estimated');
  ins.run(900, 'Seagram Gin Pint No Price', null, 'Spirits', 'Gin', null, null);
  raw.prepare('INSERT INTO product_upcs(upc, product_id) VALUES (?,?)').run('80432401231', 701);
  raw.prepare('INSERT INTO product_upcs(upc, product_id) VALUES (?,?)').run('80432000175', 1281);
}
const stmt = (sql) => ({ _b: [], bind(...a) { this._b = a; return this; },
  first() { return raw.prepare(sql).get(...this._b) || null; }, all() { return { results: raw.prepare(sql).all(...this._b) }; },
  run() { const r = raw.prepare(sql).run(...this._b); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } });
const db = { prepare: stmt, batch: async (l) => l.map((x) => x.run()) };

// helpers
assert.equal(upc12('80432401231'), '080432401231');
assert.equal(upc12('080432000175'), '080432000175');
assert.equal(upc12('123'), null);
assert.equal(upcModules('080432401231').length, 95);
assert.deepEqual(parseSize({ size: '1.75L' }).unit, 'L');
assert.ok(Math.abs(parseSize({ size: '750ml' }).oz - 25.36) < 0.01);
assert.equal(parseSize({ name: 'Natural Ice 4pk' }).unit, 'PK');
assert.equal(labelDate('2026-11-20'), '11/20/26');

// search
let items = await findLabelItems(db, "seagram's gin");
assert.ok(items.length >= 3, 'finds the Seagram gins');
assert.ok(items.every((i) => /SEAGRAM/.test(i.name) && !/\d+\s*ML/.test(i.name)), 'size is taken out of the name');
const s375 = await findLabelItems(db, 'seagram gin 375');
assert.ok(s375.length >= 1 && s375.every((i) => i.size?.num === '375'), 'size narrows');
const big = items.find((i) => i.size?.num === '750' && /EXTRA DRY/.test(i.name));
assert.equal(big.upc, '080432401231');

// pdf
const pdf = labelPdf(items.filter((i) => i.price), { date: '11/20/26', title: 'Shelf labels: seagram gin' });
const txt = new TextDecoder().decode(pdf);
assert.ok(txt.startsWith('%PDF-1.4') && txt.trimEnd().endsWith('%%EOF'));
assert.ok(txt.includes(`(${Number(items[0].price).toFixed(2)}) Tj`) && txt.includes('(DISCOUNT LIQUOR) Tj'));
assert.ok(!items.some((i) => /GINGER/.test(i.name)), 'gin does not match ginger');
const xref = Number(txt.match(/startxref\n(\d+)/)[1]);
assert.equal(txt.slice(xref, xref + 4), 'xref', 'xref offset is right');
fs.writeFileSync(new URL('./.labels_sample.pdf', import.meta.url), pdf);

// telegram flow (owner chat)
const sent = [];
globalThis.fetch = async (url, opt = {}) => {
  const method = String(url).split('/').pop();
  if (opt.body instanceof FormData) {
    const doc = opt.body.get('document');
    sent.push({ method, chat: opt.body.get('chat_id'), caption: opt.body.get('caption'), file: doc.name, size: doc.size });
  } else sent.push({ method, body: opt.body ? JSON.parse(opt.body) : {} });
  return Response.json({ ok: true, result: { message_id: 1 } });
};
const env = { DB: db, OWNER_CHAT_ID: '100', TELEGRAM_BOT_TOKEN: 'T' };
const msg = (text) => handleUpdate(env, { message: { message_id: 1, chat: { id: 100, type: 'private' }, text } });

await msg('🏷 Labels');
assert.ok(sent.at(-1).body.text.includes('Which items?'));
await msg('seagram gin');
let doc = sent.findLast((m) => m.method === 'sendDocument');
assert.ok(doc && doc.file.startsWith('labels_seagram_gin_') && doc.size > 1000, 'PDF sent');
assert.ok(/label/.test(doc.caption));
if (!process.argv[2]) {
  assert.ok(doc.caption.includes('Check these prices'), 'estimated price flagged');
  assert.ok(doc.caption.includes('no barcode'), 'missing UPC flagged');
}
const before = sent.length;
await msg('labels nothingmatchesthis');
assert.ok(sent.at(-1).body.text.includes('No items found'));
await msg('/labels seagram 375');
assert.ok(sent.slice(before).some((m) => m.method === 'sendDocument'));
console.log(doc.caption);
console.log('labels tests passed');
