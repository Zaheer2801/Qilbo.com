// Qilbo brain: nightly checks that turn sales, invoices and stock into a short list of findings.
// Read-only toward the store: it never changes the register or places orders. It suggests, the owner decides,
// and the next night's data shows whether the fix happened (approved -> verified).
//
// Engines in this file (Phase 1):
//   price   – $0 rings, selling under cost, under the margin goal, cost went up but price didn't,
//             sizes priced out of step, ringing under the shelf price
//   invoice – deliveries short of what was ordered, new items received that never rang up
//   stock   – best sellers out or about to run out, money stuck in dead stock
// Engines still to come: loss, customer, ops, compliance (see docs/brain-engines.md).

import { TAX, todayLocal, addDays, getSetting } from './db.js';
import { inventory } from './db.js';

const STORE = 1;

// ---------- small helpers ----------
export function sizeMl(size) {
  const m = String(size || '').toUpperCase().replace(/\s+/g, '').match(/(\d+(?:\.\d+)?)(ML|L|OZ)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2] === 'L') return Math.round(n * 1000);
  if (m[2] === 'OZ') return Math.round(n * 29.5735);
  return n;
}

// Shelf prices end in .99 (and .49 under $3), never below the target.
export function priceAtMargin(cost, target) {
  if (!(cost > 0)) return null;
  const raw = cost / (1 - target);
  if (raw < 3) {
    const half = Math.ceil(raw * 2) / 2 - 0.01;
    return +(half >= raw ? half : half + 0.5).toFixed(2);
  }
  const p = Math.ceil(raw) - 0.01;
  return +(p >= raw ? p : p + 1).toFixed(2);
}

export const money = (n) => (n == null ? '—' : '$' + Number(n).toFixed(2));
const pct = (n) => (n == null ? '—' : Math.round(n * 100) + '%');
const label = (p) => {
  const n = String(p.clean_name || p.name || '').trim();
  const sz = String(p.size || '').trim();
  const squash = (x) => x.toLowerCase().replace(/\s+/g, '');
  return sz && !squash(n).includes(squash(sz)) ? `${n} ${sz}` : n;
};

// Margin goal per category. Spirits default to the store goal (35%); beer, wine and mixers run thinner.
// Each can be changed in settings: margin_target, margin_target_beer, margin_target_wine, margin_target_other.
function targetFor(ctx, category) {
  const c = String(category || '').toLowerCase();
  if (/beer|rtd/.test(c)) return ctx.targets.beer;
  if (/wine/.test(c)) return ctx.targets.wine;
  if (/spirit|liquor|whisk|vodka|tequila|rum|gin|cognac|brandy/.test(c) || !c) return ctx.target;
  return ctx.targets.other;
}
const margin = (price, cost) => (price > 0 && cost != null ? (price - cost) / price : null);

// ---------- checks ----------
// Each check returns findings: { key, engine, type, severity, product_id, title, detail, action, value, data }

// $0 (or near $0) rings in the last 3 days: almost always an open-price key or a missing price.
async function zeroPriceSales(db, ctx) {
  const rows = (await db.prepare(`SELECT s.sale_date, s.qty, s.amount, p.id, p.name, p.clean_name, p.size, p.cost, p.price
      FROM sales s JOIN products p ON p.id = s.product_id
      WHERE s.sale_date >= ? AND s.qty > 0 AND s.amount <= 0.01 AND COALESCE(p.category,'') <> 'Lottery'`)
    .bind(addDays(ctx.today, -3)).all()).results;
  return rows.map((r) => ({
    key: `price:zero_price_sale:${r.id}:${r.sale_date}`,
    engine: 'price', type: 'zero_price_sale', severity: 1, product_id: r.id,
    title: `${label(r)} rang up at $0.00`,
    detail: `${r.qty} sold on ${r.sale_date} for $0.00. Your cost is ${money(r.cost)} a bottle${r.price ? `, shelf price ${money(r.price)}` : ''}.`,
    action: `Check the register item: set its price${r.price ? ` back to ${money(r.price)}` : ''} and make sure it isn't on an open-price key.`,
    value: +((r.cost || 0) * r.qty).toFixed(2),
    data: { sale_date: r.sale_date, qty: r.qty, cost: r.cost, price: r.price },
  }));
}

// Selling under cost, by what actually rang up over the last 30 days (tax taken out).
async function belowCost(db, ctx) {
  const rows = (await db.prepare(`SELECT p.id, p.name, p.clean_name, p.size, p.cost, p.price, p.category, SUM(s.qty) q, SUM(s.amount) a
      FROM sales s JOIN products p ON p.id = s.product_id
      WHERE s.sale_date >= ? AND s.amount > 0.01 AND p.cost > 0 AND COALESCE(p.category,'') NOT IN ('Lottery','Tobacco')
      GROUP BY p.id HAVING q >= 1`).bind(addDays(ctx.today, -30)).all()).results;
  const out = [];
  for (const r of rows) {
    const avg = r.a / r.q / (1 + TAX);
    if (avg >= r.cost) continue;
    const t = targetFor(ctx, r.category);
    const fix = priceAtMargin(r.cost, t);
    out.push({
      key: `price:below_cost:${r.id}`,
      engine: 'price', type: 'below_cost', severity: 1, product_id: r.id,
      title: `${label(r)} is selling under cost`,
      detail: `It rang at ${money(avg)} before tax on average over 30 days, but costs you ${money(r.cost)}. ${r.q} sold.`,
      action: `Raise the register price to ${money(fix)} (${pct(t)} margin).`,
      value: +((r.cost - avg) * r.q).toFixed(2),
      data: { avg_price: +avg.toFixed(2), cost: r.cost, qty_30d: r.q, suggested_price: fix },
    });
  }
  return out;
}

// Under the margin goal (but not under cost) on items that sell.
async function lowMargin(db, ctx) {
  const rows = (await db.prepare(`SELECT p.id, p.name, p.clean_name, p.size, p.cost, p.price, p.category, SUM(s.qty) q, SUM(s.amount) a
      FROM sales s JOIN products p ON p.id = s.product_id
      WHERE s.sale_date >= ? AND s.amount > 0.01 AND p.cost > 0 AND COALESCE(p.category,'') NOT IN ('Lottery','Tobacco')
      GROUP BY p.id HAVING q >= 2`).bind(addDays(ctx.today, -30)).all()).results;
  const out = [];
  for (const r of rows) {
    const avg = r.a / r.q / (1 + TAX);
    const m = margin(avg, r.cost);
    const t = targetFor(ctx, r.category);
    if (m == null || m < 0 || m >= t - 0.03) continue; // 3 points of slack before nagging
    const fix = priceAtMargin(r.cost, t);
    if (!fix || fix <= avg + 0.25) continue;
    out.push({
      key: `price:low_margin:${r.id}`,
      engine: 'price', type: 'low_margin', severity: m < t - 0.10 ? 1 : 2, product_id: r.id,
      title: `${label(r)} is at a ${pct(m)} margin`,
      detail: `Sells for ${money(avg)} before tax, costs ${money(r.cost)}. ${r.q} sold in 30 days. Your goal for ${r.category || 'this item'} is ${pct(t)}.`,
      action: `Move to ${money(fix)}, or keep the price if it's a traffic item you want cheap.`,
      value: +((fix - avg) * r.q).toFixed(2),
      data: { avg_price: +avg.toFixed(2), cost: r.cost, margin: +m.toFixed(3), target: t, qty_30d: r.q, suggested_price: fix },
    });
  }
  return out;
}

// Latest invoice cost is higher than the one before, and the shelf price hasn't caught up.
async function costIncrease(db, ctx) {
  const rows = (await db.prepare(`SELECT il.product_id, il.unit_cost, i.invoice_date, i.invoice_no, i.distributor
      FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
      WHERE il.product_id IS NOT NULL AND il.unit_cost > 0 AND i.status = 'posted'
      ORDER BY il.product_id, i.invoice_date DESC, il.id DESC`).all()).results;
  const byProduct = new Map();
  for (const r of rows) {
    const list = byProduct.get(r.product_id) || [];
    if (list.length < 2 && !list.some((x) => x.invoice_date === r.invoice_date && x.unit_cost === r.unit_cost)) list.push(r);
    byProduct.set(r.product_id, list);
  }
  const out = [];
  for (const [pid, [last, prev]] of byProduct) {
    if (!prev || last.invoice_date < addDays(ctx.today, -45)) continue;
    const jump = (last.unit_cost - prev.unit_cost) / prev.unit_cost;
    if (jump < 0.03) continue;
    const p = await db.prepare('SELECT id, name, clean_name, size, price, cost, category FROM products WHERE id=?').bind(pid).first();
    if (!p) continue;
    const m = margin(p.price, last.unit_cost);
    const t = targetFor(ctx, p.category);
    if (m != null && m >= t - 0.03) continue; // price already covers the new cost
    const fix = priceAtMargin(last.unit_cost, t);
    out.push({
      key: `price:cost_increase:${pid}:${last.invoice_no}`,
      engine: 'price', type: 'cost_increase', severity: 2, product_id: pid,
      title: `${label(p)} cost went up ${pct(jump)}`,
      detail: `${last.distributor || 'Distributor'} invoice ${last.invoice_no} (${last.invoice_date}): ${money(last.unit_cost)} a bottle, up from ${money(prev.unit_cost)}. Shelf price is still ${money(p.price)}${m != null ? ` (${pct(m)} margin now)` : ''}.`,
      action: `Update the shelf price to ${money(fix)}.`,
      value: 0,
      data: { new_cost: last.unit_cost, old_cost: prev.unit_cost, price: p.price, suggested_price: fix },
    });
  }
  return out;
}

// Same brand, different sizes: a smaller bottle should never be cheaper per ml than a bigger one.
async function sizeLadder(db, ctx) {
  const rows = (await db.prepare(`SELECT id, name, clean_name, size, price, brand FROM products
      WHERE active = 1 AND price > 0 AND clean_name IS NOT NULL AND size IS NOT NULL AND COALESCE(category,'') <> 'Lottery'`).all()).results;
  const groups = new Map();
  for (const r of rows) {
    const ml = sizeMl(r.size);
    if (!ml || ml < 50 || ml > 1750) continue;
    const g = String(r.clean_name).toLowerCase().trim();
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({ ...r, ml, perMl: r.price / ml });
  }
  const out = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.ml - b.ml);
    for (let i = 0; i < list.length - 1; i++) {
      const small = list[i], big = list[i + 1];
      if (small.ml === big.ml) continue;
      if (small.perMl < big.perMl * 0.98) {
        out.push({
          key: `price:size_ladder:${small.id}:${big.id}`,
          engine: 'price', type: 'size_ladder', severity: 3, product_id: small.id,
          title: `${label(small)} is cheaper per ml than the ${big.size}`,
          detail: `${small.size} at ${money(small.price)} vs ${big.size} at ${money(big.price)}. Customers get more for less in the small bottle.`,
          action: `Raise the ${small.size} to at least ${money(Math.ceil(big.perMl * small.ml) - 0.01)}.`,
          value: 0,
          data: { small: { id: small.id, size: small.size, price: small.price }, big: { id: big.id, size: big.size, price: big.price } },
        });
      }
    }
  }
  return out;
}

// Rang up under the shelf price on 2 or more sales this week: a discount, a wrong key or an old price in the register.
async function rangUnderPrice(db, ctx) {
  const rows = (await db.prepare(`SELECT p.id, p.name, p.clean_name, p.size, p.price, SUM(s.qty) q, SUM(s.amount) a
      FROM sales s JOIN products p ON p.id = s.product_id
      WHERE s.sale_date >= ? AND s.amount > 0.01 AND p.price > 0 AND p.price_source <> 'estimated'
        AND COALESCE(p.category,'') <> 'Lottery'
      GROUP BY p.id HAVING q >= 2`).bind(addDays(ctx.today, -7)).all()).results;
  const out = [];
  for (const r of rows) {
    const avg = r.a / r.q / (1 + TAX);
    const gap = r.price - avg;
    if (gap < 0.5 || gap / r.price < 0.03) continue;
    out.push({
      key: `price:rang_under:${r.id}`,
      engine: 'price', type: 'rang_under', severity: 2, product_id: r.id,
      title: `${label(r)} rang ${money(gap)} under its price`,
      detail: `Shelf price ${money(r.price)}, average rung ${money(avg)} before tax over ${r.q} sold this week.`,
      action: 'Check the register price matches the shelf, and ask staff about manual discounts.',
      value: +(gap * r.q * (30 / 7)).toFixed(2),
      data: { price: r.price, avg_price: +avg.toFixed(2), qty_7d: r.q },
    });
  }
  return out;
}

// Best sellers that are out or will be out before the next delivery; and money stuck in dead stock.
async function stockChecks(db, ctx) {
  const inv = await inventory(db, { onlyTracked: true });
  const out = [];
  for (const r of inv) {
    const name = label(r);
    if ((r.status === 'OUT' || r.status === 'REORDER') && r.per_week > 0) {
      const lostWeek = (r.per_week || 0) * (r.price || 0) * (r.status === 'OUT' ? 1 : 0.3);
      out.push({
        key: `stock:${r.status === 'OUT' ? 'out' : 'low'}:${r.id}`,
        engine: 'stock', type: r.status === 'OUT' ? 'out_of_stock' : 'running_low', severity: r.status === 'OUT' ? 1 : 2, product_id: r.id,
        title: r.status === 'OUT' ? `${name} is out of stock` : `${name} is running low`,
        detail: `${r.on_hand ?? 0} left, sells about ${r.per_week} a week.`,
        action: `Order ${r.suggested_cases || 1} case${(r.suggested_cases || 1) > 1 ? 's' : ''}${r.distributor ? ` from ${r.distributor}` : ''}.`,
        value: +(lostWeek * 4.3).toFixed(2),
        data: { on_hand: r.on_hand, per_week: r.per_week, suggested_cases: r.suggested_cases, distributor: r.distributor },
      });
    }
    if (r.status === 'NOT SELLING' && (r.stock_value || 0) >= 50) {
      out.push({
        key: `stock:dead:${r.id}`,
        engine: 'stock', type: 'dead_stock', severity: 3, product_id: r.id,
        title: `${name}: ${money(r.stock_value)} sitting unsold`,
        detail: `${r.on_hand} on hand and no sales in 60 days.`,
        action: 'Move it to the counter or eye level, bundle it, or mark it down. Stop reordering it.',
        value: +((r.stock_value || 0) * 0.02).toFixed(2), // carrying cost, about 2% a month
        data: { on_hand: r.on_hand, stock_value: r.stock_value },
      });
    }
  }
  return out;
}

// Ordered vs delivered: an invoice that brought fewer bottles than the purchase order asked for.
async function shortDeliveries(db, ctx) {
  const pos = (await db.prepare(`SELECT po.id, po.distributor, po.ordered_at, pl.product_id, COALESCE(pl.bottles, pl.cases * COALESCE(p.case_size, p.units_per_case, 12)) ordered,
        p.name, p.clean_name, p.size, p.cost
      FROM purchase_orders po JOIN purchase_order_lines pl ON pl.po_id = po.id JOIN products p ON p.id = pl.product_id
      WHERE po.status = 'ordered' AND po.ordered_at >= ?`).bind(addDays(ctx.today, -21)).all()).results;
  const out = [];
  for (const r of pos) {
    const got = await db.prepare(`SELECT COALESCE(SUM(il.bottles),0) b, MIN(i.invoice_date) d FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
        WHERE il.product_id = ? AND i.invoice_date >= substr(?,1,10) AND i.invoice_date <= ?`)
      .bind(r.product_id, r.ordered_at, addDays(String(r.ordered_at).slice(0, 10), 10)).first();
    if (!got || !got.d) continue; // not delivered yet
    if (got.b >= r.ordered) continue;
    out.push({
      key: `invoice:short:${r.id}:${r.product_id}`,
      engine: 'invoice', type: 'short_delivery', severity: 2, product_id: r.product_id,
      title: `${label(r)} came short`,
      detail: `Ordered ${r.ordered} bottles from ${r.distributor} on ${String(r.ordered_at).slice(0, 10)}, invoice shows ${got.b}.`,
      action: `Ask ${r.distributor} for the missing ${r.ordered - got.b} or a credit memo.`,
      value: +((r.ordered - got.b) * (r.cost || 0)).toFixed(2),
      data: { po_id: r.id, ordered: r.ordered, received: got.b },
    });
  }
  return out;
}

// Received on an invoice but never rang up and has no barcode: probably not set up in the POS.
async function notInPos(db, ctx) {
  const rows = (await db.prepare(`SELECT p.id, p.name, p.clean_name, p.size, p.cost, p.category, MAX(i.invoice_date) d, SUM(il.bottles) b
      FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id JOIN products p ON p.id = il.product_id
      WHERE i.invoice_date >= ? AND i.status = 'posted'
        AND NOT EXISTS (SELECT 1 FROM product_upcs u WHERE u.product_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.product_id = p.id)
      GROUP BY p.id`).bind(addDays(ctx.today, -60)).all()).results;
  return rows
    .filter((r) => r.d <= addDays(ctx.today, -3)) // give it 3 days to ring up first
    .map((r) => ({
      key: `invoice:not_in_pos:${r.id}`,
      engine: 'invoice', type: 'not_in_pos', severity: 2, product_id: r.id,
      title: `${label(r)} isn't ringing up`,
      detail: `${r.b} bottles received on ${r.d}, no barcode on file and no sales since.`,
      action: `Add it to the register with a price${r.cost ? ` (${money(priceAtMargin(r.cost, targetFor(ctx, r.category)))} for your margin goal)` : ''}, or scan its barcode in Qilbo.`,
      value: +((r.b || 0) * (r.cost || 0) * 0.02).toFixed(2),
      data: { received: r.b, last_invoice: r.d, cost: r.cost },
    }));
}

export const CHECKS = { zeroPriceSales, belowCost, lowMargin, costIncrease, sizeLadder, rangUnderPrice, stockChecks, shortDeliveries, notInPos };

// ---------- the nightly run ----------
export async function runBrain(db, { today = todayLocal(), store = STORE } = {}) {
  const num = async (k, d) => parseFloat(await getSetting(db, k, String(d))) || d;
  const target = await num('margin_target', 0.35);
  const targets = { beer: await num('margin_target_beer', 0.20), wine: await num('margin_target_wine', 0.30), other: await num('margin_target_other', 0.30) };
  const ctx = { today, target, targets, store };
  const found = [];
  const errors = [];
  for (const [name, fn] of Object.entries(CHECKS)) {
    try { found.push(...(await fn(db, ctx))); }
    catch (e) { errors.push(`${name}: ${e.message || e}`); }
  }

  // A below-cost item doesn't also need a low-margin nag.
  const belowIds = new Set(found.filter((f) => f.type === 'below_cost').map((f) => f.product_id));
  const list = found.filter((f) => !(f.type === 'low_margin' && belowIds.has(f.product_id)));

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  let raised = 0, refreshed = 0;
  const seen = new Set();
  for (const f of list) {
    seen.add(f.key);
    const ex = await db.prepare('SELECT id, status FROM findings WHERE store_id=? AND key=?').bind(store, f.key).first();
    const data = JSON.stringify(f.data || {});
    if (!ex) {
      await db.prepare(`INSERT INTO findings(store_id, key, engine, type, severity, product_id, title, detail, action, value, data, last_seen)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(store, f.key, f.engine, f.type, f.severity, f.product_id ?? null, f.title, f.detail, f.action, f.value || 0, data, now).run();
      raised++;
    } else {
      // Still a problem: refresh the numbers. A problem that comes back after it was cleared reopens.
      const reopen = ex.status === 'verified' || ex.status === 'cleared';
      await db.prepare(`UPDATE findings SET severity=?, title=?, detail=?, action=?, value=?, data=?, last_seen=?,
          status = CASE WHEN ? THEN 'open' ELSE status END, resolved_at = CASE WHEN ? THEN NULL ELSE resolved_at END WHERE id=?`)
        .bind(f.severity, f.title, f.detail, f.action, f.value || 0, data, now, reopen ? 1 : 0, reopen ? 1 : 0, ex.id).run();
      refreshed++;
    }
  }

  // Problems that are gone: approved ones are verified, untouched ones simply clear.
  // Point-in-time findings ($0 sale on a date) never "go away" on their own, so they clear after 7 days.
  const open = (await db.prepare(`SELECT id, key, status, type, first_seen FROM findings WHERE store_id=? AND status IN ('open','approved')`).bind(store).all()).results;
  let closed = 0;
  for (const o of open) {
    if (seen.has(o.key)) continue;
    const next = o.status === 'approved' ? 'verified' : 'cleared';
    await db.prepare('UPDATE findings SET status=?, resolved_at=? WHERE id=?').bind(next, now, o.id).run();
    closed++;
  }

  await db.prepare('INSERT INTO brain_runs(store_id, raised, refreshed, closed, errors) VALUES (?,?,?,?,?)')
    .bind(store, raised, refreshed, closed, errors.length ? errors.join('\n') : null).run();
  return { raised, refreshed, closed, errors, total: list.length };
}

// ---------- reading and deciding ----------
export async function listFindings(db, { status = 'open', engine, limit = 100, store = STORE } = {}) {
  const conds = ['store_id = ?'];
  const binds = [store];
  if (status && status !== 'all') {
    const list = String(status).split(',');
    conds.push(`status IN (${list.map(() => '?').join(',')})`);
    binds.push(...list);
  }
  if (engine) { conds.push('engine = ?'); binds.push(engine); }
  const rows = (await db.prepare(`SELECT * FROM findings WHERE ${conds.join(' AND ')}
      ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, severity, value DESC, id DESC LIMIT ?`)
    .bind(...binds, limit).all()).results;
  return rows.map((r) => ({ ...r, data: safeJson(r.data) }));
}

export async function findingsSummary(db, store = STORE) {
  const rows = (await db.prepare(`SELECT engine, status, COUNT(*) n, ROUND(SUM(value),2) v FROM findings WHERE store_id=? GROUP BY engine, status`).bind(store).all()).results;
  const s = { open: 0, approved: 0, verified: 0, value_open: 0, value_verified: 0, by_engine: {} };
  for (const r of rows) {
    if (r.status in s) s[r.status] += r.n;
    if (r.status === 'open') s.value_open += r.v || 0;
    if (r.status === 'verified') s.value_verified += r.v || 0;
    s.by_engine[r.engine] = s.by_engine[r.engine] || {};
    s.by_engine[r.engine][r.status] = r.n;
  }
  s.value_open = +s.value_open.toFixed(2);
  s.value_verified = +s.value_verified.toFixed(2);
  return s;
}

export async function decide(db, id, decision, store = STORE) {
  const status = decision === 'approve' ? 'approved' : decision === 'skip' ? 'skipped' : decision === 'reopen' ? 'open' : null;
  if (!status) throw new Error('decision must be approve, skip or reopen');
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const r = await db.prepare('UPDATE findings SET status=?, decided_at=? WHERE id=? AND store_id=?').bind(status, now, Number(id), store).run();
  if (!r.meta?.changes) throw new Error('finding not found');
  return { id: Number(id), status };
}

// The morning brief: the few findings worth acting on today, as Telegram HTML.
export async function briefText(db, { max = 6, store = STORE, engine, maxSeverity = 2 } = {}) {
  const list = (await listFindings(db, { status: 'open', limit: 50, store, engine })).filter((f) => f.severity <= maxSeverity);
  const sum = await findingsSummary(db, store);
  if (!list.length) return { text: engine ? '🧠 Nothing to fix here right now. 👌' : '🧠 <b>Qilbo brain:</b> nothing new to fix today. 👌', items: [] };
  const top = list.slice(0, max);
  const lines = top.map((f, i) => `${i + 1}. ${f.severity === 1 ? '🔴' : '🟡'} <b>${esc(f.title)}</b>\n   ${esc(f.action || '')}`);
  const text = [
    engine
      ? `🧠 <b>${({ price: '💲 Prices', invoice: '🧾 Invoices', stock: '📦 Stock' })[engine] || engine}: ${list.length} thing${list.length > 1 ? 's' : ''} to fix</b>`
      : `🧠 <b>Qilbo found ${list.length} thing${list.length > 1 ? 's' : ''} to fix</b>${sum.value_open ? ` (about ${money(sum.value_open)} a month at stake)` : ''}:`,
    '',
    ...lines,
    list.length > max ? `\n<i>…and ${list.length - max} more in the dashboard (Brain tab).</i>` : '',
    sum.verified ? `\n✅ ${sum.verified} fix${sum.verified > 1 ? 'es' : ''} verified so far.` : '',
  ].filter((l) => l !== '').join('\n');
  return { text, items: top };
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function safeJson(s) { try { return s ? JSON.parse(s) : {}; } catch { return {}; } }
