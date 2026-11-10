import { DatabaseSync } from 'node:sqlite';
import { classifyProductFull } from '../src/classify.js';

const dbPath = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9925c04bd7ea3b0affe4411c7bcbd6ba9e4907d2a17ad0fd2d4a2f660155cd6b.sqlite';
const db = new DatabaseSync(dbPath);

const items = db.prepare('SELECT id, name, clean_name, size, department, brand, price FROM products WHERE sub_category = ?').all('Other Spirits – review');

console.log(`Total items to classify: ${items.length}`);

let matched = [];
let unmatched = [];

for (const it of items) {
  const res = classifyProductFull({
    name: it.name,
    cleanName: it.clean_name,
    department: it.department,
    brand: it.brand,
    unitPrice: it.price
  });

  if (res) {
    matched.push({ item: it, result: res });
  } else {
    unmatched.push(it);
  }
}

console.log(`Matched via Typo-Tolerant Engine: ${matched.length}`);
console.log(`Remaining Unmatched: ${unmatched.length}`);

console.log('\nSample Matched:');
for (const m of matched.slice(0, 15)) {
  console.log(`  [${m.result.group} > ${m.result.sub_category}] (${(m.result.confidence * 100).toFixed(0)}%) "${m.item.name}" -> brand: ${m.result.brand} | reason: ${m.result.reason}`);
}

console.log('\nUnmatched Items:');
for (const u of unmatched) {
  console.log(`  id=${u.id} | "${u.name}" | dept="${u.department}" | price=${u.price}`);
}
