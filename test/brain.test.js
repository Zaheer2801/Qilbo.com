// Brain checks against a real store database copy (or a small built-in fixture when none is given).
// Usage: node test/brain.test.js [path/to/store.db]
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import assert from 'assert';
import { runBrain, listFindings, findingsSummary, decide, briefText, priceAtMargin, sizeMl } from '../src/brain.js';

function d1(db) {
  const prepare = (sql) => ({
    _b: [], bind(...a) { this._b = a; return this; },
    first() { return db.prepare(sql).get(...this._b) || null; },
    all() { return { results: db.prepare(sql).all(...this._b) }; },
    run() { const r = db.prepare(sql).run(...this._b); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare, batch: async (s) => s.map((x) => x.run()) };
}

// pure helpers
assert.equal(priceAtMargin(21.75, 0.35), 33.99);
assert.equal(priceAtMargin(8.62, 0.35), 13.99);
assert.equal(priceAtMargin(1.38, 0.35), 2.49);
assert.equal(sizeMl('1.75L'), 1750); assert.equal(sizeMl('375 ml'), 375); assert.equal(sizeMl('50ML'), 50);

const path = process.argv[2];
const raw = path ? new DatabaseSync(path) : new DatabaseSync(':memory:');
if (!path) raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
raw.exec(fs.readFileSync(new URL('../migrate/v6_brain_findings.sql', import.meta.url), 'utf8'));
const db = d1(raw);

let today;
if (!path) {
  // tiny fixture: one $0 ring, one under-cost item, one low-margin item, one cost increase
  today = '2026-11-15';
  raw.exec(`INSERT INTO products(id,name,clean_name,size,category,cost,price,price_source) VALUES
    (1,'Crown Royal 750','Crown Royal','750ml','Whiskey',21.75,32.99,'register'),
    (2,'Hennessy VS 750','Hennessy VS','750ml','Cognac',35.25,45.99,'register'),
    (3,'Don Julio Repo 375','Don Julio Reposado','375ml','Tequila',21.75,29.99,'register'),
    (4,'Don Julio Repo 750','Don Julio Reposado','750ml','Tequila',43.5,59.99,'register'),
    (5,'Cheap Gin 375','Cheap Gin','375ml','Gin',8.0,7.99,'register')`);
  raw.exec(`INSERT INTO sales(sale_date,upc,qty,amount,product_id) VALUES
    ('2026-11-14','1',1,0,1),('2026-11-10','2',3,147.62,2),('2026-11-12','3',4,128.36,3),('2026-11-13','5',3,25.65,5)`);
  raw.exec(`INSERT INTO invoices(id,distributor,invoice_no,invoice_date,status) VALUES (1,'SG','A','2026-10-14','posted'),(2,'SG','B','2026-11-11','posted')`);
  raw.exec(`INSERT INTO invoice_lines(invoice_id,product_id,bottles,unit_cost) VALUES (1,4,6,40.00),(2,4,6,43.50)`);
} else {
  today = raw.prepare('SELECT MAX(sale_date) d FROM sales').get().d;
  today = new Date(new Date(today + 'T12:00:00Z').getTime() + 864e5).toISOString().slice(0, 10);
}

const r1 = await runBrain(db, { today });
console.log('run 1:', r1);
assert.equal(r1.errors.length, 0, r1.errors.join('\n'));
const items = await listFindings(db, { status: 'open' });
const byType = {};
for (const f of items) byType[f.type] = (byType[f.type] || 0) + 1;
console.log('by type:', byType);
for (const f of items.slice(0, 12)) console.log(`  [${f.severity}] ${f.engine}/${f.type}: ${f.title} → ${f.action} ($${f.value})`);

if (!path) {
  assert.ok(byType.zero_price_sale === 1, 'zero price sale found');
  assert.ok(byType.below_cost === 1, 'below cost found');
  assert.ok(items.some((f) => f.type === 'low_margin' && f.product_id === 3), 'Don Julio 375 low margin');
  assert.ok(byType.cost_increase === 1, 'cost increase found');
  assert.ok(!items.some((f) => f.type === 'low_margin' && f.product_id === 5), 'no double finding for below-cost item');
}

// second run: nothing new raised, same findings refreshed
const r2 = await runBrain(db, { today });
assert.equal(r2.raised, 0); assert.equal(r2.refreshed, r1.total);

// approve one, make its problem go away, run again → verified
const target = path ? (items.find((f) => f.type === 'below_cost' || f.type === 'low_margin') || items[0]) : items.find((f) => f.type === 'below_cost');
if (target) {
  await decide(db, target.id, 'approve');
  if (!path) raw.exec(`UPDATE sales SET amount = 3 * 12.99 * 1.07 WHERE product_id = 5`);
  else raw.exec(`DELETE FROM sales WHERE product_id = ${target.product_id}`);
  const r3 = await runBrain(db, { today });
  const after = raw.prepare('SELECT status FROM findings WHERE id=?').get(target.id);
  console.log('run 3:', r3, '→ approved finding is now', after.status);
  assert.equal(after.status, 'verified');
}
console.log('summary:', await findingsSummary(db));
console.log((await briefText(db)).text);
console.log('brain tests passed');
