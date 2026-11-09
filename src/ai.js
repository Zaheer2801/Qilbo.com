// Gemini AI: chat assistant with tools + invoice extraction for Discount Liquor
import {
  searchProducts,
  ledger,
  setCount,
  adjust,
  inventory,
  salesSummary,
  todayLocal,
  addDays,
  stockFor,
  stockMany,
  TAX,
  distributorOrderSuggestions
} from './db.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

let aiStats = { calls: 0, promptTokens: 0, candidateTokens: 0, totalTokens: 0 };

export function getAiStats() {
  return { ...aiStats };
}

export function resetAiStats() {
  aiStats = { calls: 0, promptTokens: 0, candidateTokens: 0, totalTokens: 0 };
}

async function gemini(env, body) {
  const model = env.GEMINI_MODEL;
  if (!model) throw new Error('GEMINI_MODEL is not configured in environment.');
  const res = await fetch(`${env.GEMINI_BASE || BASE}${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  aiStats.calls++;
  if (data.usageMetadata) {
    const p = data.usageMetadata.promptTokenCount || 0;
    const c = data.usageMetadata.candidatesTokenCount || 0;
    const t = data.usageMetadata.totalTokenCount || 0;
    aiStats.promptTokens += p;
    aiStats.candidateTokens += c;
    aiStats.totalTokens += t;
    console.log(`[Gemini AI] Call #${aiStats.calls} (${model}) | Prompt: ${p} | Candidates: ${c} | Total: ${t} tokens`);
  }
  return data;
}

// ---------------- Tools for Gemini Assistant ----------------
const T = (name, description, properties = {}, required = []) => ({ name, description, parameters: { type: 'OBJECT', properties, required } });
const S = (d) => ({ type: 'STRING', description: d });
const N = (d) => ({ type: 'NUMBER', description: d });

export const TOOLS = [
  T('search_products', 'Find products by name/size, e.g. "don julio 750". Returns ids, clean names, sizes and current stock. Always use this first to get a product_id.', { query: S('words to search') }, ['query']),
  T('explain_stock', 'Full stock history for one product: last shelf count, deliveries, daily sales, adjustments, and how on-hand was calculated. Use for "how many do I have" and "why does it show X".', { product_id: N('product id') }, ['product_id']),
  T('set_shelf_count', 'Record that the owner physically counted this many bottles on the shelf right now. Resets the stock to this number.', { product_id: N('product id'), qty: N('bottles counted'), note: S('optional note') }, ['product_id', 'qty']),
  T('adjust_stock', 'Add or remove bottles without a delivery or sale (breakage, giveaway, return, found stock). Negative to remove.', { product_id: N('product id'), delta: N('change in bottles, e.g. -1'), reason: S('why') }, ['product_id', 'delta', 'reason']),
  T('set_price', 'Change the shelf price (before tax) saved for a product.', { product_id: N('product id'), price: N('new shelf price') }, ['product_id', 'price']),
  T('sales_report', 'Store sales between two dates (yyyy-mm-dd), with categories, departments, top items, top shelf share, and profit on tracked items.', { start: S('start date'), end: S('end date (optional)') }, ['start']),
  T('product_sales', 'Daily sales of one product for the last N days.', { product_id: N('product id'), days: N('days, default 30') }, ['product_id']),
  T('inventory_status', 'Inventory list with status OUT / REORDER / OVERSTOCK / NOT SELLING / OK. Filter optional.', { status: S('one of OUT, REORDER, OVERSTOCK, NOT SELLING, OK'), distributor: S('Breakthru, Southern Glazer\'s, Gold Coast, Florida Distributors, Wayne Densch'), category: S('Liquor, Beer/RTD, Wine') }),
  T('list_invoices', 'Recent distributor invoices with totals and status.', { limit: N('how many, default 10') }),
  T('distributor_orders', 'Suggested order quantities per distributor based on 30-day velocity covering 2 weeks, rounded to cases, with distributor minimums and fees.', {})
];

async function runTool(env, name, a) {
  const db = env.DB;
  switch (name) {
    case 'search_products': {
      const rows = await searchProducts(db, a.query, 8);
      if (!rows.length) return { results: [], note: 'no product matched – try fewer words' };
      const st = await stockMany(db, `p.id IN (${rows.map((_, i) => '?' + (i + 2)).join(',')})`, rows.map(r => r.id));
      const sm = new Map(st.map(s => [s.id, s]));
      return {
        results: rows.map(p => ({
          product_id: p.id,
          name: p.clean_name || p.name,
          size: p.size,
          distributor: p.distributor,
          cost: p.cost,
          price: p.price,
          display_price: p.price != null ? `${p.price_source === 'estimated' ? '~' : ''}$${Number(p.price).toFixed(2)}${p.price_warning ? ' (price changed?)' : ''}` : null,
          price_source: p.price_source,
          price_warning: p.price_warning || null,
          on_hand: sm.get(p.id)?.on_hand ?? null,
          basis: sm.get(p.id)?.basis
        }))
      };
    }
    case 'explain_stock': {
      return await ledger(db, a.product_id) || { error: 'product not found' };
    }
    case 'set_shelf_count': {
      const before = await stockFor(db, a.product_id);
      const after = await setCount(db, a.product_id, a.qty, a.note || 'via chat');
      await remember(db, { type: 'count', product_id: a.product_id });
      return { saved: true, before: before.on_hand, after: after.on_hand };
    }
    case 'adjust_stock': {
      const after = await adjust(db, a.product_id, a.delta, a.reason);
      await remember(db, { type: 'adjust', product_id: a.product_id });
      return { saved: true, on_hand: after.on_hand };
    }
    case 'set_price': {
      const p = await db.prepare('SELECT price, price_source, price_warning FROM products WHERE id=?').bind(a.product_id).first();
      await db.prepare("UPDATE products SET price=?, price_source='manual', price_warning=NULL WHERE id=?").bind(a.price, a.product_id).run();
      await remember(db, { type: 'price', product_id: a.product_id, old: p?.price ?? null, old_source: p?.price_source, old_warning: p?.price_warning });
      return { saved: true, old_price: p?.price ?? null, new_price: a.price };
    }
    case 'sales_report': {
      return await salesSummary(db, a.start, a.end || a.start);
    }
    case 'product_sales': {
      const from = addDays(todayLocal(), -(a.days || 30));
      return {
        days: (await db.prepare('SELECT sale_date, SUM(qty) qty, SUM(amount) amount FROM sales WHERE product_id=? AND sale_date>=? GROUP BY sale_date ORDER BY sale_date').bind(a.product_id, from).all()).results
      };
    }
    case 'inventory_status': {
      let rows = await inventory(db, { distributor: a.distributor, category: a.category });
      if (a.status) rows = rows.filter(r => r.status === a.status.toUpperCase());
      rows.sort((x, y) => (x.weeks_left ?? 999) - (y.weeks_left ?? 999));
      return {
        count: rows.length,
        items: rows.slice(0, 40).map(r => ({
          product_id: r.id,
          name: r.clean_name || r.name,
          size: r.size,
          on_hand: r.on_hand,
          per_week: r.per_week,
          weeks_left: r.weeks_left,
          status: r.status,
          distributor: r.distributor,
          display_price: r.display_price
        }))
      };
    }
    case 'list_invoices': {
      return {
        invoices: (await db.prepare('SELECT id, distributor, invoice_no, invoice_date, total, status FROM invoices ORDER BY COALESCE(invoice_date,created_at) DESC LIMIT ?').bind(a.limit || 10).all()).results
      };
    }
    case 'distributor_orders': {
      return { suggestions: await distributorOrderSuggestions(db) };
    }
  }
  return { error: 'unknown tool ' + name };
}

async function remember(db, change) {
  await db.prepare("INSERT INTO settings(key,value) VALUES('last_change',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(JSON.stringify({ ...change, at: new Date().toISOString() })).run();
}

const SYSTEM = (today) => `You are the store manager assistant for Discount Liquor, 2105 E Orange Ave, Eustis FL (owner: Zaheer).
Today is ${today} (America/New_York). Register sales include ${TAX * 100}% sales tax; quote shelf prices before tax.
Rules:
- Always look products up with search_products before answering about a product. If several products match, ask which one (list them briefly).
- Stock on hand = last shelf count (or first delivery) + deliveries since - bottles sold since + adjustments. When the owner asks why a number looks wrong or asks how many bottles he has and why, call search_products and explain_stock, explain the arithmetic in plain words, and point out likely causes.
- When the owner says how many bottles he has ("I have 4 Don Julio 750"), use set_shelf_count for the exact matching product and confirm before→after. Mention that he can type /undo to revert if needed.
- When asked about sales for a date or "sales yesterday", call sales_report and report the store sales total (which excludes lottery).
- Only change data (count, adjust, price) when the owner clearly asked. After any change say exactly what changed and that he can type /undo.
- Never place orders or contact distributors. Suggest quantities in cases.
- Answer short and clear for a phone screen: a few lines or a small list, $ with 2 decimals. Show estimated prices with a '~'. If a product has a price warning ('price changed?'), mention it so the owner can confirm with /price. No markdown tables; use simple lines.`;

export async function askAssistant(env, userText, history = [], todayOverride = null) {
  const today = todayOverride || env.TODAY_OVERRIDE || todayLocal();
  const contents = [...history, { role: 'user', parts: [{ text: userText }] }];
  for (let step = 0; step < 8; step++) {
    const r = await gemini(env, {
      systemInstruction: { parts: [{ text: SYSTEM(today) }] },
      contents,
      tools: [{ functionDeclarations: TOOLS }],
      generationConfig: { temperature: 0.2 }
    });
    const cand = r.candidates?.[0]?.content;
    if (!cand) return 'Sorry, I could not get an answer right now.';
    contents.push(cand);
    const calls = (cand.parts || []).filter(p => p.functionCall);
    if (!calls.length) return (cand.parts || []).map(p => p.text || '').join('').trim() || 'Done.';
    const responses = [];
    for (const c of calls) {
      let out;
      try { out = await runTool(env, c.functionCall.name, c.functionCall.args || {}); }
      catch (e) { out = { error: String(e.message || e) }; }
      responses.push({ functionResponse: { name: c.functionCall.name, response: { result: out } } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  return 'That took too many steps – please ask in a simpler way.';
}

// ---------------- Invoice Extraction ----------------
const INVOICE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    distributor: { type: 'STRING', description: 'Breakthru, Southern Glazer\'s, Gold Coast, Florida Distributors, Wayne Densch, or as printed' },
    invoice_no: { type: 'STRING' },
    invoice_date: { type: 'STRING', description: 'delivery/invoice date yyyy-mm-dd' },
    total: { type: 'NUMBER', description: 'invoice total' },
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          description: { type: 'STRING' },
          item_code: { type: 'STRING' },
          upc: { type: 'STRING', description: 'barcode digits if printed' },
          size: { type: 'STRING' },
          cases: { type: 'NUMBER' },
          units_per_case: { type: 'NUMBER', description: 'bottles or retail packs per case; for beer 6-packs or 4-packs use packs per case; for 50ml packs like B120 use 120' },
          bottles: { type: 'NUMBER', description: 'TOTAL retail units delivered on this line (cases*units_per_case + loose units). Register sells retail units!' },
          unit_cost: { type: 'NUMBER', description: 'net cost per retail unit after discounts' },
          line_total: { type: 'NUMBER', description: 'net extended amount' }
        },
        required: ['description', 'bottles']
      }
    },
  },
  required: ['distributor', 'lines'],
};

export async function extractInvoice(env, bytes, mimeType) {
  const b64 = toBase64(bytes);
  const prompt = `This is a liquor/beer distributor invoice or picklist for Discount Liquor (2105 E Orange Ave, Eustis FL 32726).
Extract every product line that was delivered. Skip lines with 0 quantity. Use NET prices after discounts.
"bottles" must be total retail units delivered (e.g. 1 case of 12 = 12, 3 cases of 6 = 18, 7 cases of 6 4-packs = 42 retail packs).
Distributors: Breakthru Beverage, Southern Glazer's (Proof), Gold Coast (RBG Spirits/Reyes), Florida Distributors, Wayne Densch.
Return dates as yyyy-mm-dd.`;

  const r = await gemini(env, {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: b64 } }, { text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: INVOICE_SCHEMA },
  });
  const text = r.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}';
  const inv = JSON.parse(text);
  inv.distributor = normalizeDistributor(inv.distributor);
  return inv;
}

export function normalizeDistributor(d) {
  const s = String(d || '').toLowerCase();
  if (/breakthru/.test(s)) return 'Breakthru';
  if (/southern|glazer|proof|sgws/.test(s)) return "Southern Glazer's";
  if (/gold coast|rbg|reyes.*spirit/.test(s)) return 'Gold Coast';
  if (/florida dist|fdi/.test(s)) return 'Florida Distributors';
  if (/densch|wdi/.test(s)) return 'Wayne Densch';
  return d || 'Unknown';
}

function toBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
