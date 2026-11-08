// Daily NRS sales CSV ingest + invoice staging & posting for Discount Liquor
import { normUpc, TAX, addDays } from './db.js';

export function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) {
    row.push(cur);
    if (row.some(x => x !== '')) rows.push(row);
  }
  return rows;
}

// Daily_Sales_Report_87287_2026-11-05.csv -> 2026-11-05
export function dateFromFilename(name) {
  const m = String(name || '').match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// Extract size and clean name from raw product text
export function extractSizeAndCleanName(name) {
  const sizePattern = /(\b\d+(?:\.\d+)?\s*(?:ml|lt|l|oz|fl\s*oz|ct|pk|pack)\b|\b\d+[- ](?:pack|pk)\b)/i;
  const match = String(name || '').match(sizePattern);
  if (match) {
    const size = match[0].trim();
    const clean = name.replace(match[0], '').replace(/\s+/g, ' ').replace(/^[\s,:-]+|[\s,:-]+$/g, '');
    return { clean_name: clean || name, size };
  }
  return { clean_name: name || '', size: null };
}

// Category and Department classification rules from Qilbo NRS parser
export function classifyProduct(name, unitPrice = 0) {
  const lower = String(name || '').toLowerCase();

  // 1. Cutwaters & Ready-to-Drink
  if (["cutwater", "cut water", "clubtails", "buzzballz", "high noon", "cayman jack", "monaco", "beatbox", "tiki rum", "white russian"].some(k => lower.includes(k))) {
    return { department: "Liquor", sub_category: "Cutwaters & Ready-to-Drink", category: "Beer/RTD" };
  }
  // 2. Tequila
  if (["tequila", "don julio", "patron", "corralejo", "casamigos", "el mayor", "lunazul", "margaritaville", "cuervo", "herradura", "1800", "reposado", "blanco", "anejo", "añejo"].some(k => lower.includes(k))) {
    return { department: "Liquor", sub_category: "Tequila", category: "Liquor" };
  }
  // 3. Cognac & Brandy
  if (["cognac", "hennessy", "remy martin", "courvoisier", "martell", "brandy", "e&j", "paul masson"].some(k => lower.includes(k))) {
    return { department: "Liquor", sub_category: "Cognac & Brandy", category: "Liquor" };
  }
  // 4. Whiskey & Bourbon
  if (["whisky", "whiskey", "bourbon", "scotch", "fireball", "jim beam", "crown royal", "jack daniel", "makers mark", "woodford", "jameson"].some(k => lower.includes(k))) {
    return { department: "Liquor", sub_category: "Whiskey & Bourbon", category: "Liquor" };
  }
  // 5. Vodka
  if (["vodka", "amsterdam", "crystal palace", "tito", "grey goose", "ciroc", "smirnoff", "absolut", "ketel"].some(k => lower.includes(k))) {
    return { department: "Liquor", sub_category: "Vodka", category: "Liquor" };
  }
  // 6. Rum
  if (["rum", "bacardi", "captain morgan", "malibu"].some(k => lower.includes(k))) {
    return { department: "Liquor", sub_category: "Rum", category: "Liquor" };
  }
  // 7. Gin
  if (["gin", "tanqueray", "bombay", "beefeater", "hendrick"].some(k => lower.includes(k))) {
    return { department: "Liquor", sub_category: "Gin", category: "Liquor" };
  }
  // 8. Cordials, Shooters, & 99s
  if (["99 ", "99 pink", "99 sour", "99 proof", "schnapps", "baileys", "kahlua", "jagermeister", "benjamin banana"].some(k => lower.includes(k))) {
    return { department: "Liquor", sub_category: "Cordials & Shooters", category: "Liquor" };
  }
  // 9. Beer & Malt Beverages
  if (["beer", "bud", "busch", "modelo", "corona", "heineken", "miller", "rolling rock", "natural ice", "colt 45", "chelada", "twisted tea", "warity"].some(k => lower.includes(k))) {
    return { department: "Beer", sub_category: "Beer & Malt", category: "Beer/RTD" };
  }
  // 10. Tobacco & Cigars
  if (["cigar", "cigarette", "menthol", "305", "seneca", "camel", "dutch masters", "tobacco", "newport", "marlboro"].some(k => lower.includes(k))) {
    return { department: "Tobacco", sub_category: "Tobacco & Cigars", category: "Tobacco" };
  }
  // 11. Beverages (Non-Alcoholic)
  if (["soda", "cola", "tea", "water", "pepsi", "coca", "fanta", "red bull", "powerade", "welch", "sunkist", "ginger beer", "alani", "saratoga", "lipton"].some(k => lower.includes(k))) {
    return { department: "Beverages", sub_category: "Non-Alcoholic", category: "Grocery" };
  }
  // 12. Wine & Sangria
  if (["wine", "sangria", "crimes", "rossi", "chardonnay", "cabernet", "moscato", "san antonio"].some(k => lower.includes(k))) {
    return { department: "Wine", sub_category: "Wine & Sangria", category: "Wine" };
  }
  // 13. Lottery / Scratchers
  if (["lottery", "scratch", "cash", "blowout", "bingo", "power 20", "black pearls", "lucky buks", "wild 9s", "100 x", "spectaculer"].some(k => lower.includes(k))) {
    return { department: "Lottery", sub_category: "Scratch-Off", category: "Lottery" };
  }

  // Fallback
  if (unitPrice >= 12.0) {
    return { department: "Liquor", sub_category: "Other Spirits", category: "Liquor" };
  }
  return { department: "General Merchandise", sub_category: "General", category: "Grocery" };
}

const TOP_SHELF_KEYWORDS = [
  "cognac", "hennessy", "remy martin", "courvoisier", "martell",
  "tequila", "don julio", "patron", "corralejo", "casamigos", "clase azul",
  "el mayor", "lunazul", "herradura", "1800",
  "scotch", "whisky", "whiskey", "bourbon", "macallan", "glenfiddich",
  "woodford", "johnnie walker", "crown royal", "makers mark", "jim beam",
  "grey goose", "ciroc", "belvedere", "chopin"
];

export function isTopShelfItem(name, department, subCategory, unitPrice = 0) {
  const lower = String(name || '').toLowerCase();
  if (unitPrice >= 25.0) return true;
  if (department === "Liquor" && ["Cognac & Brandy", "Tequila", "Whiskey & Bourbon"].includes(subCategory) && unitPrice >= 18.0) {
    return true;
  }
  for (const kw of TOP_SHELF_KEYWORDS) {
    if (lower.includes(kw) && unitPrice >= 14.0) return true;
  }
  return false;
}

export async function ingestSalesCsv(db, csvText, saleDate, fileName) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate || '')) throw new Error('missing sale date');
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ''));
  if (!rows.length) throw new Error('empty CSV');
  const head = rows.shift().map(h => h.trim().toLowerCase());
  const iU = head.indexOf('upc');
  const iN = head.indexOf('name');
  const iQ = head.findIndex(h => h.includes('qty'));
  const iA = head.findIndex(h => h.includes('amount'));
  if (iN < 0 || iQ < 0 || iA < 0) throw new Error('unexpected CSV header: ' + head.join(','));

  // Load all known barcodes into memory (one bulk query far under D1 limits)
  const known = new Map((await db.prepare('SELECT x.upc, x.product_id, p.category FROM product_upcs x JOIN products p ON p.id=x.product_id').all())
    .results.map(r => [r.upc, r]));
  const lookup = u => known.get(u) || known.get(u.slice(0, -1));

  const items = [], depts = new Map(), unknown = new Map();
  for (const r of rows) {
    const rawUpc = r[iU];
    const upc = normUpc(rawUpc);
    const name = (r[iN] || '').trim();
    const qty = parseFloat(r[iQ]) || 0;
    const amt = parseFloat(r[iA]) || 0;

    if (!upc) {
      if (!name) continue;
      const d = depts.get(name) || { qty: 0, amt: 0 };
      d.qty += qty;
      d.amt += amt;
      depts.set(name, d);
      continue;
    }

    items.push({ upc, name, qty, amt });
    if (!lookup(upc) && !unknown.has(upc)) {
      unknown.set(upc, { name, qty, amt });
    }
  }

  // Create products for barcodes never seen before
  if (unknown.size) {
    const ins = [...unknown].map(([upc, item]) => {
      const { clean_name, size } = extractSizeAndCleanName(item.name);
      const unitPrice = item.qty > 0 && item.amt > 0 ? +(item.amt / item.qty / (1 + TAX)).toFixed(2) : null;
      const cents = unitPrice != null ? Math.round(unitPrice * 100) % 100 : null;
      const isClean = cents === 99 || cents === 49 || cents === 0;
      const priceSource = isClean ? 'register' : 'estimated';
      const { department, sub_category, category } = classifyProduct(item.name, unitPrice || 0);
      const is_top_shelf = isTopShelfItem(item.name, department, sub_category, unitPrice || 0) ? 1 : 0;
      return db.prepare(`
        INSERT INTO products(name, clean_name, size, category, sub_category, department, is_top_shelf, price, price_source)
        VALUES(?,?,?,?,?,?,?,?,?) RETURNING id, category
      `).bind(item.name, clean_name, size, category, sub_category, department, is_top_shelf, unitPrice, priceSource);
    });
    const res = await db.batch(ins);
    const ups = [];
    [...unknown.keys()].forEach((upc, i) => {
      const row = res[i].results[0];
      known.set(upc, { upc, product_id: row.id, category: row.category });
      ups.push(db.prepare('INSERT OR IGNORE INTO product_upcs(upc,product_id) VALUES(?,?)').bind(upc, row.id));
    });
    await db.batch(ups);
  }

  const stmts = [
    db.prepare('DELETE FROM sales WHERE sale_date=?').bind(saleDate),
    db.prepare('DELETE FROM dept_sales WHERE sale_date=?').bind(saleDate)
  ];

  let storeSalesTotal = 0;
  for (const it of items) {
    const k = lookup(it.upc);
    stmts.push(db.prepare(`
      INSERT INTO sales(sale_date,upc,name,qty,amount,product_id) VALUES(?,?,?,?,?,?)
      ON CONFLICT(sale_date,upc) DO UPDATE SET qty=qty+excluded.qty, amount=amount+excluded.amount
    `).bind(saleDate, it.upc, it.name, it.qty, it.amt, k.product_id));

    if (k.category !== 'Lottery' && !it.upc.startsWith('798028')) {
      storeSalesTotal += it.amt;
    }
  }

  for (const [dep, d] of depts) {
    stmts.push(db.prepare('INSERT INTO dept_sales(sale_date,department,qty,amount) VALUES(?,?,?,?)').bind(saleDate, dep, d.qty, d.amt));
    if (!/lotter/i.test(dep)) {
      storeSalesTotal += d.amt;
    }
  }

  if (fileName) {
    stmts.push(db.prepare('INSERT OR REPLACE INTO processed_files(name) VALUES(?)').bind(fileName));
  }

  await db.batch(stmts);

  // Recalculate register/estimated prices for products sold (never touch manual)
  const productIds = [...new Set(items.map(it => lookup(it.upc)?.product_id).filter(Boolean))];
  if (productIds.length) {
    const from60 = addDays(saleDate, -60);
    const singleSales = (await db.prepare(`
      SELECT product_id, amount, COUNT(DISTINCT sale_date) as day_cnt, MAX(sale_date) as latest_date
      FROM sales
      WHERE product_id IN (${productIds.map((_, i) => '?' + (i + 2)).join(',')})
        AND (qty = 1.0 OR qty = 1) AND amount > 0 AND sale_date >= ?1
      GROUP BY product_id, amount
      ORDER BY day_cnt DESC, latest_date DESC
    `).bind(from60, ...productIds).all()).results;

    const bestSingle = new Map();
    for (const r of singleSales) {
      if (!bestSingle.has(r.product_id)) {
        bestSingle.set(r.product_id, r);
      }
    }

    const priceUpdates = [];
    for (const pid of productIds) {
      const match = bestSingle.get(pid);
      if (match) {
        const cleanPrice = +(match.amount / (1 + TAX)).toFixed(2);
        const source = match.day_cnt >= 2 ? 'register' : 'estimated';
        priceUpdates.push(db.prepare(`
          UPDATE products
          SET price = CASE WHEN price_source = 'manual' THEN price ELSE ? END,
              price_source = CASE WHEN price_source = 'manual' THEN 'manual' ELSE ? END
          WHERE id = ?
        `).bind(cleanPrice, source, pid));
      } else {
        priceUpdates.push(db.prepare(`
          UPDATE products
          SET price = CASE WHEN price_source = 'manual' THEN price
                           ELSE (SELECT ROUND(SUM(amount) / SUM(qty) / 1.07, 2) FROM sales WHERE product_id=? AND sale_date>=?) END,
              price_source = CASE WHEN price_source = 'manual' THEN 'manual' ELSE 'estimated' END
          WHERE id = ? AND (SELECT COUNT(*) FROM sales WHERE product_id=? AND sale_date>=?) > 0
        `).bind(pid, from60, pid, pid, from60));
      }
    }
    if (priceUpdates.length) await db.batch(priceUpdates);
  }

  return {
    date: saleDate,
    items: items.length,
    departments: depts.size,
    new_products: unknown.size,
    store_sales: +storeSalesTotal.toFixed(2)
  };
}

// ---------- Invoices ----------
export async function loadMatchers(db, distributor) {
  const [u, c, p] = await db.batch([
    db.prepare('SELECT upc, product_id FROM product_upcs'),
    db.prepare('SELECT code, product_id FROM product_codes WHERE distributor=?').bind(distributor || ''),
    db.prepare("SELECT id, name, clean_name, size FROM products WHERE active=1 AND category NOT IN ('Lottery','Grocery','Tobacco')"),
  ]);
  return {
    upc: new Map(u.results.map(r => [r.upc, r.product_id])),
    code: new Map(c.results.map(r => [r.code, r.product_id])),
    products: p.results,
    byId: new Map(p.results.map(r => [r.id, r]))
  };
}

const STOP = new Set(['b12', 'b24', 'b6', 'b48', 'b120', 'p120', 'p60', 'ml', 'l', 'the', 'and', 'w', 'tequila', 'vodka', 'whiskey', 'rum', 'gin', 'cognac', 'brandy', '80', '70', '100']);
function tokens(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').split(' ').filter(w => w && !STOP.has(w) && !/^\d+(ml|l)?$/.test(w));
}
function sizeKey(t) {
  const m = String(t || '').toLowerCase().replace(/\s+/g, '').match(/(1\.75l|1\.5l|1l|3l|750|375|200|100|50)/);
  return m ? m[1] : null;
}
function similar(a, b) {
  if (Math.abs(a.length - b.length) > 2) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length] <= (Math.min(a.length, b.length) >= 8 ? 2 : 1);
}

export function fuzzyMatch(products, text) {
  const tw = tokens(text), sz = sizeKey(text);
  let best = null, bestScore = 0, second = 0;
  for (const p of products) {
    const pw = new Set(tokens((p.clean_name || p.name) + ' ' + (p.size || '')));
    const hit = tw.reduce((a, w) => a + (pw.has(w) ? 1 : (w.length >= 5 && [...pw].some(x => x.length >= 5 && similar(w, x))) ? 0.8 : 0), 0);
    if (!hit) continue;
    const psz = sizeKey((p.size || '') + ' ' + (p.clean_name || p.name));
    if (sz && psz && sz !== psz) continue;
    const score = hit / Math.max(tw.length, pw.size) + (sz && psz === sz ? 0.2 : 0);
    if (score > bestScore) { second = bestScore; bestScore = score; best = p; }
    else if (score > second) second = score;
  }
  return bestScore >= 0.5 && bestScore - second >= 0.1 ? best : null;
}

export function matchLine(m, l, distributor) {
  const u = normUpc(l.upc);
  if (u) {
    const id = m.upc.get(u) || m.upc.get(u.slice(0, -1));
    if (id) return { id, how: 'barcode' };
  }
  if (l.item_code) {
    const id = m.code.get(String(l.item_code));
    if (id) return { id, how: 'item code' };
  }
  const p = fuzzyMatch(m.products, `${l.description || ''} ${l.size || ''}`);
  return p ? { id: p.id, how: 'name' } : { id: null, how: 'new' };
}

export async function stageInvoice(db, inv, meta = {}) {
  const dist = inv.distributor || 'Unknown';
  const no = String(inv.invoice_no || 'NA-' + Date.now());
  const dup = await db.prepare('SELECT id, status FROM invoices WHERE distributor=? AND invoice_no=?').bind(dist, no).first();
  if (dup && dup.status === 'posted') return { duplicate: true, id: dup.id };
  if (dup) {
    await db.batch([
      db.prepare('DELETE FROM invoice_lines WHERE invoice_id=?').bind(dup.id),
      db.prepare('DELETE FROM invoices WHERE id=?').bind(dup.id)
    ]);
  }

  const r = await db.prepare(`
    INSERT INTO invoices(distributor, invoice_no, invoice_date, total, status, file_key, source, raw_json)
    VALUES(?,?,?,?, 'pending', ?,?,?) RETURNING id
  `).bind(dist, no, inv.invoice_date || null, inv.total ?? null, meta.file_key || null, meta.source || null, JSON.stringify(inv)).first();

  const m = await loadMatchers(db, dist);
  const stmts = [], summary = [];

  for (const l of inv.lines || []) {
    const per = Number(l.units_per_case) || null;
    let bottles = Number(l.bottles) || 0;
    if (!bottles && l.cases && per) bottles = Number(l.cases) * per;
    const unitCost = l.unit_cost ?? (l.line_total && bottles ? +(l.line_total / bottles).toFixed(4) : null);
    const mm = matchLine(m, l, dist);

    stmts.push(db.prepare(`
      INSERT INTO invoice_lines(invoice_id, product_id, description, item_code, upc, cases, bottles, unit_cost, line_total)
      VALUES(?,?,?,?,?,?,?,?,?)
    `).bind(r.id, mm.id, l.description || null, l.item_code ? String(l.item_code) : null,
      normUpc(l.upc) || null, l.cases ?? null, bottles, unitCost, l.line_total ?? null));

    summary.push({
      description: l.description,
      bottles,
      unit_cost: unitCost,
      line_total: l.line_total ?? null,
      matched: mm.id ? (m.byId.get(mm.id)?.clean_name || m.byId.get(mm.id)?.name || '(existing product)') : null,
      how: mm.how
    });
  }

  if (stmts.length) await db.batch(stmts);
  return {
    id: r.id,
    distributor: dist,
    invoice_no: no,
    invoice_date: inv.invoice_date,
    total: inv.total,
    lines: summary
  };
}

export async function postInvoice(db, invoiceId) {
  const inv = await db.prepare('SELECT * FROM invoices WHERE id=?').bind(invoiceId).first();
  if (!inv) throw new Error('invoice not found');
  if (inv.status === 'posted') return { already: true };

  const lines = (await db.prepare('SELECT * FROM invoice_lines WHERE invoice_id=?').bind(invoiceId).all()).results;
  const missing = lines.filter(l => !l.product_id && l.bottles);

  if (missing.length) {
    const res = await db.batch(missing.map(l => {
      const desc = cleanDesc(l.description || 'Unknown item');
      const { clean_name, size: extSize } = extractSizeAndCleanName(desc);
      const size = l.size || extSize || sizeFromText(desc);
      const unitCost = l.unit_cost || 0;
      const { department, sub_category, category } = classifyProduct(desc, unitCost * 1.3);
      const is_top_shelf = isTopShelfItem(desc, department, sub_category, unitCost * 1.3) ? 1 : 0;
      return db.prepare(`
        INSERT INTO products(name, clean_name, size, category, sub_category, department, is_top_shelf, distributor, case_size, cost, price_source)
        VALUES(?,?,?,?,?,?,?,?,?,?, 'estimated') RETURNING id
      `).bind(
        titleCase(desc),
        clean_name || titleCase(desc),
        size,
        category,
        sub_category,
        department,
        is_top_shelf,
        inv.distributor,
        l.cases ? Math.round(l.bottles / l.cases) : null,
        l.unit_cost
      );
    }));
    missing.forEach((l, i) => { l.product_id = res[i].results[0].id; });
  }

  const stmts = [];
  for (const l of lines) {
    if (!l.bottles || !l.product_id) continue;
    stmts.push(db.prepare('UPDATE invoice_lines SET product_id=? WHERE id=?').bind(l.product_id, l.id));
    if (l.upc) stmts.push(db.prepare('INSERT OR IGNORE INTO product_upcs(upc,product_id) VALUES(?,?)').bind(l.upc, l.product_id));
    if (l.item_code) stmts.push(db.prepare('INSERT OR IGNORE INTO product_codes(distributor,code,product_id) VALUES(?,?,?)').bind(inv.distributor, l.item_code, l.product_id));
    stmts.push(db.prepare(`
      UPDATE products SET cost=COALESCE(?,cost), distributor=COALESCE(distributor,?), case_size=COALESCE(case_size,?) WHERE id=?
    `).bind(l.unit_cost, inv.distributor, l.cases ? Math.round(l.bottles / l.cases) : null, l.product_id));
  }
  stmts.push(db.prepare("UPDATE invoices SET status='posted' WHERE id=?").bind(invoiceId));
  await db.batch(stmts);
  return { posted: true, lines: lines.length, new_products: missing.length };
}

function cleanDesc(d) {
  return String(d).replace(/\b[BP]\d{1,3}\b/g, '').replace(/\s+/g, ' ').trim();
}

export function sizeFromText(t) {
  const m = String(t || '').toUpperCase().match(/(\d+(?:\.\d+)?)\s?(ML|L)\b/);
  return m ? (m[2] === 'L' ? m[1] + 'L' : m[1] + 'ml') : null;
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
}
