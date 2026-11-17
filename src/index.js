// Discount Liquor – Cloudflare Worker Entry & API Router
import { runBrain, listFindings, findingsSummary, decide, briefText } from './brain.js';
import { joinPage, saveSignup, signupAlert, listStores, decideStore } from './signup.js';
import {
  inventory,
  salesSummary,
  ledger,
  searchProducts,
  setCount,
  adjust,
  todayLocal,
  addDays,
  setSetting,
  distributorOrderSuggestions,
  stockFor,
  getDraftPOs,
  addToDraftPO,
  updateDraftPOLine,
  removeLineFromDraftPO,
  addAllReorderToDraftPO,
  clearDraftPO,
  markPOAsOrdered,
  getPOHistory
} from './db.js';
import {
  ingestSalesCsv,
  dateFromFilename,
  stageInvoice,
  postInvoice
} from './ingest.js';
import { askAssistant, extractInvoice, getAiStats, resetAiStats } from './ai.js';
import {
  handleUpdate,
  send,
  formatSales,
  esc,
  undo,
  invoicePreview,
  pname,
  money,
  alertGeminiFailure
} from './telegram.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-ingest-key',
    'access-control-allow-methods': 'GET, POST, OPTIONS'
  }
});

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'content-type, x-ingest-key',
          'access-control-allow-methods': 'GET, POST, OPTIONS'
        }
      });
    }

    try {
      // 0. New store sign-up (public): the onboarding page and its form
      if (p === '/join' && req.method === 'GET') {
        return new Response(joinPage(env.SITE_URL || 'https://qilbo.pages.dev'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      if (p === '/api/public/signup' && req.method === 'POST') {
        let body;
        try { body = await req.json(); } catch { return json({ ok: false, errors: ['Bad request'] }, 400); }
        const r = await saveSignup(env.DB, body || {}, req.headers.get('cf-connecting-ip') || '');
        if (r.ok && r.id && env.OWNER_CHAT_ID) {
          ctx.waitUntil(send(env, env.OWNER_CHAT_ID, signupAlert(r), { reply_markup: { inline_keyboard: [[
            { text: '✅ Start pilot', callback_data: `sa:${r.id}` }, { text: '✖️ Decline', callback_data: `sd:${r.id}` }
          ]] } }).catch(() => {}));
        }
        return json(r.ok ? { ok: true, code: r.code } : r, r.ok ? 200 : 400);
      }

      // 1. Telegram Webhook
      if (p === '/telegram' && req.method === 'POST') {
        if (req.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_WEBHOOK_SECRET) {
          return new Response('Unauthorized', { status: 401 });
        }
        const update = await req.json();
        ctx.waitUntil(handleUpdate(env, update, ctx).catch(e => console.error('Telegram update error:', e)));
        return new Response('ok');
      }

      // 2. Ingest Sales CSV (Push from Google Apps Script)
      if (p === '/ingest/sales' && req.method === 'POST') {
        if (req.headers.get('x-ingest-key') !== env.INGEST_KEY) {
          return json({ error: 'unauthorized' }, 401);
        }
        const fileName = url.searchParams.get('file') || '';
        const date = url.searchParams.get('date') || dateFromFilename(fileName);
        const csvContent = await req.text();
        const res = await ingestSalesCsv(env.DB, csvContent, date, fileName);

        if (url.searchParams.get('notify') !== '0' && env.OWNER_CHAT_ID) {
          ctx.waitUntil(
            salesSummary(env.DB, date, date).then(s =>
              send(env, env.OWNER_CHAT_ID, '📊 <b>New daily report loaded</b>\n' + formatSales(s))
            )
          );
        }
        return json(res);
      }

      // 3. Ingest Distributor Invoice (Push from Google Apps Script)
      if (p === '/ingest/invoice' && req.method === 'POST') {
        if (req.headers.get('x-ingest-key') !== env.INGEST_KEY) {
          return json({ error: 'unauthorized' }, 401);
        }
        const ct = req.headers.get('content-type') || '';
        let inv, key = null;

        if (ct.includes('application/json')) {
          inv = await req.json();
        } else {
          if (!env.GEMINI_API_KEY) return json({ error: 'Gemini AI not configured' }, 400);
          const bytes = new Uint8Array(await req.arrayBuffer());
          const fileName = url.searchParams.get('file') || `invoice_${Date.now()}.pdf`;
          key = `invoices/${todayLocal()}/${Date.now()}_${fileName.replace(/[^\w.-]/g, '_')}`;
          if (env.FILES) {
            await env.FILES.put(key, bytes, { httpMetadata: { contentType: ct || 'application/pdf' } });
          }
          inv = await extractInvoice(env, bytes, ct.split(';')[0] || 'application/pdf');
          if (url.searchParams.get('distributor')) inv.distributor = url.searchParams.get('distributor');
        }

        const st = await stageInvoice(env.DB, inv, {
          file_key: key,
          source: url.searchParams.get('source') || 'email'
        });

        // Always ask owner before saving to inventory
        if (!st.duplicate && env.OWNER_CHAT_ID) {
          ctx.waitUntil(
            send(env, env.OWNER_CHAT_ID, '📧 <b>New invoice received</b>\n' + invoicePreview(st), {
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ Save to inventory', callback_data: 'post:' + st.id },
                  { text: '❌ Discard', callback_data: 'drop:' + st.id }
                ]]
              }
            })
          );
        }
        return json(st);
      }

      // 4. Authentication: Login & Logout
      if (p === '/login' && req.method === 'POST') {
        let password = '';
        const ct = req.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const body = await req.json();
          password = body.password;
        } else {
          const form = await req.formData();
          password = form.get('password');
        }

        if (!env.DASHBOARD_PASSWORD || password !== env.DASHBOARD_PASSWORD) {
          if (ct.includes('application/json')) {
            return json({ error: 'invalid password' }, 401);
          }
          return Response.redirect(url.origin + '/?bad=1', 303);
        }

        const token = await sign(env, String(Date.now() + 30 * 864e5));
        const cookieHeader = `dl=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`;

        if (ct.includes('application/json')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json', 'set-cookie': cookieHeader }
          });
        }
        return new Response(null, {
          status: 303,
          headers: { location: '/', 'set-cookie': cookieHeader }
        });
      }

      if (p === '/logout') {
        const cookieHeader = 'dl=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
        if (req.headers.get('accept')?.includes('application/json')) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'content-type': 'application/json', 'set-cookie': cookieHeader }
          });
        }
        return new Response(null, {
          status: 303,
          headers: { location: '/', 'set-cookie': cookieHeader }
        });
      }

      // 5. Auth verification for protected API & Web UI
      const authed = await checkCookie(env, req);

      // Protected API Endpoints
      if (p.startsWith('/api/')) {
        if (!authed) return json({ error: 'login required' }, 401);
        return await handleApi(req, env, url, ctx);
      }

      // Serve UI: If static assets bound, use ASSETS fetcher
      if (env.ASSETS) {
        if (!authed && (p === '/' || p === '/index.html')) {
          return new Response(loginPage(url.searchParams.has('bad')), {
            headers: { 'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY' }
          });
        }
        const assetRes = await env.ASSETS.fetch(req);
        if (assetRes.status !== 404) return assetRes;
      }

      // Fallback dashboard view if static assets not yet bundled into worker
      if (p === '/' || p === '/index.html') {
        if (!authed) {
          return new Response(loginPage(url.searchParams.has('bad')), {
            headers: { 'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY' }
          });
        }
        return new Response(dashboardShellHtml(), {
          headers: { 'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY' }
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      console.error('Worker request error:', err);
      return json({ error: String(err.message || err) }, 500);
    }
  },

  // Scheduled Cron Jobs (Runs at :45 every hour, plus :30 on Mondays)
  async scheduled(event, env, ctx) {
    if (!env.OWNER_CHAT_ID) return;

    // Check America/New_York local time (handles EDT/EST automatically all year)
    const nyFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric'
    });
    const parts = Object.fromEntries(nyFmt.formatToParts(new Date()).map(p => [p.type, p.value]));
    const localHour = Number(parts.hour);
    const localMinute = Number(parts.minute);
    const localWeekday = parts.weekday; // 'Mon', 'Tue', etc.

    // Silent window: between 10 PM (22) and 8 AM (8)
    if (localHour < 8 || localHour >= 22) {
      return;
    }

    const today = todayLocal();
    const yesterday = addDays(today, -1);

    // 1. Monday 9:30 AM Weekly Report (triggered at :30 on Mondays)
    if (localWeekday === 'Mon' && localHour === 9 && localMinute >= 25 && localMinute <= 35) {
      const inv = await inventory(env.DB, { onlyTracked: true });
      const weekStart = addDays(yesterday, -6);
      const weekSales = await salesSummary(env.DB, weekStart, yesterday);
      const deadStock = inv.filter(r => r.status === 'NOT SELLING');
      const needCount = inv.filter(r => r.needs_count);

      let weeklyMsg = `📈 <b>Weekly Summary (${weekStart} → ${yesterday})</b>\n`;
      weeklyMsg += `Total Store Sales: <b>${money(weekSales.store_sales)}</b>\n`;
      if (weekSales.tracked_margin != null) {
        weeklyMsg += `Tracked Profit: ${money(weekSales.tracked_profit)} (${(weekSales.tracked_margin * 100).toFixed(0)}% margin)\n`;
      }
      if (weekSales.top_shelf?.amount) {
        weeklyMsg += `Top Shelf: ${money(weekSales.top_shelf.amount)} (${(weekSales.top_shelf.share * 100).toFixed(0)}%)\n`;
      }
      if (weekSales.top_items.length) {
        weeklyMsg += `\n<b>Top 5 Best Sellers:</b>\n` +
          weekSales.top_items.slice(0, 5).map(it => `• ${esc(it.name)} ×${it.qty} (${money(it.amount)})`).join('\n') + '\n';
      }
      if (deadStock.length) {
        weeklyMsg += `\n⚠️ <b>Dead Stock (0 sales in 60d):</b> ${deadStock.length} items\n`;
      }
      if (needCount.length) {
        weeklyMsg += `🔍 <b>Items needing physical shelf count:</b> ${needCount.length} items (/low)\n`;
      }
      ctx.waitUntil(send(env, env.OWNER_CHAT_ID, weeklyMsg));
      return;
    }

    // 2. Daily 9:45 AM Morning Report (triggered at :45 daily)
    if (localHour === 9 && localMinute >= 40 && localMinute <= 50) {
      const sameDayLastWeek = addDays(yesterday, -7);
      const ySales = await salesSummary(env.DB, yesterday, yesterday);
      const lastWeekSales = await salesSummary(env.DB, sameDayLastWeek, sameDayLastWeek);
      const inv = await inventory(env.DB, { onlyTracked: true });
      const low = inv.filter(r => r.status === 'OUT' || r.status === 'REORDER');
      const pend = await env.DB.prepare("SELECT COUNT(*) n FROM invoices WHERE status='pending'").first();

      let text = `☀️ <b>Good morning! Yesterday's Report (${yesterday})</b>\n`;
      if (ySales.daily.length) {
        const diff = ySales.store_sales - lastWeekSales.store_sales;
        const pct = lastWeekSales.store_sales > 0 ? (diff / lastWeekSales.store_sales) * 100 : 0;
        const trend = diff >= 0 ? `+${money(diff)} (+${pct.toFixed(1)}%)` : `${money(diff)} (${pct.toFixed(1)}%)`;

        text += `Store Sales (no lottery): <b>${money(ySales.store_sales)}</b>\n`;
        text += `Vs same day last week (${sameDayLastWeek}): ${money(lastWeekSales.store_sales)} (${trend})\n`;
        if (ySales.tracked_margin != null) {
          text += `Tracked Profit: ${money(ySales.tracked_profit)} (${(ySales.tracked_margin * 100).toFixed(0)}% margin)\n`;
        }
        if (ySales.top_items.length) {
          text += `\n<b>Top 5 Items:</b>\n` +
            ySales.top_items.slice(0, 5).map(it => `• ${esc(it.name)} ×${it.qty} (${money(it.amount)})`).join('\n') + '\n';
        }
      } else {
        text += `<i>Yesterday's sales report has not arrived yet.</i>\n`;
      }

      if (low.length) {
        text += `\n🚨 <b>Out / Reorder Alert (${low.length} items):</b>\n` +
          low.slice(0, 8).map(r => `• ${esc(pname(r))}: <b>${r.on_hand}</b> left (~${r.per_week}/wk)`).join('\n') +
          (low.length > 8 ? `\n<i>...and ${low.length - 8} more (/low)</i>` : '');
      }

      if (pend && pend.n > 0) {
        text += `\n\n⏳ <b>${pend.n} invoice(s) waiting for your review.</b>`;
      }

      ctx.waitUntil((async () => {
        await send(env, env.OWNER_CHAT_ID, text);
        // Qilbo brain: run the checks on yesterday's data, then send what to fix with Approve / Skip buttons
        try {
          await runBrain(env.DB);
          const brief = await briefText(env.DB);
          const keyboard = brief.items.map((f, i) => ([
            { text: `✅ ${i + 1} Approve`, callback_data: `fa:${f.id}` },
            { text: `⏭ ${i + 1} Skip`, callback_data: `fs:${f.id}` }
          ]));
          await send(env, env.OWNER_CHAT_ID, brief.text, keyboard.length ? { reply_markup: { inline_keyboard: keyboard } } : {});
        } catch (err) {
          await send(env, env.OWNER_CHAT_ID, `⚠️ Qilbo brain check failed: ${esc(String(err.message || err))}`);
        }
      })());
      return;
    }
  }
};

// Protected API Router
async function handleApi(req, env, url, ctx) {
  const db = env.DB;
  const p = url.pathname;
  const q = url.searchParams;

  // Stores that signed up through /join
  if (p === '/api/stores' && req.method === 'GET') return json({ stores: await listStores(db) });
  const sm = p.match(/^\/api\/stores\/(\d+)\/(approve|decline)$/);
  if (sm && req.method === 'POST') return json(await decideStore(db, sm[1], sm[2]));

  // Qilbo brain: findings from the nightly checks
  if (p === '/api/brain' && req.method === 'GET') {
    const [items, summary, run] = await Promise.all([
      listFindings(db, { status: q.get('status') || 'open,approved', engine: q.get('engine') || undefined, limit: Number(q.get('limit') || 200) }),
      findingsSummary(db),
      db.prepare('SELECT * FROM brain_runs ORDER BY id DESC LIMIT 1').first()
    ]);
    return json({ items, summary, last_run: run });
  }
  if (p === '/api/brain/run' && req.method === 'POST') {
    return json(await runBrain(db));
  }
  const dm = p.match(/^\/api\/brain\/(\d+)\/(approve|skip|reopen)$/);
  if (dm && req.method === 'POST') {
    return json(await decide(db, dm[1], dm[2]));
  }

  // GET /api/summary
  if (p === '/api/summary') {
    const y = addDays(todayLocal(), -1);
    const last = await db.prepare('SELECT MAX(sale_date) d FROM sales').first();
    const day = q.get('date') || last?.d || y;
    const start = q.get('start');
    const end = q.get('end');
    const days = Number(q.get('days') || 30);
    const rangeStart = start || addDays(day, -(days - 1));
    const rangeEnd = end || day;

    const [one, range, inv, pend, orders] = await Promise.all([
      salesSummary(db, rangeStart, rangeEnd),
      salesSummary(db, rangeStart, rangeEnd),
      inventory(db, { onlyTracked: false, start: rangeStart, end: rangeEnd }),
      db.prepare("SELECT COUNT(*) n FROM invoices WHERE status='pending'").first(),
      distributorOrderSuggestions(db)
    ]);

    const counts = { OUT: 0, REORDER: 0, OVERSTOCK: 0, 'NOT SELLING': 0, 'NOT COUNTED': 0, OK: 0 };
    let totalStockValue = 0;
    let needsCountCount = 0;

    for (const r of inv) {
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (r.stock_value) totalStockValue += r.stock_value;
      if (r.needs_count) needsCountCount++;
    }

    return json({
      day: one,
      range,
      inventory: {
        counts,
        stock_value: +totalStockValue.toFixed(2),
        tracked: inv.filter(r => r.status !== 'NOT COUNTED').length,
        total_products: inv.length,
        needs_count: needsCountCount
      },
      pending_invoices: pend?.n || 0,
      distributor_orders: orders
    });
  }

  // GET /api/inventory
  if (p === '/api/inventory') {
    const items = await inventory(db, {
      category: q.get('category') || undefined,
      subCategory: q.get('sub_category') || undefined,
      distributor: q.get('distributor') || undefined,
      brand: q.get('brand') || undefined,
      status: q.get('status') || undefined,
      isTopShelf: q.get('top_shelf') === '1' || q.get('top_shelf') === 'true',
      onlyTracked: q.get('all') !== '1',
      start: q.get('start') || undefined,
      end: q.get('end') || undefined,
      days: q.get('days') ? Number(q.get('days')) : undefined
    });
    return json(items);
  }

  // GET /api/sales
  if (p === '/api/sales') {
    const end = q.get('end') || todayLocal();
    const start = q.get('start') || addDays(end, -29);
    return json(await salesSummary(db, start, end));
  }

  // GET /api/product
  if (p === '/api/product') {
    const id = Number(q.get('id'));
    const item = await ledger(db, id);
    if (!item) return json({ error: 'not found' }, 404);
    return json(item);
  }

  // GET /api/search
  if (p === '/api/search') {
    const query = q.get('q') || '';
    const limit = Number(q.get('limit') || 15);
    return json(await searchProducts(db, query, limit));
  }

  // GET /api/orders
  if (p === '/api/orders') {
    return json(await distributorOrderSuggestions(db));
  }

  // GET /api/invoices
  if (p === '/api/invoices') {
    const rows = (await db.prepare(`
      SELECT i.id, i.distributor, i.invoice_no, i.invoice_date, i.total, i.status, i.source, i.file_key, i.created_at,
             COUNT(l.id) as line_count
      FROM invoices i
      LEFT JOIN invoice_lines l ON l.invoice_id = i.id
      GROUP BY i.id
      ORDER BY COALESCE(i.invoice_date, i.created_at) DESC
      LIMIT 100
    `).all()).results;
    return json(rows);
  }

  // GET /api/invoice
  if (p === '/api/invoice') {
    const id = Number(q.get('id'));
    const inv = await db.prepare('SELECT id, distributor, invoice_no, invoice_date, total, status, file_key, source FROM invoices WHERE id=?').bind(id).first();
    if (!inv) return json({ error: 'invoice not found' }, 404);
    const lines = (await db.prepare(`
      SELECT l.*, p.name product_name, p.clean_name, p.size, p.cost current_cost, p.price current_price
      FROM invoice_lines l
      LEFT JOIN products p ON p.id = l.product_id
      WHERE l.invoice_id = ?
    `).bind(id).all()).results;
    return json({ invoice: inv, lines });
  }

  // GET /api/invoice/file
  if (p === '/api/invoice/file' && env.FILES) {
    const id = Number(q.get('id'));
    const inv = await db.prepare('SELECT file_key FROM invoices WHERE id=?').bind(id).first();
    const obj = inv?.file_key ? await env.FILES.get(inv.file_key) : null;
    if (!obj) return json({ error: 'file not found' }, 404);
    return new Response(obj.body, {
      headers: { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream' }
    });
  }

  // GET /api/ai/stats
  if (p === '/api/ai/stats') {
    return json(getAiStats());
  }

  // GET /api/po/drafts
  if (p === '/api/po/drafts') {
    return json(await getDraftPOs(db));
  }

  // GET /api/po/history
  if (p === '/api/po/history') {
    const limit = Number(q.get('limit') || 50);
    return json(await getPOHistory(db, limit));
  }

  // GET /api/categories/suggestions
  if (p === '/api/categories/suggestions') {
    const status = q.get('status') || 'pending';
    const rows = await db.prepare(
      'SELECT * FROM category_review_suggestions WHERE status = ? ORDER BY confidence DESC, product_id ASC'
    ).bind(status).all();
    return json({ suggestions: rows.results || [] });
  }

  // POST Mutating Endpoints
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const body = req.headers.get('content-type')?.includes('application/json') ? await req.json() : {};

  // POST /api/ai/reset
  if (p === '/api/ai/reset') {
    resetAiStats();
    return json({ ok: true, stats: getAiStats() });
  }

  // POST /api/count
  if (p === '/api/count') {
    const pid = Number(body.product_id);
    const qty = Number(body.qty);
    const note = body.note || 'dashboard count';
    const before = await stockFor(db, pid);
    const after = await setCount(db, pid, qty, note);
    await setSetting(db, 'last_change', JSON.stringify({ type: 'count', product_id: pid }));
    return json({ saved: true, before: before.on_hand, after: after.on_hand });
  }

  // POST /api/adjust
  if (p === '/api/adjust') {
    const pid = Number(body.product_id);
    const delta = Number(body.delta);
    const reason = body.reason || 'dashboard adjustment';
    const after = await adjust(db, pid, delta, reason);
    await setSetting(db, 'last_change', JSON.stringify({ type: 'adjust', product_id: pid }));
    return json({ saved: true, on_hand: after.on_hand });
  }

  // POST /api/price
  if (p === '/api/price') {
    const pid = Number(body.product_id);
    const price = body.price != null ? Number(body.price) : null;
    const cost = body.cost != null ? Number(body.cost) : null;
    const old = await db.prepare('SELECT price, price_source, price_warning FROM products WHERE id=?').bind(pid).first();

    await db.prepare(`
      UPDATE products
      SET price = COALESCE(?, price),
          cost = COALESCE(?, cost),
          price_source = CASE WHEN ? IS NOT NULL THEN 'manual' ELSE price_source END,
          price_warning = CASE WHEN ? IS NOT NULL THEN NULL ELSE price_warning END
      WHERE id = ?
    `).bind(price, cost, price, price, pid).run();

    await setSetting(db, 'last_change', JSON.stringify({ type: 'price', product_id: pid, old: old?.price, old_source: old?.price_source, old_warning: old?.price_warning }));
    return json({ ok: true });
  }

  // POST /api/product/toggle-no-reorder
  if (p === '/api/product/toggle-no-reorder') {
    const pid = Number(body.product_id);
    const flag = body.do_not_reorder ? 1 : 0;
    await db.prepare('UPDATE products SET do_not_reorder=? WHERE id=?').bind(flag, pid).run();
    return json({ ok: true, product_id: pid, do_not_reorder: flag });
  }

  // POST /api/product/update
  if (p === '/api/product/update') {
    const pid = Number(body.product_id || body.id);
    if (!pid) return json({ error: 'product_id required' }, 400);
    const updates = [];
    const binds = [];
    if (body.brand !== undefined) { binds.push(body.brand); updates.push(`brand = ?${binds.length}`); }
    if (body.category !== undefined) { binds.push(body.category); updates.push(`category = ?${binds.length}`); }
    if (body.distributor !== undefined) { binds.push(body.distributor); updates.push(`distributor = ?${binds.length}`); }
    if (body.price !== undefined) {
      binds.push(Number(body.price)); updates.push(`price = ?${binds.length}`);
      binds.push('manual'); updates.push(`price_source = ?${binds.length}`);
      updates.push('price_warning = NULL');
    }
    if (updates.length > 0) {
      binds.push(pid);
      await db.prepare(`UPDATE products SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?${binds.length}`).bind(...binds).run();
    }
    return json({ ok: true, product_id: pid });
  }

  // POST /api/categories/apply
  if (p === '/api/categories/apply') {
    const items = body.items || [];
    if (!Array.isArray(items) || !items.length) {
      return json({ error: 'items array required' }, 400);
    }
    const stmts = [];
    for (const it of items) {
      const pid = Number(it.product_id);
      const cat = it.category || it.suggested_category;
      const sub = it.sub_category || it.suggested_sub_category;
      const br = it.brand || it.suggested_brand || null;
      if (pid && cat && sub) {
        stmts.push(
          db.prepare(
            "UPDATE products SET category = ?, sub_category = ?, brand = COALESCE(?, brand), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(cat, sub, br, pid)
        );
        stmts.push(
          db.prepare(
            "UPDATE category_review_suggestions SET status = 'approved', suggested_category = ?, suggested_sub_category = ?, suggested_brand = COALESCE(?, suggested_brand) WHERE product_id = ?"
          ).bind(cat, sub, br, pid)
        );
      }
    }
    if (stmts.length) {
      await db.batch(stmts);
    }
    return json({ ok: true, count: items.length });
  }

  // POST /api/categories/reject
  if (p === '/api/categories/reject') {
    const pids = body.product_ids || [];
    if (Array.isArray(pids) && pids.length) {
      const stmts = pids.map(pid =>
        db.prepare("UPDATE category_review_suggestions SET status = 'rejected' WHERE product_id = ?").bind(Number(pid))
      );
      await db.batch(stmts);
    }
    return json({ ok: true, count: pids.length });
  }

  // POST /api/undo
  if (p === '/api/undo') {
    return json({ message: await undo(env) });
  }

  // POST /api/po/item (add or update item in draft PO)
  if (p === '/api/po/item') {
    const productId = Number(body.product_id);
    const cases = Number(body.cases || 1);
    const distributor = body.distributor || undefined;
    if (!productId) return json({ error: 'product_id required' }, 400);
    return json(await addToDraftPO(db, { productId, cases, distributor }));
  }

  // POST /api/po/item/update
  if (p === '/api/po/item/update') {
    const lineId = Number(body.line_id);
    const cases = Number(body.cases);
    if (!lineId || isNaN(cases)) return json({ error: 'line_id and cases required' }, 400);
    return json(await updateDraftPOLine(db, { lineId, cases }));
  }

  // POST /api/po/item/delete
  if (p === '/api/po/item/delete') {
    const lineId = body.line_id ? Number(body.line_id) : undefined;
    const poId = body.po_id ? Number(body.po_id) : undefined;
    const productId = body.product_id ? Number(body.product_id) : undefined;
    return json(await removeLineFromDraftPO(db, { lineId, poId, productId }));
  }

  // POST /api/po/add-reorder
  if (p === '/api/po/add-reorder') {
    const distributor = body.distributor;
    if (!distributor) return json({ error: 'distributor required' }, 400);
    return json(await addAllReorderToDraftPO(db, { distributor }));
  }

  // POST /api/po/clear
  if (p === '/api/po/clear') {
    const distributor = body.distributor || undefined;
    const poId = body.po_id ? Number(body.po_id) : undefined;
    return json(await clearDraftPO(db, { distributor, poId }));
  }

  // POST /api/po/order (mark draft as ordered)
  if (p === '/api/po/order') {
    const distributor = body.distributor || undefined;
    const poId = body.po_id ? Number(body.po_id) : undefined;
    return json(await markPOAsOrdered(db, { distributor, poId }));
  }

  // POST /api/ask
  if (p === '/api/ask') {
    if (!env.GEMINI_API_KEY) return json({ answer: 'Gemini AI key is not configured.' });
    const question = String(body.question || '');
    const history = Array.isArray(body.history) ? body.history : [];
    const today = body.today || env.TODAY_OVERRIDE;
    try {
      return json({ answer: await askAssistant(env, question, history, today) });
    } catch (e) {
      console.error('[Gemini AI Error]', e);
      ctx.waitUntil(alertGeminiFailure(env, e));
      return json({ answer: 'AI is unavailable right now – commands like /stock still work' });
    }
  }

  // POST /api/invoice/post
  if (p === '/api/invoice/post') {
    const id = Number(body.id);
    return json(await postInvoice(db, id));
  }

  // POST /api/invoice/discard
  if (p === '/api/invoice/discard') {
    const id = Number(body.id);
    await db.batch([
      db.prepare('DELETE FROM invoice_lines WHERE invoice_id=?').bind(id),
      db.prepare("DELETE FROM invoices WHERE id=? AND status<>'posted'").bind(id)
    ]);
    return json({ ok: true });
  }

  // POST /api/upload (CSV sales or invoice PDF/photo)
  if (p === '/api/upload') {
    const form = await req.formData();
    const file = form.get('file');
    if (!file) return json({ error: 'no file provided' }, 400);

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (/\.csv$/i.test(file.name)) {
      const date = form.get('date') || dateFromFilename(file.name);
      const csvStr = new TextDecoder().decode(bytes);
      const res = await ingestSalesCsv(db, csvStr, date, file.name);
      return json({ kind: 'sales', ...res });
    }

    if (!env.GEMINI_API_KEY) {
      return json({ error: 'AI not configured – cannot extract PDFs/photos' }, 400);
    }

    const key = `invoices/${todayLocal()}/${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`;
    if (env.FILES) {
      await env.FILES.put(key, bytes, { httpMetadata: { contentType: file.type || 'application/pdf' } });
    }
    const inv = await extractInvoice(env, bytes, file.type || 'application/pdf');
    const st = await stageInvoice(db, inv, { file_key: key, source: 'dashboard' });
    return json({ kind: 'invoice', ...st });
  }

  return json({ error: 'endpoint not found' }, 404);
}

// Signed Cookie Authentication
async function hmac(env, data) {
  const secret = (env.DASHBOARD_PASSWORD || '') + '|' + (env.INGEST_KEY || '');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
}

async function sign(env, exp) {
  return exp + '.' + await hmac(env, exp);
}

async function checkCookie(env, req) {
  if (env.TEST_MODE) return true;
  if (!env.DASHBOARD_PASSWORD) return false;
  const match = (req.headers.get('cookie') || '').match(/(?:^|;\s*)dl=([^;]+)/);
  if (!match) return false;
  const [exp, sig] = match[1].split('.');
  if (!exp || !sig) return false;
  return Number(exp) > Date.now() && sig === await hmac(env, exp);
}

function loginPage(bad = false) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Discount Liquor – Eustis FL</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .box { background: #1e293b; padding: 32px; border-radius: 16px; width: min(340px, 90vw); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); border: 1px solid #334155; }
    h2 { margin: 0 0 6px; font-size: 22px; color: #f8fafc; }
    p { margin: 0 0 20px; font-size: 13px; color: #94a3b8; }
    input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #fff; font-size: 16px; box-sizing: border-box; margin-bottom: 14px; }
    button { width: 100%; padding: 12px; border-radius: 8px; border: 0; background: #f59e0b; color: #0f172a; font-size: 16px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #d97706; }
    .err { color: #f87171; font-size: 13px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>🥃 Discount Liquor</h2>
    <p>2105 E Orange Ave, Eustis FL</p>
    <form method="post" action="/login">
      ${bad ? '<div class="err">Wrong password. Try again.</div>' : ''}
      <input type="password" name="password" placeholder="Dashboard password" autofocus required />
      <button type="submit">Sign in</button>
    </form>
    <p style="margin:16px 0 0;text-align:center"><a href="/join" style="color:#93c5fd;text-decoration:none">New store? Register for Qilbo →</a></p>
  </div>
</body>
</html>`;
}

function dashboardShellHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Discount Liquor – Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 22px; }
    a.btn { background: #334155; color: #f8fafc; text-decoration: none; padding: 8px 14px; border-radius: 6px; font-size: 13px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 20px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>🥃 Discount Liquor</h1>
      <div style="font-size: 12px; color: #94a3b8;">Store Backend & Stock Ledger (Eustis FL)</div>
    </div>
    <a href="/logout" class="btn">Sign out</a>
  </header>
  <div class="card">
    <h3>✅ Cloudflare Backend Active</h3>
    <p style="color: #94a3b8; font-size: 14px;">The Stock Ledger Engine and API routes are running. All 5 tabs will connect directly via <code>/api/*</code>.</p>
    <p style="font-size: 13px; color: #38bdf8;">API endpoints ready: /api/summary, /api/inventory, /api/sales, /api/product, /api/orders, /api/invoices, /api/ask</p>
  </div>
</body>
</html>`;
}
