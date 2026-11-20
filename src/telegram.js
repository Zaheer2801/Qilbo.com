// Telegram bot for Discount Liquor (2105 E Orange Ave, Eustis FL)
import {
  searchProducts,
  stockFor,
  setCount,
  adjust,
  salesSummary,
  inventory,
  todayLocal,
  addDays,
  getSetting,
  setSetting,
  distributorOrderSuggestions,
  getDraftPOs,
  addToDraftPO
} from './db.js';
import { askAssistant, extractInvoice } from './ai.js';
import { decide, runBrain, briefText } from './brain.js';
import { decideStore } from './signup.js';
import { labelPdf, findLabelItems, labelDate } from './labels.js';
import { KINDS, linkChat, storeByChat, saveStoreFile, setFileKind, onboarding, checklistText, ensureToken, setupUrl, pctOf } from './intake.js';
import { stageInvoice, postInvoice, ingestSalesCsv, dateFromFilename } from './ingest.js';

const API = (env, m) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${m}`;

export async function tg(env, method, payload) {
  const r = await fetch(API(env, method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return r.json();
}

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function send(env, chatId, text, extra = {}) {
  const chunks = [];
  for (let t = String(text); t.length; ) {
    let cut = t.length > 3900 ? t.lastIndexOf('\n', 3900) : t.length;
    if (cut < 1000) cut = Math.min(3900, t.length);
    chunks.push(t.slice(0, cut));
    t = t.slice(cut);
  }
  for (let i = 0; i < chunks.length; i++) {
    await tg(env, 'sendMessage', {
      chat_id: chatId,
      text: chunks[i],
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(i === chunks.length - 1 ? extra : {})
    });
  }
}

export const pname = p => {
  const n = p?.clean_name || p?.name || '';
  const z = p?.size || '';
  return n + (z && !n.toLowerCase().replace(/\s/g, '').includes(z.toLowerCase().replace(/\s|ml/g, '')) ? ' ' + z : '');
};

export const money = n => n == null ? '–' : '$' + Number(n).toFixed(2);

// Six big buttons replace the long command list. Every old command still works for anyone who knows it.
const MENU = [
  [{ text: '🧠 What to fix' }, { text: '📊 Sales' }],
  [{ text: '📦 Running low' }, { text: '🛒 What to order' }],
  [{ text: '🧾 Invoices' }, { text: '🏷 Labels' }],
  [{ text: '🖥 Dashboard' }]
];
const BUTTONS = {
  '🧠 what to fix': 'fix',
  "📊 yesterday's sales": 'sales',
  '📊 sales': 'sales',
  '📦 running low': 'low',
  '🛒 what to order': 'order',
  '🧾 invoices': 'invoices',
  '🏷 labels': 'labels',
  '🖥 dashboard': 'dashboard'
};
export const MENU_MARKUP = { reply_markup: { keyboard: MENU, resize_keyboard: true, is_persistent: true } };

const HELP = `<b>🥃 Discount Liquor</b>
Tap a button below, or just type like you'd text a person:
• <i>how many Don Julio 750 do I have?</i>
• <i>I counted 4 Hennessy 375</i>
• <i>sales this week</i>

📎 Send a photo or PDF of an invoice and I'll read it for you.
🏷 Shelf labels: tap Labels, or type <i>labels hennessy</i>.`;

const COMMAND_LIST = [
  { command: 'menu', description: 'Show the buttons' },
  { command: 'brain', description: 'What to fix today' },
  { command: 'sales', description: "Yesterday's sales" },
  { command: 'low', description: 'Running low' },
  { command: 'labels', description: 'Shelf labels, e.g. /labels seagram gin' }
];

// Where setup links point (the worker). PUBLIC_URL is the dashboard address.
export const appBase = (env) => String(env.APP_URL || env.PUBLIC_URL || 'https://discount-liquor.zshaik2801.workers.dev').replace(/\/$/, '');

// The bot's @username, looked up once and kept in settings (used for t.me links).
export async function botUsername(env) {
  const cached = await getSetting(env.DB, 'tg_bot_username', '');
  if (cached) return cached;
  const me = await tg(env, 'getMe', {});
  const u = me?.result?.username || '';
  if (u) await setSetting(env.DB, 'tg_bot_username', u);
  return u;
}

export async function handleUpdate(env, update, ctx) {
  if (update.callback_query) {
    const cid = update.callback_query.message?.chat?.id;
    if (env.OWNER_CHAT_ID && String(cid) !== String(env.OWNER_CHAT_ID)) return storeButton(env, update.callback_query);
    return onButton(env, update.callback_query);
  }
  const msg = update.message || update.edited_message;
  if (!msg) return;
  const chatId = msg.chat.id;

  if (!env.OWNER_CHAT_ID) {
    return send(env, chatId, `Setup: your Telegram chat id is <code>${chatId}</code>. Save it as OWNER_CHAT_ID.`);
  }
  // Everyone else can only be a pilot store sending its files (never the owner's data or commands)
  if (String(chatId) !== String(env.OWNER_CHAT_ID)) {
    try { return await storeMessage(env, msg); } catch (e) { console.error('store chat error', e); return send(env, chatId, 'Sorry, something went wrong. Please try again.'); }
  }

  try {
    if (msg.document || msg.photo) return await onFile(env, msg);
    const text = (msg.text || msg.caption || '').trim();
    if (!text) return;
    await log(env, 'user', text);
    const tapped = BUTTONS[text.toLowerCase()];
    if (tapped) { await setSetting(env.DB, 'tg_waiting', ''); return await openMenu(env, chatId, tapped); }
    // Waiting for typed dates after "Pick dates"
    const waiting = await getSetting(env.DB, 'tg_waiting', '');
    if (waiting === 'labels' && !text.startsWith('/')) {
      await setSetting(env.DB, 'tg_waiting', '');
      if (/^\s*(cancel|stop|no)\s*$/i.test(text)) return send(env, chatId, 'OK, cancelled.');
      return await sendLabels(env, chatId, text);
    }
    const lbl = text.match(/^(?:\/labels?(?:@\w+)?|labels?|tags?)\s+(.+)$/i);
    if (lbl) return await sendLabels(env, chatId, lbl[1]);
    if (waiting && !text.startsWith('/')) {
      const range = parseRange(text);
      if (range) { await setSetting(env.DB, 'tg_waiting', ''); return await showRange(env, chatId, waiting, range[0], range[1]); }
      if (/^\s*(cancel|stop|no)\s*$/i.test(text)) { await setSetting(env.DB, 'tg_waiting', ''); return send(env, chatId, 'OK, cancelled.'); }
    }
    if (text.startsWith('/')) return await onCommand(env, chatId, text);
    if (!env.GEMINI_API_KEY) return send(env, chatId, 'AI is not set up yet – tap a button below.', MENU_MARKUP);

    await tg(env, 'sendChatAction', { chat_id: chatId, action: 'typing' });
    const history = await recentHistory(env);
    try {
      const answer = await askAssistant(env, text, history);
      await log(env, 'bot', answer);
      await send(env, chatId, esc(answer));
    } catch (e) {
      console.error('[Gemini AI Error]', e);
      await send(env, chatId, 'AI is unavailable right now – the buttons below still work.', MENU_MARKUP);
      await alertGeminiFailure(env, e);
    }
  } catch (e) {
    await send(env, chatId, '⚠️ ' + esc(e.message || e));
  }
}

export async function alertGeminiFailure(env, err) {
  try {
    const today = todayLocal();
    const lastAlert = await getSetting(env.DB, 'last_gemini_error_alert');
    if (lastAlert !== today && env.OWNER_CHAT_ID) {
      await setSetting(env.DB, 'last_gemini_error_alert', today);
      await send(
        env,
        env.OWNER_CHAT_ID,
        `⚠️ <b>Gemini AI Error Alert</b>\nModel: <code>${env.GEMINI_MODEL}</code>\nError: <code>${esc(err?.message || err)}</code>\nPlease update the model or check API limits.`
      );
    }
  } catch (alertErr) {
    console.error('Failed to send Gemini failure alert:', alertErr);
  }
}

async function onCommand(env, chatId, text) {
  const [cmd0, ...rest] = text.split(/\s+/);
  const cmd = cmd0.toLowerCase().replace(/@.*/, '');
  const arg = rest.join(' ');
  const db = env.DB;

  if (cmd === '/start' || cmd === '/help' || cmd === '/menu') {
    await tg(env, 'setMyCommands', { commands: COMMAND_LIST }).catch(() => {});
    return send(env, chatId, HELP, MENU_MARKUP);
  }
  if (cmd === '/labels' || cmd === '/label') return arg ? sendLabels(env, chatId, arg) : openMenu(env, chatId, 'labels');
  if (cmd === '/dashboard') return send(env, chatId, `Dashboard: ${env.PUBLIC_URL || '(set PUBLIC_URL)'}/`);

  if (cmd === '/stock') {
    const rows = await searchProducts(db, arg, 8);
    if (!rows.length) return send(env, chatId, 'No product found for "' + esc(arg) + '"');
    const out = [];
    for (const p of rows) {
      const s = await stockFor(db, p.id);
      const pr = p.price != null ? ` [${p.price_source === 'estimated' ? '~' : ''}$${Number(p.price).toFixed(2)}${p.price_warning ? ' (price changed?)' : ''}]` : '';
      out.push(`• <b>${esc(pname(p))}</b>${pr}: <b>${s.on_hand ?? 'not counted'}</b> <i>(${esc(s.basis)})</i>`);
    }
    return send(env, chatId, out.join('\n'));
  }

  if (cmd === '/count' || cmd === '/adjust') {
    const m = arg.match(/^(-?\d+(?:\.\d+)?)\s+(.+)$/);
    if (!m) return send(env, chatId, cmd === '/count' ? 'Use: /count 4 don julio reposado 750' : 'Use: /adjust -1 hennessy 375 broken');
    const n = Number(m[1]);
    let q = m[2], reason = null;

    if (cmd === '/adjust') {
      const w = q.split(/\s+/);
      let iz = -1;
      w.forEach((x, i) => { if (/^\d+(\.\d+)?(ml|l)?$/i.test(x)) iz = i; });
      if (iz >= 0 && iz < w.length - 1) {
        reason = w.slice(iz + 1).join(' ');
        q = w.slice(0, iz + 1).join(' ');
      }
    }

    const rows = await searchProducts(db, q, 5);
    if (!rows.length) return send(env, chatId, 'No product found for "' + esc(q) + '"');
    if (rows.length > 1 && !exactish(rows[0], q)) {
      return send(env, chatId, 'Which one?\n' + rows.map(p => `• ${esc(pname(p))}`).join('\n') + '\nType the full name.');
    }

    const p = rows[0];
    const before = await stockFor(db, p.id);
    const after = cmd === '/count' ? await setCount(db, p.id, n, 'via /count') : await adjust(db, p.id, n, reason || 'via /adjust');
    await setSetting(db, 'last_change', JSON.stringify({ type: cmd === '/count' ? 'count' : 'adjust', product_id: p.id }));
    return send(env, chatId, `✅ ${esc(pname(p))}: ${before.on_hand ?? 'not counted'} → <b>${after.on_hand}</b>\n(/undo to reverse)`);
  }

  if (cmd === '/price') {
    const m = arg.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!m) return send(env, chatId, 'Use: /price 59.99 don julio 750 (pre-tax price)');
    const newPrice = Number(m[1]);
    const q = m[2];
    const rows = await searchProducts(db, q, 5);
    if (!rows.length) return send(env, chatId, 'No product found for "' + esc(q) + '"');
    if (rows.length > 1 && !exactish(rows[0], q)) {
      return send(env, chatId, 'Which one?\n' + rows.map(p => `• ${esc(pname(p))}`).join('\n') + '\nType the full name.');
    }
    const p = rows[0];
    const oldPrice = p.price;
    await db.prepare("UPDATE products SET price=?, price_source='manual', price_warning=NULL WHERE id=?").bind(newPrice, p.id).run();
    await setSetting(db, 'last_change', JSON.stringify({ type: 'price', product_id: p.id, old: oldPrice, old_source: p.price_source, old_warning: p.price_warning }));
    return send(env, chatId, `🏷️ ${esc(pname(p))}: ${oldPrice != null ? '$' + Number(oldPrice).toFixed(2) : 'none'} → <b>$${newPrice.toFixed(2)}</b> (manual)\n(/undo to reverse)`);
  }

  if (cmd === '/noreorder') {
    if (!arg) return send(env, chatId, 'Use: /noreorder hennessy iced tea');
    const rows = await searchProducts(db, arg, 5);
    if (!rows.length) return send(env, chatId, 'No product found for "' + esc(arg) + '"');
    if (rows.length > 1 && !exactish(rows[0], arg)) {
      return send(env, chatId, 'Which one?\n' + rows.map(p => `• ${esc(pname(p))}`).join('\n') + '\nType the full name.');
    }
    const p = rows[0];
    const newFlag = p.do_not_reorder ? 0 : 1;
    await db.prepare('UPDATE products SET do_not_reorder=? WHERE id=?').bind(newFlag, p.id).run();
    if (newFlag === 1) {
      return send(env, chatId, `🚫 <b>Do Not Reorder set:</b> ${esc(pname(p))} will be excluded from order suggestions.`);
    } else {
      return send(env, chatId, `✅ <b>Reorder restored:</b> ${esc(pname(p))} will be included in order suggestions.`);
    }
  }

  if (cmd === '/undo') return send(env, chatId, await undo(env));

  if (cmd === '/sales') {
    const y = addDays(todayLocal(), -1);
    let s = y, e = y;
    if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) s = e = arg;
    else if (/week/.test(arg)) s = addDays(y, -6);
    else if (/month/.test(arg)) s = addDays(y, -29);
    else if (/today/.test(arg)) s = e = todayLocal();
    return send(env, chatId, formatSales(await salesSummary(db, s, e)));
  }

  if (cmd === '/brain') {
    if (/run/.test(arg)) await runBrain(db);
    const brief = await briefText(db, { max: 8 });
    const keyboard = brief.items.map((f, i) => ([
      { text: `✅ ${i + 1} Approve`, callback_data: `fa:${f.id}` },
      { text: `⏭ ${i + 1} Skip`, callback_data: `fs:${f.id}` }
    ]));
    return send(env, chatId, brief.text, keyboard.length ? { reply_markup: { inline_keyboard: keyboard } } : {});
  }

  if (cmd === '/low') {
    const rows = (await inventory(db, { onlyTracked: true })).filter(r => r.status === 'OUT' || r.status === 'REORDER').sort((a, b) => (a.weeks_left ?? 0) - (b.weeks_left ?? 0));
    if (!rows.length) return send(env, chatId, 'Nothing low right now 👍');
    return send(env, chatId, '<b>Out / reorder</b>\n' + rows.slice(0, 40).map(r => `• ${esc(pname(r))} – <b>${r.on_hand}</b> left (~${r.per_week}/wk) ${r.distributor ? '(' + esc(r.distributor) + ')' : ''}`).join('\n'));
  }

  if (cmd === '/orders') {
    const suggestions = await distributorOrderSuggestions(db);
    const lines = ['<b>📦 Suggested Distributor Orders</b> (2-week cover, 30d sales)\n'];
    for (const d of suggestions) {
      if (d.total_cases === 0) continue;
      lines.push(`<b>${esc(d.distributor)}</b>: ${d.total_cases} cases (${money(d.total_cost)})`);
      if (d.minimum_rule) lines.push(`  Min: ${d.minimum_rule} ${d.meets_minimum ? '✅' : '⚠️ Below minimum'}`);
      if (d.fee_warning) lines.push(`  ⚠️ <i>${esc(d.fee_warning)}</i>`);
      if (d.rep_text) lines.push(`  <pre>${esc(d.rep_text)}</pre>`);
      else lines.push(...d.items.slice(0, 5).map(it => `  • ${it.cases_suggested} cs ${esc(it.name)} ${it.size || ''} (${money(it.line_total)})`));
      lines.push('');
    }
    return send(env, chatId, lines.join('\n') || 'No orders needed right now.');
  }

  if (cmd === '/po') {
    if (arg.toLowerCase().startsWith('add ')) {
      const m = arg.slice(4).trim().match(/^(\d+)\s*(?:cases?|cs)?\s+(.+)$/i);
      if (!m) return send(env, chatId, 'Use: <code>/po add 2 cases don julio blanco 750</code>');
      const cases = Number(m[1]);
      const q = m[2].trim();
      const rows = await searchProducts(db, q, 5);
      if (!rows.length) return send(env, chatId, `No product found for "${esc(q)}"`);
      if (rows.length > 1 && !exactish(rows[0], q)) {
        return send(env, chatId, 'Which one?\n' + rows.map(p => `• ${esc(pname(p))}`).join('\n') + '\nType the full name.');
      }
      const p = rows[0];
      const drafts = await addToDraftPO(db, { productId: p.id, cases, distributor: p.distributor });
      const po = drafts.find(d => d.distributor === (p.distributor || "Southern Glazer's"));
      return send(env, chatId, `🛒 Added <b>${cases} case(s)</b> of <b>${esc(pname(p))}</b> to <b>${esc(po?.distributor || p.distributor || "Southern Glazer's")}</b> draft PO.\nTotal: <b>${po?.total_cases || cases} cases</b> (${money(po?.total_cost)})\nMin: ${po?.minimum_text || '–'} ${po?.meets_minimum ? '✅' : '⚠️ Below minimum'}${po?.fee_warning ? '\n⚠️ <i>' + esc(po.fee_warning) + '</i>' : ''}`);
    }

    const drafts = await getDraftPOs(db);
    const active = drafts.filter(d => d.items && d.items.length > 0);
    if (!active.length) {
      return send(env, chatId, '📝 <b>Draft Purchase Orders</b>\n\nNo items in any draft POs right now.\nUse <code>/po add 2 cases don julio blanco 750</code> or tap "Add to PO" on any item in the dashboard.');
    }
    const lines = ['<b>📝 Draft Purchase Orders</b>\n'];
    for (const d of active) {
      lines.push(`<b>${esc(d.distributor)}</b>: ${d.total_cases} cases (${money(d.total_cost)})`);
      lines.push(`Min: ${d.minimum_text} ${d.meets_minimum ? '✅' : '⚠️ Below minimum'}`);
      if (d.fee_warning) lines.push(`⚠️ <i>${esc(d.fee_warning)}</i>`);
      lines.push(...d.items.map(it => `  • ${it.cases} cs ${esc(it.name)} ${it.size || ''} (${money(it.line_total)})`));
      lines.push('');
    }
    return send(env, chatId, lines.join('\n'));
  }

  if (cmd === '/invoices') {
    const rows = (await db.prepare('SELECT id, distributor, invoice_no, invoice_date, total, status FROM invoices ORDER BY COALESCE(invoice_date,created_at) DESC LIMIT 10').all()).results;
    return send(env, chatId, rows.map(r => `• ${r.invoice_date || ''} ${esc(r.distributor)} #${esc(r.invoice_no)} ${money(r.total)} ${r.status === 'posted' ? '✅' : '⏳ ' + r.status}`).join('\n') || 'No invoices yet');
  }

  return send(env, chatId, HELP);
}

const exactish = (p, q) => q.toLowerCase().split(/\s+/).every(w => (p.name + ' ' + (p.clean_name || '') + ' ' + (p.size || '')).toLowerCase().includes(w.replace(/ml$/, '')));

export async function undo(env) {
  const db = env.DB;
  const raw = await getSetting(db, 'last_change');
  if (!raw) return 'Nothing to undo.';
  const c = JSON.parse(raw);
  if (c.type === 'count') {
    await db.prepare('DELETE FROM stock_counts WHERE id=(SELECT id FROM stock_counts WHERE product_id=? ORDER BY counted_at DESC, id DESC LIMIT 1)').bind(c.product_id).run();
  } else if (c.type === 'adjust') {
    await db.prepare('DELETE FROM adjustments WHERE id=(SELECT id FROM adjustments WHERE product_id=? ORDER BY created_at DESC, id DESC LIMIT 1)').bind(c.product_id).run();
  } else if (c.type === 'price') {
    await db.prepare('UPDATE products SET price=?, price_source=?, price_warning=? WHERE id=?').bind(c.old, c.old_source || 'estimated', c.old_warning || null, c.product_id).run();
  }
  await db.prepare("DELETE FROM settings WHERE key='last_change'").run();
  const p = await db.prepare('SELECT name, clean_name, size FROM products WHERE id=?').bind(c.product_id).first();
  const s = await stockFor(db, c.product_id);
  return `↩️ Undone (${c.type}) for ${esc(pname(p))}. Now: ${s.on_hand ?? 'not counted'}`;
}

export function formatSales(s) {
  const lines = [
    `<b>Sales ${s.start}${s.end !== s.start ? ' → ' + s.end : ''}</b>`,
    `Store sales (no lottery): <b>${money(s.store_sales)}</b>`
  ];
  if (s.tracked_margin != null) {
    lines.push(`Profit on tracked items: ${money(s.tracked_profit)} (${(s.tracked_margin * 100).toFixed(0)}% margin)`);
  }
  if (s.top_shelf?.amount) {
    lines.push(`Top shelf spirits: ${money(s.top_shelf.amount)} (${(s.top_shelf.share * 100).toFixed(0)}% of store sales)`);
  }
  if (s.by_category.length) {
    lines.push('', '<b>By category:</b>', ...s.by_category.filter(c => c.category !== 'Lottery').map(c => `• ${esc(c.category)}: ${money(c.amount)} (${c.qty})`));
  }
  const lot = s.departments.filter(d => /lotter/i.test(d.department)).reduce((a, d) => a + d.amount, 0) + (s.by_category.find(c => c.category === 'Lottery')?.amount || 0);
  if (lot) lines.push(`• Lottery (tickets/payouts): ${money(lot)}`);
  if (s.top_items.length) {
    lines.push('', '<b>Top items:</b>', ...s.top_items.slice(0, 10).map(t => `• ${esc(t.name)} ×${t.qty} – ${money(t.amount)}`));
  }
  if (!s.daily.length) lines.push('', '<i>No sales loaded for these dates yet.</i>');
  return lines.join('\n');
}

// ---------- Files Ingestion (CSV / PDF / Photo) ----------
async function onFile(env, msg) {
  const chatId = msg.chat.id;
  const doc = msg.document;
  const fileId = doc ? doc.file_id : msg.photo[msg.photo.length - 1].file_id;
  const fileName = doc?.file_name || `photo_${Date.now()}.jpg`;
  const mime = doc?.mime_type || 'image/jpeg';
  const f = await tg(env, 'getFile', { file_id: fileId });
  if (!f.ok) return send(env, chatId, 'Could not download the file from Telegram (max 20 MB).');

  const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${f.result.file_path}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  if (/\.csv$/i.test(fileName) || mime === 'text/csv') {
    const date = dateFromFilename(fileName) || (msg.caption || '').match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (!date) return send(env, chatId, 'Which day is this report? Re-send with the date as caption, e.g. 2026-11-05');
    const r = await ingestSalesCsv(env.DB, new TextDecoder().decode(bytes), date, fileName);
    return send(env, chatId, `✅ Loaded sales for ${r.date}: ${r.items} items, store sales ${money(r.store_sales)}${r.new_products ? `, ${r.new_products} new products` : ''}`);
  }

  if (!env.GEMINI_API_KEY) return send(env, chatId, 'AI is not set up, so I cannot read PDFs/photos yet.');
  await send(env, chatId, '📄 Reading invoice with Gemini AI… (about 20–40 seconds)');
  const key = `invoices/${todayLocal()}/${Date.now()}_${fileName.replace(/[^\w.-]/g, '_')}`;
  if (env.FILES) await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
  const inv = await extractInvoice(env, bytes, mime === 'application/octet-stream' ? 'application/pdf' : mime);
  const st = await stageInvoice(env.DB, inv, { file_key: key, source: 'telegram' });
  if (st.duplicate) return send(env, chatId, `This invoice (#${esc(inv.invoice_no)}) is already saved – nothing changed.`);

  return send(env, chatId, invoicePreview(st), {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Save to inventory', callback_data: 'post:' + st.id },
        { text: '❌ Discard', callback_data: 'drop:' + st.id }
      ]]
    }
  });
}

export function invoicePreview(st) {
  const sum = st.lines.reduce((a, l) => a + (l.line_total ?? (l.bottles * (l.unit_cost || 0))), 0);
  const newOnes = st.lines.filter(l => !l.matched).length;
  return [
    `<b>${esc(st.distributor)} #${esc(st.invoice_no)}</b> – ${esc(st.invoice_date || 'no date')}`,
    `Invoice total: ${money(st.total)} | lines add up to ${money(sum)}${st.total && Math.abs(sum - st.total) > 1 ? ' ⚠️ check' : ''}`,
    '',
    ...st.lines.map(l => `• ${esc(l.description)} – <b>${l.bottles}</b> units @ ${money(l.unit_cost)}${l.matched ? '' : ' 🆕'}${l.warning ? ' ' + esc(l.warning) : ''}`),
    '',
    newOnes ? `🆕 = ${newOnes} new product(s) will be created.` : 'All items matched to existing products.',
    'Save these bottles into inventory?'
  ].join('\n');
}

// ---------- button menus: each main button opens a small set of choices ----------
const kb = (rows) => ({ reply_markup: { inline_keyboard: rows } });
const b = (text, data) => ({ text, callback_data: String(data).slice(0, 64) });

async function distributors(db) {
  return (await db.prepare(`SELECT distributor d, COUNT(*) n FROM invoices WHERE distributor IS NOT NULL AND distributor <> ''
      GROUP BY distributor ORDER BY MAX(invoice_date) DESC LIMIT 6`).all()).results.map((r) => r.d);
}
const two = (arr) => arr.reduce((rows, x, i) => (i % 2 ? rows[rows.length - 1].push(x) : rows.push([x]), rows), []);

async function openMenu(env, chatId, which) {
  const db = env.DB;
  if (which === 'labels') {
    await setSetting(db, 'tg_waiting', 'labels');
    return send(env, chatId, '🏷 <b>Shelf labels</b>\nWhich items? Type a brand or product, like <i>seagram gin</i> or <i>hennessy</i>.\nAdd a size to narrow it: <i>hennessy 375</i>.');
  }
  if (which === 'dashboard') return send(env, chatId, `🖥 Your dashboard: ${env.PUBLIC_URL || ''}/`);
  if (which === 'sales') return send(env, chatId, '📊 <b>Sales for…</b>', kb([
    [b('Today', 'ms:today'), b('Yesterday', 'ms:yesterday')],
    [b('Last 7 days', 'ms:7d'), b('Last 30 days', 'ms:30d')],
    [b('This month', 'ms:month'), b('Last month', 'ms:lastmonth')],
    [b('📅 Pick dates', 'ms:custom')]
  ]));
  if (which === 'invoices') {
    const ds = await distributors(db);
    return send(env, chatId, '🧾 <b>Invoices</b>', kb([
      [b('Latest 10', 'mi:recent'), b('⏳ Waiting for review', 'mi:pending')],
      [b('This month', 'mi:month'), b('📅 Pick dates', 'mi:custom')],
      ...two(ds.map((d) => b(d, 'mid:' + d)))
    ]));
  }
  if (which === 'low') {
    const ds = await distributors(db);
    return send(env, chatId, '📦 <b>Stock</b>', kb([
      [b('🔴 Out of stock', 'ml:out'), b('🟡 Running low', 'ml:low')],
      [b('Both', 'ml:all'), b('💤 Not selling', 'ml:dead')],
      ...two(ds.map((d) => b(d, 'mld:' + d)))
    ]));
  }
  if (which === 'order') {
    const sug = (await distributorOrderSuggestions(db)).filter((d) => d.total_cases > 0);
    if (!sug.length) return send(env, chatId, '🛒 Nothing needs ordering right now. 👍');
    return send(env, chatId, '🛒 <b>Order from…</b>', kb([
      ...two(sug.map((d) => b(`${d.distributor} · ${d.total_cases} cs`, 'mo:' + d.distributor))),
      [b('All distributors', 'mo:*')]
    ]));
  }
  if (which === 'fix') {
    const brief = await briefText(db, { max: 6 });
    await sendFindings(env, chatId, brief);
    return send(env, chatId, 'Show only…', kb([
      [b('💲 Prices', 'mf:price'), b('🧾 Invoices', 'mf:invoice')],
      [b('📦 Stock', 'mf:stock'), b('🔄 Check again now', 'mf:run')]
    ]));
  }
}

async function sendFindings(env, chatId, brief) {
  const keyboard = brief.items.map((f, i) => ([b(`✅ ${i + 1} Approve`, `fa:${f.id}`), b(`⏭ ${i + 1} Skip`, `fs:${f.id}`)]));
  return send(env, chatId, brief.text, keyboard.length ? kb(keyboard) : {});
}

function monthStart(ymd) { return ymd.slice(0, 8) + '01'; }
function lastMonth(ymd) {
  const d = new Date(ymd.slice(0, 8) + '01T12:00:00Z'); d.setUTCDate(0);
  const end = d.toISOString().slice(0, 10);
  return [end.slice(0, 8) + '01', end];
}

// "11/01 to 11/15", "nov 1 - nov 15", "2026-11-01 2026-11-15", or one date
export function parseRange(text, today = todayLocal()) {
  const y = Number(today.slice(0, 4));
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const found = [];
  const t = String(text).toLowerCase();
  for (const m of t.matchAll(/(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?|([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/g)) {
    let yy, mm, dd;
    if (m[1]) { yy = +m[1]; mm = +m[2]; dd = +m[3]; }
    else if (m[4]) { mm = +m[4]; dd = +m[5]; yy = m[6] ? (m[6].length === 2 ? 2000 + +m[6] : +m[6]) : y; }
    else if (months[m[7]]) { mm = months[m[7]]; dd = +m[8]; yy = m[9] ? +m[9] : y; }
    else continue;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;
    found.push(`${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`);
  }
  if (!found.length) return null;
  const [s, e] = [found[0], found[1] || found[0]].sort();
  return [s, e];
}

async function showRange(env, chatId, what, s, e) {
  const db = env.DB;
  if (what === 'sales') return send(env, chatId, formatSales(await salesSummary(db, s, e)));
  if (what === 'invoices') return listInvoices(env, chatId, 'invoice_date BETWEEN ? AND ?', [s, e], `🧾 <b>Invoices ${s} → ${e}</b>`);
}

async function listInvoices(env, chatId, where, binds, title) {
  const rows = (await env.DB.prepare(`SELECT distributor, invoice_no, invoice_date, total, status FROM invoices WHERE ${where}
      ORDER BY COALESCE(invoice_date, created_at) DESC LIMIT 25`).bind(...binds).all()).results;
  if (!rows.length) return send(env, chatId, `${title}
None found.`);
  const total = rows.reduce((a, r) => a + (r.total || 0), 0);
  return send(env, chatId, `${title}
` + rows.map((r) => `• ${r.invoice_date || ''} ${esc(r.distributor || '')} #${esc(r.invoice_no || '')} ${money(r.total)} ${r.status === 'posted' ? '✅' : '⏳'}`).join('\n') +
    `\n\n<b>Total:</b> ${money(total)} (${rows.length} invoice${rows.length > 1 ? 's' : ''})`);
}

async function stockList(env, chatId, filter, title) {
  const rows = (await inventory(env.DB, { onlyTracked: true })).filter(filter).sort((a, b) => (a.weeks_left ?? 0) - (b.weeks_left ?? 0));
  if (!rows.length) return send(env, chatId, `${title}
Nothing here right now. 👍`);
  return send(env, chatId, `${title}
` + rows.slice(0, 40).map((r) => `• ${esc(pname(r))} – <b>${Math.max(0, r.on_hand ?? 0)}</b> left${(r.on_hand ?? 0) < 0 ? ' (count it, the shelf count is off)' : ''}${r.per_week ? ` (~${r.per_week}/wk)` : ''}${r.distributor ? ' · ' + esc(r.distributor) : ''}`).join('\n') +
    (rows.length > 40 ? `\n<i>…and ${rows.length - 40} more in the dashboard.</i>` : ''));
}

async function onMenuButton(env, chatId, act, val) {
  const db = env.DB;
  const today = todayLocal(), y = addDays(today, -1);
  if (act === 'ms') {
    if (val === 'custom') { await setSetting(db, 'tg_waiting', 'sales'); return send(env, chatId, '📅 Type the dates, like <i>11/01 to 11/15</i> or <i>Nov 3</i>.'); }
    const r = { today: [today, today], yesterday: [y, y], '7d': [addDays(y, -6), y], '30d': [addDays(y, -29), y], month: [monthStart(today), today], lastmonth: lastMonth(today) }[val];
    if (r) return send(env, chatId, formatSales(await salesSummary(db, r[0], r[1])));
  }
  if (act === 'mi') {
    if (val === 'custom') { await setSetting(db, 'tg_waiting', 'invoices'); return send(env, chatId, '📅 Type the dates, like <i>11/01 to 11/15</i>.'); }
    if (val === 'recent') return listInvoices(env, chatId, '1=1', [], '🧾 <b>Latest invoices</b>');
    if (val === 'pending') return listInvoices(env, chatId, "status <> 'posted'", [], '⏳ <b>Waiting for your review</b>');
    if (val === 'month') return listInvoices(env, chatId, 'invoice_date >= ?', [monthStart(today)], '🧾 <b>Invoices this month</b>');
  }
  if (act === 'mid') return listInvoices(env, chatId, 'distributor = ? AND invoice_date >= ?', [val, addDays(today, -90)], `🧾 <b>${esc(val)}, last 90 days</b>`);
  if (act === 'ml') {
    if (val === 'out') return stockList(env, chatId, (r) => r.status === 'OUT', '🔴 <b>Out of stock</b>');
    if (val === 'low') return stockList(env, chatId, (r) => r.status === 'REORDER', '🟡 <b>Running low</b>');
    if (val === 'all') return stockList(env, chatId, (r) => r.status === 'OUT' || r.status === 'REORDER', '📦 <b>Out and running low</b>');
    if (val === 'dead') return stockList(env, chatId, (r) => r.status === 'NOT SELLING' && (r.on_hand ?? 0) > 0, '💤 <b>Not selling (no sales in 60 days)</b>');
  }
  if (act === 'mld') return stockList(env, chatId, (r) => (r.status === 'OUT' || r.status === 'REORDER') && r.distributor === val, `📦 <b>${esc(val)}: out and running low</b>`);
  if (act === 'mo') {
    const sug = (await distributorOrderSuggestions(db)).filter((d) => d.total_cases > 0 && (val === '*' || d.distributor === val));
    const lines = [];
    for (const d of sug) {
      lines.push(`🛒 <b>${esc(d.distributor)}</b>: ${d.total_cases} cases (${money(d.total_cost)})`);
      if (d.minimum_rule) lines.push(`Min: ${d.minimum_rule} ${d.meets_minimum ? '✅' : '⚠️ below minimum'}`);
      lines.push(...d.items.slice(0, 25).map((it) => `• ${it.cases_suggested} cs ${esc(it.name)} ${it.size || ''} (${money(it.line_total)})`));
      lines.push('');
    }
    return send(env, chatId, lines.join('\n') || 'Nothing to order there right now. 👍');
  }
  if (act === 'mf') {
    if (val === 'run') { await send(env, chatId, '🔄 Checking everything…'); await runBrain(db); return sendFindings(env, chatId, await briefText(db, { max: 8 })); }
    return sendFindings(env, chatId, await briefText(db, { max: 8, engine: val, maxSeverity: 3 }));
  }
}

async function onButton(env, q) {
  const chatId = q.message?.chat?.id;
  if (String(chatId) !== String(env.OWNER_CHAT_ID)) return;
  const raw = String(q.data || '');
  const cut = raw.indexOf(':');
  const act = cut < 0 ? raw : raw.slice(0, cut);
  const id = cut < 0 ? '' : raw.slice(cut + 1);
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id });
  if (/^m[a-z]{1,2}$/.test(act)) {
    try { return await onMenuButton(env, chatId, act, id); }
    catch (e) { return send(env, chatId, '⚠️ ' + esc(e.message || e)); }
  }

  if (act === 'lb') {
    const query = await getSetting(env.DB, 'tg_label_q', '');
    if (!query) return send(env, chatId, 'Type the items again: tap 🏷 Labels.');
    return sendLabels(env, chatId, query, { all: true });
  }

  if (act === 'post') {
    const r = await postInvoice(env.DB, Number(id));
    await tg(env, 'editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
    return send(env, chatId, r.already ? 'Already saved.' : `✅ Saved: ${r.lines} lines added to inventory${r.new_products ? `, ${r.new_products} new products created` : ''}.`);
  }
  if (act === 'sa' || act === 'sd') {
    const r = await decideStore(env.DB, Number(id), act === 'sa' ? 'approve' : 'decline').catch((e) => ({ error: e.message }));
    await tg(env, 'editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
    if (r.error) return send(env, chatId, `Couldn't update that store: ${esc(r.error)}`);
    const st = await env.DB.prepare('SELECT id, code, name, owner_name, phone FROM stores WHERE id=?').bind(Number(id)).first();
    if (act !== 'sa') return send(env, chatId, `✖️ Declined ${esc(st?.name)} (${esc(st?.code)}).`);
    const link = setupUrl(appBase(env), await ensureToken(env.DB, st.id));
    await send(env, chatId, `✅ <b>${esc(st?.name)}</b> (${esc(st?.code)}) is now a pilot store. Call ${esc(st?.owner_name)} at ${esc(st?.phone)} to set a start date.\n\nTheir private setup link:\n${esc(link)}\n\nForward the next message to them by text or WhatsApp 👇`);
    return send(env, chatId, `Hi ${esc(firstName(st?.owner_name))}, welcome to Qilbo! 🎉\n\nSet up ${esc(st?.name)} here (takes about 10 minutes):\n${esc(link)}\n\n1. Tap “Connect Telegram” so you can send invoices as photos.\n2. Upload your item list from your POS.\n3. Send the last 30 days of sales reports and 2 months of invoices.\n\nYour first list of fixes comes the next morning.`);
  }
  if (act === 'fa' || act === 'fs') {
    const r = await decide(env.DB, Number(id), act === 'fa' ? 'approve' : 'skip').catch((e) => ({ error: e.message }));
    if (r.error) return send(env, chatId, `Couldn't update that one: ${r.error}`);
    const f = await env.DB.prepare('SELECT title FROM findings WHERE id=?').bind(Number(id)).first();
    return send(env, chatId, act === 'fa'
      ? `✅ Approved: ${f?.title || 'finding'}. I'll check tomorrow's sales to confirm it's fixed.`
      : `⏭ Skipped: ${f?.title || 'finding'}.`);
  }
  if (act === 'drop') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM invoice_lines WHERE invoice_id=?').bind(Number(id)),
      env.DB.prepare("DELETE FROM invoices WHERE id=? AND status<>'posted'").bind(Number(id))
    ]);
    await tg(env, 'editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
    return send(env, chatId, 'Discarded – nothing saved.');
  }
}

async function log(env, role, text) {
  await env.DB.prepare('INSERT INTO chat_log(role,text) VALUES(?,?)').bind(role, String(text).slice(0, 4000)).run();
}

async function recentHistory(env) {
  const rows = (await env.DB.prepare("SELECT role, text FROM chat_log WHERE created_at > datetime('now','-2 hours') ORDER BY id DESC LIMIT 8").all()).results.reverse();
  rows.pop(); // The message we just logged is sent separately
  return rows.map(r => ({ role: r.role === 'user' ? 'user' : 'model', parts: [{ text: r.text }] }));
}


// ---------- Pilot stores: their own chat with the bot ----------
// A store can only send files and see its own setup checklist. Nothing here reads or changes
// Discount Liquor's data.
const STORE_MARKUP = { reply_markup: { keyboard: [[{ text: '📋 My setup' }, { text: '🔗 Upload page' }]], resize_keyboard: true, is_persistent: true } };
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'there';
const kindButtons = (fileId, current) => ({ inline_keyboard: [
  [['items', '🧾 Item list'], ['sales', '📊 Sales report']],
  [['invoice', '🚚 Invoice'], ['deals', '🏷 Deal sheet']],
].map((row) => row.map(([k, label]) => ({ text: (k === current ? '✓ ' : '') + label, callback_data: `sk:${fileId}:${k}` }))) });
function kindFromCaption(c = '') {
  c = String(c).toLowerCase();
  if (/invoice|bill/.test(c)) return 'invoice';
  if (/sales|report/.test(c)) return 'sales';
  if (/item|product|inventory|price list/.test(c)) return 'items';
  if (/deal|promo/.test(c)) return 'deals';
  return '';
}
function savedLine(r, ob) {
  const what = KINDS[r.kind]?.one || 'file';
  const c = ob.counts;
  const tally = r.kind === 'sales' ? `${c.sales_days} of 30 days of sales so far.`
    : r.kind === 'invoice' ? `${c.invoice} invoice${c.invoice === 1 ? '' : 's'} so far.`
    : r.kind === 'items' ? 'Item list ✓' : '';
  return `✅ Saved as ${what === 'file' ? 'a file' : (/^[aeiou]/.test(what) ? 'an ' : 'a ') + what}${r.report_date ? ` for ${r.report_date}` : ''}. ${tally}\nSetup ${pctOf(ob)}% done. Wrong type? Tap the right one:`;
}

async function storeMessage(env, msg) {
  if (msg.chat?.type && msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;
  const db = env.DB;
  const text = (msg.text || '').trim();

  const start = text.match(/^\/start(?:@\w+)?\s+([\w-]{16,64})$/);
  if (start) {
    const st = await linkChat(db, start[1], chatId);
    if (!st) return send(env, chatId, 'This setup link is not active anymore. Ask Qilbo for a new one.');
    const ob = await onboarding(db, st);
    await send(env, chatId, `👋 Welcome to Qilbo, ${esc(firstName(st.owner_name))}! This chat is now connected to <b>${esc(st.name)}</b>.\n\n` + checklistText(st, ob, setupUrl(appBase(env), st.intake_token)), STORE_MARKUP);
    if (!st.already && env.OWNER_CHAT_ID) await send(env, env.OWNER_CHAT_ID, `📲 <b>${esc(st.name)}</b> (${esc(st.code)}) connected Telegram.`).catch(() => {});
    return;
  }

  const st = await storeByChat(db, chatId);
  if (!st) return send(env, chatId, 'Hi! This is the Qilbo bot. To connect your store, open the setup link Qilbo sent you and tap “Connect Telegram”.');

  if (msg.document || msg.photo) return storeFile(env, st, msg);

  const t = text.toLowerCase();
  const url = setupUrl(appBase(env), st.intake_token);
  if (t === '📋 my setup' || t === '/status' || t === '/start' || t === '/help' || t === '/setup') {
    return send(env, chatId, checklistText(st, await onboarding(db, st), url), STORE_MARKUP);
  }
  if (t === '🔗 upload page') return send(env, chatId, `Upload many files at once here (works on phone and computer):\n${esc(url)}`, STORE_MARKUP);
  if (!text) return;
  // Anything else is a question for the Qilbo team: pass it on.
  if (env.OWNER_CHAT_ID) await send(env, env.OWNER_CHAT_ID, `💬 <b>${esc(st.name)}</b> (${esc(st.code)}) · ${esc(st.owner_name)} ${esc(st.phone || '')}:\n${esc(text.slice(0, 1500))}`).catch(() => {});
  return send(env, chatId, 'Thanks! The Qilbo team got your message and will get back to you soon.', STORE_MARKUP);
}

async function storeFile(env, st, msg) {
  const chatId = msg.chat.id;
  const doc = msg.document;
  const photo = msg.photo ? msg.photo[msg.photo.length - 1] : null;
  const size = doc?.file_size || photo?.file_size || 0;
  const url = setupUrl(appBase(env), st.intake_token);
  if (size > 20 * 1024 * 1024) return send(env, chatId, `Telegram only lets me fetch files up to 20 MB. Please use your upload page instead:\n${esc(url)}`);
  const f = await tg(env, 'getFile', { file_id: (doc || photo).file_id });
  if (!f.ok) return send(env, chatId, 'I couldn’t download that file from Telegram. Please send it again.');
  const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${f.result.file_path}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const name = doc?.file_name || `photo_${new Date().toISOString().slice(0, 10)}_${msg.message_id}.jpg`;
  const mime = doc?.mime_type || 'image/jpeg';
  const date = (msg.caption || '').match(/\d{4}-\d{2}-\d{2}/)?.[0] || null;
  const r = await saveStoreFile(env, st, { bytes, name, mime, kind: kindFromCaption(msg.caption), source: 'telegram', date });
  if (!r.ok) return send(env, chatId, '⚠️ ' + esc(r.error));
  const ob = await onboarding(env.DB, st);
  await send(env, chatId, r.kind === 'other' ? `Got it 👍 What is this file?` : savedLine(r, ob), { reply_markup: kindButtons(r.id, r.kind) });
  // Tell the Qilbo owner once a day per store that files are coming in
  const key = `intake_seen_${st.id}`, today = todayLocal();
  if (env.OWNER_CHAT_ID && (await getSetting(env.DB, key, '')) !== today) {
    await setSetting(env.DB, key, today);
    await send(env, env.OWNER_CHAT_ID, `📥 <b>${esc(st.name)}</b> (${esc(st.code)}) is sending files on Telegram. Setup ${pctOf(ob)}% done.`).catch(() => {});
  }
}

async function storeButton(env, q) {
  const chatId = q.message?.chat?.id;
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
  const st = await storeByChat(env.DB, chatId);
  const m = String(q.data || '').match(/^sk:(\d+):(\w+)$/);
  if (!st || !m) return;
  try {
    const f = await setFileKind(env.DB, st.id, Number(m[1]), m[2]);
    const ob = await onboarding(env.DB, st);
    await tg(env, 'editMessageText', { chat_id: chatId, message_id: q.message.message_id, text: savedLine(f, ob), reply_markup: kindButtons(f.id, f.kind) });
  } catch (e) {
    return send(env, chatId, '⚠️ ' + esc(e.message || e));
  }
}


// ---------- Shelf labels ----------
const LABELS_MAX = 36;   // 3 A4 pages
export async function sendDocument(env, chatId, bytes, filename, caption = '', extra = {}) {
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  fd.append('document', new Blob([bytes], { type: 'application/pdf' }), filename);
  if (caption) { fd.append('caption', caption.slice(0, 1024)); fd.append('parse_mode', 'HTML'); }
  for (const [k, v] of Object.entries(extra)) fd.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  const r = await fetch(API(env, 'sendDocument'), { method: 'POST', body: fd });
  return r.json();
}

export async function sendLabels(env, chatId, query, { all = false } = {}) {
  query = String(query || '').trim().slice(0, 80);
  const found = await findLabelItems(env.DB, query, 200);
  const priced = found.filter((i) => i.price != null && Number(i.price) > 0);
  const noPrice = found.filter((i) => !(i.price != null && Number(i.price) > 0));
  if (!found.length) return send(env, chatId, `🏷 No items found for "<b>${esc(query)}</b>". Try fewer words, like <i>seagram</i>.`);
  if (!priced.length) return send(env, chatId, `🏷 Found ${found.length} item${found.length > 1 ? 's' : ''} for "${esc(query)}", but none has a price yet. Ring one up once, or set the price, then try again.`);
  if (priced.length > 12 && !all) {
    await setSetting(env.DB, 'tg_label_q', query);
    const shown = priced.slice(0, 15).map((i) => `• ${esc(i.raw)} · $${Number(i.price).toFixed(2)}`).join('\n');
    const n = Math.min(priced.length, LABELS_MAX);
    return send(env, chatId, `🏷 <b>${priced.length} items</b> match "${esc(query)}":\n${shown}${priced.length > 15 ? `\n…and ${priced.length - 15} more` : ''}\n\nType more words to narrow it (like <i>${esc(query)} 375</i>), or print them all.`,
      { reply_markup: { inline_keyboard: [[{ text: `🖨 Print all ${n}${priced.length > LABELS_MAX ? ` of ${priced.length}` : ''}`, callback_data: 'lb:all' }]] } });
  }
  const items = priced.slice(0, LABELS_MAX);
  await tg(env, 'sendChatAction', { chat_id: chatId, action: 'upload_document' }).catch(() => {});
  const today = todayLocal();
  const pdf = labelPdf(items, { date: labelDate(today), title: `Shelf labels: ${query}` });
  const lines = [`🏷 <b>${items.length} label${items.length > 1 ? 's' : ''}</b> · ${esc(query)} · ${Math.ceil(items.length / 12)} A4 page${items.length > 12 ? 's' : ''}`,
    'Print at 100% (“Actual size”), then cut on the marks.'];
  const guessed = items.filter((i) => i.priceSource === 'estimated');
  if (guessed.length) lines.push(`⚠️ Check these prices with your register first: ${guessed.map((i) => `${esc(i.raw)} $${Number(i.price).toFixed(2)}`).join('; ')}`);
  lines.push('Price wrong? Fix it, then ask again: <i>/price 18.99 seagram 750</i>');
  const noUpc = items.filter((i) => !i.upc).length;
  if (noUpc) lines.push(`${noUpc} label${noUpc > 1 ? 's have' : ' has'} no barcode (no UPC on file yet).`);
  if (noPrice.length) lines.push(`Skipped (no price): ${noPrice.slice(0, 5).map((i) => esc(i.raw)).join('; ')}${noPrice.length > 5 ? '…' : ''}`);
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'items';
  const r = await sendDocument(env, chatId, pdf, `labels_${slug}_${today}.pdf`, lines.join('\n'));
  if (!r?.ok) return send(env, chatId, '⚠️ Couldn’t send the label PDF: ' + esc(r?.description || 'unknown error'));
  return r;
}
