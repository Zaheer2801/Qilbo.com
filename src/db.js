// Data access + stock ledger engine for Discount Liquor (Cloudflare D1 / SQLite)
export const TZ = 'America/New_York';
export const TAX = 0.07; // Lake County FL: register amounts include 7% sales tax

export function normUpc(u) {
  return String(u || '').replace(/\D/g, '').replace(/^0+/, '');
}

export function todayLocal(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function tzOffsetHours(d = new Date()) {
  const loc = new Date(d.toLocaleString('en-US', { timeZone: TZ }));
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.round((loc - utc) / 3600000);
}

const LOTTERY_PREFIX = '798028';
export function guessCategory(name, upc = '') {
  const n = (name || '').toLowerCase();
  if (normUpc(upc).startsWith(LOTTERY_PREFIX)) return 'Lottery';
  if (/payout|scratch|lotto|lottery/.test(n)) return 'Lottery';
  if (/cigar|newport|marlboro|camel|kool|305|seneca|black ?& ?mild|swisher|american spirit|vape|pall mall|backwood/.test(n)) return 'Tobacco';
  if (/wine|moscato|stella rosa|stella |sangria|barefoot|sutter|carlo rossi|andre|arbor mist|yellow tail|xxl|\bport\b|merlot|cabernet|chardonnay|pinot|riesling|prosecco|asti/.test(n)) return 'Wine';
  if (/beer|lager|\bale\b|ipa|bud|busch|natural ice|michelob|micgelab|coors|miller|corona|modelo|heineken|stella artois|colt|steel reserve|olde english|schlitz|pabst|dos equis|tecate|victoria|pacifico|red stripe|guinness|mike|white claw|truly|twisted tea|seltzer|cut ?water|high noon|cayman jack|buzzballz|md 20|md tangy|four loko|smirnoff ice|chelada|crazy stallion/.test(n)) return 'Beer/RTD';
  if (/coca|cola|pepsi|sprite|fanta|water|juice|red ?bull|monster|gatorade|arizona|starbucks|snack|chips|candy|soda|jarritos|schweppes|sunkist|a ?& ?w|minute maid|core power|energy|nescafe|welch|tahitian/.test(n)) return 'Grocery';
  return 'Liquor';
}

// ---------- products ----------
export async function productByUpc(db, upc) {
  const u = normUpc(upc);
  if (!u) return null;
  let r = await db.prepare('SELECT p.* FROM product_upcs x JOIN products p ON p.id=x.product_id WHERE x.upc=?').bind(u).first();
  if (r) return r;
  // invoice UPCs sometimes lack the check digit (11 digits) – try both directions
  r = await db.prepare(`SELECT p.* FROM product_upcs x JOIN products p ON p.id=x.product_id
                        WHERE substr(x.upc,1,length(x.upc)-1)=? OR x.upc=substr(?,1,length(?)-1) LIMIT 1`).bind(u, u, u).first();
  return r || null;
}

export async function addUpc(db, upc, productId) {
  const u = normUpc(upc);
  if (!u) return;
  await db.prepare('INSERT OR IGNORE INTO product_upcs(upc,product_id) VALUES(?,?)').bind(u, productId).run();
}

export async function createProduct(db, p) {
  const r = await db.prepare(`INSERT INTO products(name,clean_name,size,category,department,sub_category,is_top_shelf,distributor,case_size,units_per_case,units_per_pack,cost,price,price_source)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`).bind(
    p.name,
    p.clean_name || p.name,
    p.size || null,
    p.category || guessCategory(p.name, p.upc),
    p.department || 'Liquor',
    p.sub_category || null,
    p.is_top_shelf ? 1 : 0,
    p.distributor || null,
    p.case_size || null,
    p.units_per_case || null,
    p.units_per_pack || null,
    p.cost ?? null,
    p.price ?? null,
    p.price_source || 'estimated'
  ).first();
  if (p.upc) await addUpc(db, p.upc, r.id);
  return r.id;
}

function sizeOf(text) {
  const t = (text || '').toLowerCase().replace(/\s+/g, '');
  const m = t.match(/(1\.75l|1\.75|1\.5l|1l\b|1liter|3l|750|375|200|100|50)(ml)?/);
  if (!m) return null;
  const s = m[1];
  return { '1.75l': '1.75L', '1.75': '1.75L', '1.5l': '1.5L', '1l': '1L', '1liter': '1L', '3l': '3L' }[s] || s + 'ml';
}

// Fuzzy product search with size weighting
export async function searchProducts(db, query, limit = 8) {
  const q = (query || '').toLowerCase().replace(/[^a-z0-9.\s]/g, ' ').trim();
  if (!q) return [];
  const size = sizeOf(q);
  const words = q.split(/\s+/).filter(w => w && !/^(\d+(\.\d+)?)(ml|l)?$/.test(w) && !['ml', 'the', 'of', 'bottle', 'bottles'].includes(w));
  if (!words.length && !size) return [];
  const where = words.map(() => 'lower(name) LIKE ?').join(' AND ') || '1=1';
  const binds = words.map(w => `%${w}%`);
  let rows = (await db.prepare(`SELECT * FROM products WHERE ${where} AND active=1 LIMIT 60`).bind(...binds).all()).results;
  if (!rows.length && words.length > 1) {
    const w2 = words.map(() => 'lower(name) LIKE ?').join(' OR ');
    rows = (await db.prepare(`SELECT * FROM products WHERE (${w2}) AND active=1 LIMIT 60`).bind(...binds).all()).results;
  }
  if (size) {
    const want = size.replace('ml', '');
    const sized = rows.filter(r => ((r.size || '') + ' ' + r.name).toLowerCase().replace(/\s/g, '').includes(want.toLowerCase()));
    if (sized.length) rows = sized;
  }
  const score = r => words.filter(w => r.name.toLowerCase().includes(w)).length * 10 - r.name.length / 100;
  return rows.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

// ---------- stock ledger SQL ----------
// on_hand = last physical count (or first delivery if never counted)
//         + bottles received on posted invoices after that point
//         − bottles sold after that point
//         ± adjustments after that point
//
// Noon cutoff rule:
//   Count entered < 12:00 PM local time includes that day's sales (sales_from = cdate).
//   Count entered >= 12:00 PM local time starts subtracting sales the next day (sales_from = cdate + 1 day).
export const STOCK_SQL = (where) => `
WITH lc AS (
  SELECT c.product_id, c.qty, c.counted_at,
         date(c.counted_at, ?1 || ' hours') AS cdate,
         CAST(strftime('%H', c.counted_at, ?1 || ' hours') AS INTEGER) AS chour
  FROM stock_counts c
  WHERE c.id = (SELECT c2.id FROM stock_counts c2 WHERE c2.product_id=c.product_id ORDER BY c2.counted_at DESC, c2.id DESC LIMIT 1)),
fr AS (
  SELECT l.product_id, MIN(i.invoice_date) d FROM invoice_lines l JOIN invoices i ON i.id=l.invoice_id
  WHERE i.status='posted' GROUP BY l.product_id),
base AS (
  SELECT p.*, lc.qty AS count_qty, lc.counted_at, lc.cdate, fr.d AS first_rec,
    CASE WHEN lc.product_id IS NOT NULL THEN (CASE WHEN lc.chour < 12 THEN lc.cdate ELSE date(lc.cdate,'+1 day') END)
         ELSE fr.d END AS sales_from
  FROM products p LEFT JOIN lc ON lc.product_id=p.id LEFT JOIN fr ON fr.product_id=p.id
  WHERE ${where})
SELECT b.*,
  (lc_known) AS known,
  COALESCE(b.count_qty,0)
   + COALESCE((SELECT SUM(l.bottles) FROM invoice_lines l JOIN invoices i ON i.id=l.invoice_id
       WHERE l.product_id=b.id AND i.status='posted' AND
         (CASE WHEN b.count_qty IS NOT NULL THEN i.invoice_date > b.cdate ELSE i.invoice_date >= b.first_rec END)),0) AS received,
  COALESCE((SELECT SUM(s.qty) FROM sales s WHERE s.product_id=b.id AND s.sale_date >= b.sales_from),0) AS sold,
  COALESCE((SELECT SUM(a.delta) FROM adjustments a WHERE a.product_id=b.id AND
       (CASE WHEN b.count_qty IS NOT NULL THEN a.created_at >= b.counted_at ELSE a.created_at >= b.first_rec END)),0) AS adjusted
FROM (SELECT *, (count_qty IS NOT NULL OR first_rec IS NOT NULL) AS lc_known FROM base) b`;

function finishStock(r) {
  const base = r.count_qty ?? 0;
  const received = r.received - base;
  const on_hand = r.known ? base + received - r.sold + r.adjusted : null;
  const basis = r.count_qty != null
    ? `shelf count of ${r.count_qty} on ${r.cdate}`
    : r.first_rec
    ? `deliveries since ${r.first_rec} (no shelf count yet)`
    : 'no invoice or shelf count yet';

  const needs_count = on_hand !== null && on_hand < 0;

  // Arithmetic explanation string
  let arithmetic = 'No shelf count or delivery yet – set a count below.';
  if (r.known) {
    if (r.count_qty != null) {
      arithmetic = `count ${r.count_qty} on ${r.cdate}${received ? ` + received ${received}` : ''} − sold ${r.sold} (since ${r.sales_from})${r.adjusted ? ` ${r.adjusted >= 0 ? '+' : '−'} adjusted ${Math.abs(r.adjusted)}` : ''} = ${on_hand}`;
    } else {
      arithmetic = `received ${received} (since ${r.first_rec}) − sold ${r.sold}${r.adjusted ? ` ${r.adjusted >= 0 ? '+' : '−'} adjusted ${Math.abs(r.adjusted)}` : ''} = ${on_hand}`;
    }
  }

  return {
    known: !!r.known,
    on_hand,
    basis,
    base,
    received,
    sold: r.sold,
    adjusted: r.adjusted,
    sales_from: r.sales_from,
    needs_count,
    arithmetic
  };
}

export async function stockFor(db, productId) {
  const r = await db.prepare(STOCK_SQL('p.id = ?2')).bind(String(tzOffsetHours()), productId).first();
  return r ? finishStock(r) : { known: false, on_hand: null, basis: 'unknown product', needs_count: false, arithmetic: 'Unknown product' };
}

export async function stockMany(db, where = '1=1', binds = []) {
  const rows = (await db.prepare(STOCK_SQL(where)).bind(String(tzOffsetHours()), ...binds).all()).results;
  return rows.map(r => ({ ...r, ...finishStock(r) }));
}

export async function velocity(db, productId, days = 30) {
  const from = addDays(todayLocal(), -days);
  const r = await db.prepare('SELECT COALESCE(SUM(qty),0) q, COALESCE(SUM(amount),0) a FROM sales WHERE product_id=? AND sale_date>=?').bind(productId, from).first();
  return { qty: r.q, amount: r.a, per_week: r.q / (days / 7) };
}

// Full ledger & arithmetic explanation view for a product
export async function ledger(db, productId) {
  const p = await db.prepare('SELECT * FROM products WHERE id=?').bind(productId).first();
  if (!p) return null;
  const st = await stockFor(db, productId);
  const lines = (await db.prepare(`SELECT i.invoice_date, i.distributor, i.invoice_no, l.bottles, l.unit_cost FROM invoice_lines l
     JOIN invoices i ON i.id=l.invoice_id WHERE l.product_id=? AND i.status='posted' ORDER BY i.invoice_date DESC LIMIT 10`).bind(productId).all()).results;
  const sales = (await db.prepare(`SELECT sale_date, SUM(qty) qty, SUM(amount) amount FROM sales WHERE product_id=?
     GROUP BY sale_date ORDER BY sale_date DESC LIMIT 15`).bind(productId).all()).results;
  const counts = (await db.prepare('SELECT qty, counted_at, note FROM stock_counts WHERE product_id=? ORDER BY counted_at DESC LIMIT 5').bind(productId).all()).results;
  const adjs = (await db.prepare('SELECT delta, reason, created_at FROM adjustments WHERE product_id=? ORDER BY created_at DESC LIMIT 5').bind(productId).all()).results;
  const upcs = (await db.prepare('SELECT upc FROM product_upcs WHERE product_id=?').bind(productId).all()).results.map(r => r.upc);
  const v = await velocity(db, productId);

  // Price formatting: show "~" if estimated
  const displayPrice = p.price != null ? `${p.price_source === 'estimated' ? '~' : ''}$${Number(p.price).toFixed(2)}` : '–';

  return {
    product: {
      ...p,
      display_price: displayPrice,
    },
    upcs,
    stock: st,
    velocity_30d: v,
    recent_deliveries: lines,
    recent_sales_days: sales,
    counts,
    adjustments: adjs
  };
}

export async function setCount(db, productId, qty, note) {
  await db.prepare('INSERT INTO stock_counts(product_id,qty,note) VALUES(?,?,?)').bind(productId, qty, note || null).run();
  return stockFor(db, productId);
}

export async function adjust(db, productId, delta, reason) {
  await db.prepare('INSERT INTO adjustments(product_id,delta,reason) VALUES(?,?,?)').bind(productId, delta, reason || null).run();
  return stockFor(db, productId);
}

// Complete inventory query with 6 statuses:
// OUT, REORDER, OVERSTOCK, NOT SELLING (0 in 60d), NOT COUNTED, OK
export async function inventory(db, { category, subCategory, distributor, status, isTopShelf, onlyTracked = true } = {}) {
  const from30 = addDays(todayLocal(), -30);
  const from60 = addDays(todayLocal(), -60);
  const conds = ["p.active=1", "p.category NOT IN ('Lottery','Grocery','Tobacco')"];
  const binds = [];
  if (category) { binds.push(category); conds.push(`p.category = ?${binds.length + 1}`); }
  if (subCategory) { binds.push(subCategory); conds.push(`p.sub_category = ?${binds.length + 1}`); }
  if (distributor) { binds.push(distributor); conds.push(`p.distributor = ?${binds.length + 1}`); }
  if (isTopShelf) { conds.push("p.is_top_shelf = 1"); }

  const rows = await stockMany(db, conds.join(' AND '), binds);

  // 30-day sales
  const sales30 = (await db.prepare(`SELECT product_id, SUM(qty) q, SUM(amount) a, MAX(sale_date) last FROM sales
      WHERE sale_date >= ? GROUP BY product_id`).bind(from30).all()).results;
  const sm30 = new Map(sales30.map(s => [s.product_id, s]));

  // 60-day sales for NOT SELLING check
  const sales60 = (await db.prepare(`SELECT product_id, SUM(qty) q FROM sales
      WHERE sale_date >= ? GROUP BY product_id`).bind(from60).all()).results;
  const sm60 = new Map(sales60.map(s => [s.product_id, s.q]));

  const out = [];
  for (const r of rows) {
    if (onlyTracked && !r.known) continue;
    const s30 = sm30.get(r.id) || { q: 0, a: 0, last: null };
    const q60 = sm60.get(r.id) || 0;
    const perWeek = s30.q / (30 / 7);
    const weeks = perWeek > 0 ? r.on_hand / perWeek : null;
    const rp = r.reorder_point ?? Math.max(2, Math.ceil(perWeek * 2)); // two weeks of sales

    let itemStatus = 'OK';
    if (!r.known) {
      itemStatus = 'NOT COUNTED';
    } else if (r.on_hand <= 0) {
      itemStatus = 'OUT';
    } else if (r.on_hand <= rp && perWeek > 0) {
      itemStatus = 'REORDER';
    } else if (q60 === 0) {
      itemStatus = 'NOT SELLING'; // 0 sales in 60 days
    } else if (weeks !== null && weeks > 16) {
      itemStatus = 'OVERSTOCK';
    }

    if (status && itemStatus !== status.toUpperCase()) continue;

    const avgPrice = s30.q ? s30.a / s30.q / (1 + TAX) : (r.price || null);
    const margin = avgPrice && r.cost ? (avgPrice - r.cost) / avgPrice : null;
    const displayPrice = r.price != null ? `${r.price_source === 'estimated' ? '~' : ''}$${Number(r.price).toFixed(2)}` : null;

    out.push({
      id: r.id,
      name: r.name,
      clean_name: r.clean_name || r.name,
      size: r.size,
      category: r.category,
      department: r.department,
      sub_category: r.sub_category,
      is_top_shelf: r.is_top_shelf,
      distributor: r.distributor,
      case_size: r.case_size,
      units_per_case: r.units_per_case,
      cost: r.cost,
      price: r.price,
      price_source: r.price_source || 'estimated',
      display_price: displayPrice,
      on_hand: r.on_hand,
      basis: r.basis,
      arithmetic: r.arithmetic,
      needs_count: r.needs_count,
      sold30: s30.q,
      sold60: q60,
      last_sold: s30.last,
      per_week: +perWeek.toFixed(1),
      weeks_left: weeks == null ? null : +weeks.toFixed(1),
      reorder_point: rp,
      status: itemStatus,
      avg_price: avgPrice && +avgPrice.toFixed(2),
      margin: margin == null ? null : +margin.toFixed(3),
      stock_value: r.cost ? +(Math.max(r.on_hand ?? 0, 0) * r.cost).toFixed(2) : null
    });
  }
  return out;
}

export async function salesSummary(db, start, end) {
  end = end || start;
  const tot = await db.prepare(`SELECT COALESCE(SUM(s.amount),0) amount, COALESCE(SUM(s.qty),0) qty FROM sales s
      LEFT JOIN products p ON p.id=s.product_id WHERE s.sale_date BETWEEN ? AND ? AND COALESCE(p.category,'') <> 'Lottery' AND s.upc NOT LIKE '798028%'`).bind(start, end).first();
  const dept = (await db.prepare(`SELECT department, SUM(qty) qty, SUM(amount) amount FROM dept_sales WHERE sale_date BETWEEN ? AND ?
      GROUP BY department ORDER BY amount DESC`).bind(start, end).all()).results;
  const byCat = (await db.prepare(`SELECT COALESCE(p.category,'Unknown') category, SUM(s.qty) qty, SUM(s.amount) amount FROM sales s
      LEFT JOIN products p ON p.id=s.product_id WHERE s.sale_date BETWEEN ? AND ? AND COALESCE(p.category,'') <> 'Lottery' AND s.upc NOT LIKE '798028%' GROUP BY 1 ORDER BY amount DESC`).bind(start, end).all()).results;
  const top = (await db.prepare(`SELECT COALESCE(p.clean_name,p.name,s.name) name, p.size, SUM(s.qty) qty, SUM(s.amount) amount FROM sales s
      LEFT JOIN products p ON p.id=s.product_id WHERE s.sale_date BETWEEN ? AND ? AND COALESCE(p.category,'') NOT IN ('Lottery') AND s.upc NOT LIKE '798028%'
      GROUP BY COALESCE(p.id,s.upc) ORDER BY amount DESC LIMIT 15`).bind(start, end).all()).results;
  const daily = (await db.prepare(`SELECT s.sale_date d, SUM(CASE WHEN COALESCE(p.category,'')<>'Lottery' AND s.upc NOT LIKE '798028%' THEN s.amount ELSE 0 END) amount
      FROM sales s LEFT JOIN products p ON p.id=s.product_id WHERE s.sale_date BETWEEN ? AND ? GROUP BY 1 ORDER BY 1`).bind(start, end).all()).results;
  const deptNonLotto = dept.filter(d => !/lotter/i.test(d.department)).reduce((a, d) => a + d.amount, 0);
  const cogs = await db.prepare(`SELECT COALESCE(SUM(s.qty*p.cost),0) c, COALESCE(SUM(CASE WHEN p.cost IS NOT NULL THEN s.amount END),0) a
      FROM sales s JOIN products p ON p.id=s.product_id WHERE s.sale_date BETWEEN ? AND ? AND p.cost IS NOT NULL AND COALESCE(p.category,'') <> 'Lottery' AND s.upc NOT LIKE '798028%'`).bind(start, end).first();
  const pre = cogs.a / (1 + TAX);

  // Top shelf metrics (premium liquor only; no lottery)
  const topShelf = await db.prepare(`SELECT COALESCE(SUM(s.amount),0) amount, COALESCE(SUM(s.qty),0) qty
      FROM sales s JOIN products p ON p.id=s.product_id
      WHERE s.sale_date BETWEEN ? AND ? AND p.is_top_shelf = 1 AND p.category = 'Liquor' AND s.upc NOT LIKE '798028%'`).bind(start, end).first();
  const storeSales = +(tot.amount + deptNonLotto).toFixed(2);

  return {
    start,
    end,
    store_sales: storeSales,
    scanned_items: tot.qty,
    by_category: byCat,
    departments: dept,
    top_items: top,
    daily,
    tracked_profit: +(pre - cogs.c).toFixed(2),
    tracked_margin: pre ? +((pre - cogs.c) / pre).toFixed(3) : null,
    top_shelf: {
      amount: +topShelf.amount.toFixed(2),
      qty: topShelf.qty,
      share: storeSales ? +(topShelf.amount / storeSales).toFixed(3) : 0
    }
  };
}

export async function distributorOrderSuggestions(db) {
  const inv = await inventory(db, { onlyTracked: false });
  const distributors = {
    "Southern Glazer's": { min_amount: 200, min_cases: 5, fee_threshold: 425, fee_amount: 30 },
    "Gold Coast": { min_amount: 300, min_cases: 0, fee_threshold: 0, fee_amount: 0 },
    "Florida Distributors": { min_amount: 300, min_cases: 0, fee_threshold: 0, fee_amount: 0 },
    "Breakthru": { min_amount: 0, min_cases: 0, fee_threshold: 0, fee_amount: 0 },
    "Wayne Densch": { min_amount: 0, min_cases: 0, fee_threshold: 0, fee_amount: 0, is_rep_text: true }
  };

  const groups = {};
  for (const [name, cfg] of Object.entries(distributors)) {
    groups[name] = { distributor: name, config: cfg, total_cases: 0, total_cost: 0, items: [] };
  }

  const todayStr = todayLocal();
  const todayDate = new Date(todayStr + 'T12:00:00Z');
  const isMonday = todayDate.getUTCDay() === 1;

  for (const item of inv) {
    if (!item.distributor || !groups[item.distributor]) continue;
    const v30 = item.sold30 || 0;
    if (v30 <= 0 && item.status !== 'OUT' && item.status !== 'REORDER') continue;

    const twoWeekDemand = Math.round((v30 / 30) * 14);
    const onHand = item.on_hand != null ? item.on_hand : 0;
    const caseSize = item.case_size || (item.category === 'Beer/RTD' ? 24 : 12);
    const deficit = Math.max(0, twoWeekDemand - onHand);
    if (deficit <= 0 && item.status !== 'OUT' && item.status !== 'REORDER') continue;

    let cases = Math.ceil(deficit / caseSize);
    if (cases === 0 && (item.status === 'OUT' || item.status === 'REORDER')) cases = 1;
    if (cases <= 0) continue;

    const unitCost = item.cost || (item.price ? item.price * 0.75 : 0);
    const caseCost = +(unitCost * caseSize).toFixed(2);
    const lineTotal = +(cases * caseCost).toFixed(2);

    const grp = groups[item.distributor];
    grp.total_cases += cases;
    grp.total_cost = +(grp.total_cost + lineTotal).toFixed(2);
    grp.items.push({
      product_id: item.id,
      name: item.clean_name || item.name,
      size: item.size,
      on_hand: item.on_hand,
      sold30: v30,
      two_week_demand: twoWeekDemand,
      case_size: caseSize,
      cases_suggested: cases,
      unit_cost: unitCost,
      case_cost: caseCost,
      line_total: lineTotal,
      status: item.status
    });
  }

  const result = [];
  for (const [name, grp] of Object.entries(groups)) {
    const cfg = grp.config;
    let meetsMin = true;
    let minText = '';
    let feeWarning = null;

    if (name === "Southern Glazer's") {
      meetsMin = (grp.total_cost >= cfg.min_amount) || (grp.total_cases >= cfg.min_cases);
      minText = `$${cfg.min_amount} or ${cfg.min_cases} cases`;
      if (grp.total_cost < cfg.fee_threshold && !isMonday && grp.total_cases > 0) {
        feeWarning = `$30 fee applies (orders under $${cfg.fee_threshold}, waived on Mondays)`;
      }
    } else if (cfg.min_amount > 0) {
      meetsMin = grp.total_cost >= cfg.min_amount;
      minText = `$${cfg.min_amount} minimum`;
    }

    let repText = null;
    if (name === 'Wayne Densch') {
      repText = `Order for Discount Liquor (2105 E Orange Ave, Eustis FL):\n` +
        grp.items.map(it => `• ${it.cases_suggested} cs ${it.name} ${it.size || ''}`).join('\n');
    }

    result.push({
      distributor: name,
      total_cases: grp.total_cases,
      total_cost: grp.total_cost,
      meets_minimum: meetsMin,
      minimum_rule: minText,
      fee_warning: feeWarning,
      is_monday: isMonday,
      rep_text: repText,
      items: grp.items.sort((a, b) => b.line_total - a.line_total)
    });
  }
  return result;
}

export async function getSetting(db, key, dflt = null) {
  const r = await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
  return r ? r.value : dflt;
}

export async function setSetting(db, key, value) {
  await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key, String(value)).run();
}
