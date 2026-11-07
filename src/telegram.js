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
  distributorOrderSuggestions
} from './db.js';
import { askAssistant, extractInvoice } from './ai.js';
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

const HELP = `<b>🥃 Discount Liquor Bot</b>
Just type normally, e.g. <i>how many Don Julio 750 do I have?</i> or <i>I have 4 Don Julio Reposado 750</i>.

<b>Commands:</b>
/stock don julio 750 – stock for matching items
/count 4 don julio reposado 750 – set shelf count
/adjust -1 hennessy 375 broken – add/remove bottles
/price 59.99 don julio 750 – set pre-tax shelf price
/sales – yesterday's sales (/sales week or /sales 2026-11-05)
/low – items out of stock or to reorder
/orders – distributor order suggestions
/invoices – recent distributor invoices
/undo – reverse your last count/adjust/price change
/dashboard – link to web dashboard

📎 <b>Send an invoice PDF or photo</b> – I extract it and ask before saving.
📎 <b>Send a Daily Sales Report CSV</b> – I load the day's sales.`;

export async function handleUpdate(env, update, ctx) {
  if (update.callback_query) return onButton(env, update.callback_query);
  const msg = update.message || update.edited_message;
  if (!msg) return;
  const chatId = msg.chat.id;

  if (!env.OWNER_CHAT_ID) {
    return send(env, chatId, `Setup: your Telegram chat id is <code>${chatId}</code>. Save it as OWNER_CHAT_ID.`);
  }
  if (String(chatId) !== String(env.OWNER_CHAT_ID)) return; // Strictly ignore everyone else

  try {
    if (msg.document || msg.photo) return await onFile(env, msg);
    const text = (msg.text || msg.caption || '').trim();
    if (!text) return;
    await log(env, 'user', text);
    if (text.startsWith('/')) return await onCommand(env, chatId, text);
    if (!env.GEMINI_API_KEY) return send(env, chatId, 'AI is not set up yet – use the commands:\n\n' + HELP);

    await tg(env, 'sendChatAction', { chat_id: chatId, action: 'typing' });
    const history = await recentHistory(env);
    const answer = await askAssistant(env, text, history);
    await log(env, 'bot', answer);
    await send(env, chatId, esc(answer));
  } catch (e) {
    await send(env, chatId, '⚠️ ' + esc(e.message || e));
  }
}

async function onCommand(env, chatId, text) {
  const [cmd0, ...rest] = text.split(/\s+/);
  const cmd = cmd0.toLowerCase().replace(/@.*/, '');
  const arg = rest.join(' ');
  const db = env.DB;

  if (cmd === '/start' || cmd === '/help') return send(env, chatId, HELP);
  if (cmd === '/dashboard') return send(env, chatId, `Dashboard: ${env.PUBLIC_URL || '(set PUBLIC_URL)'}/`);

  if (cmd === '/stock') {
    const rows = await searchProducts(db, arg, 8);
    if (!rows.length) return send(env, chatId, 'No product found for "' + esc(arg) + '"');
    const out = [];
    for (const p of rows) {
      const s = await stockFor(db, p.id);
      const pr = p.price != null ? ` [${p.price_source === 'estimated' ? '~' : ''}$${Number(p.price).toFixed(2)}]` : '';
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
    await db.prepare("UPDATE products SET price=?, price_source='manual' WHERE id=?").bind(newPrice, p.id).run();
    await setSetting(db, 'last_change', JSON.stringify({ type: 'price', product_id: p.id, old: oldPrice, old_source: p.price_source }));
    return send(env, chatId, `🏷️ ${esc(pname(p))}: ${oldPrice != null ? '$' + Number(oldPrice).toFixed(2) : 'none'} → <b>$${newPrice.toFixed(2)}</b> (manual)\n(/undo to reverse)`);
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
    await db.prepare('UPDATE products SET price=?, price_source=? WHERE id=?').bind(c.old, c.old_source || 'estimated', c.product_id).run();
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
    ...st.lines.map(l => `• ${esc(l.description)} – <b>${l.bottles}</b> units @ ${money(l.unit_cost)}${l.matched ? '' : ' 🆕'}`),
    '',
    newOnes ? `🆕 = ${newOnes} new product(s) will be created.` : 'All items matched to existing products.',
    'Save these bottles into inventory?'
  ].join('\n');
}

async function onButton(env, q) {
  const chatId = q.message?.chat?.id;
  if (String(chatId) !== String(env.OWNER_CHAT_ID)) return;
  const [act, id] = String(q.data || '').split(':');
  await tg(env, 'answerCallbackQuery', { callback_query_id: q.id });

  if (act === 'post') {
    const r = await postInvoice(env.DB, Number(id));
    await tg(env, 'editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
    return send(env, chatId, r.already ? 'Already saved.' : `✅ Saved: ${r.lines} lines added to inventory${r.new_products ? `, ${r.new_products} new products created` : ''}.`);
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
