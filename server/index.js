import express from "express";
import cors from "cors";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const LIVE_DATA_PATH = path.join(PROJECT_ROOT, "qilbo-app", "src", "data", "live_inventory.json");

// Scrapes DuckDuckGo's image search (which aggregates Bing results) for a
// product photo. This is genuinely different from the Wikimedia Commons
// lookup used elsewhere in the app: those images are explicitly licensed for
// reuse, these are not — DuckDuckGo's terms don't cover programmatic scraping
// of search results, and most returned images are the retailer's or brand's
// own copyrighted product photography. The user explicitly chose this path
// for internal inventory-display use (not redistribution/resale) after being
// told the alternative was a free/licensed-only source with weaker coverage.
// Runs server-side because DuckDuckGo doesn't allow cross-origin browser
// requests to these endpoints (no CORS headers on their side).

const PORT = process.env.PORT || 8787;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const OK_FORMATS = new Set(["jpeg", "jpg", "png", "webp"]);
const MIN_DIMENSION = 200; // skip icons/tiny thumbnails, not real product shots

// Simple in-memory cache — same query re-run (e.g. retrying a failed
// enrichment batch) shouldn't re-scrape. Not persisted; fine for a
// single-process dev/prototype server.
const cache = new Map(); // query -> { url, title, source } | null
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheTimestamps = new Map();

async function getVqd(query) {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
  const res = await fetch(searchUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`search page fetch failed: ${res.status}`);
  const html = await res.text();
  const m = html.match(/vqd=['"]([\d-]+)['"]/) || html.match(/vqd=([\d-]+)&/);
  if (!m) throw new Error("could not find vqd token");
  return { vqd: m[1], searchUrl };
}

async function searchImages(query) {
  const { vqd, searchUrl } = await getVqd(query);
  const imgUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`;
  const res = await fetch(imgUrl, {
    headers: { "User-Agent": UA, Referer: searchUrl, "X-Requested-With": "XMLHttpRequest" },
  });
  if (!res.ok) throw new Error(`image results fetch failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

function pickBest(results) {
  for (const r of results) {
    const fmt = (r.encoding_format || "").toLowerCase();
    if (!OK_FORMATS.has(fmt)) continue;
    if ((r.width || 0) < MIN_DIMENSION || (r.height || 0) < MIN_DIMENSION) continue;
    if (!r.image) continue;
    return { url: r.image, title: r.title || "", source: r.url || "" };
  }
  return null;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/api/image-search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "missing q" });

  const cached = cache.get(q);
  const cachedAt = cacheTimestamps.get(q) || 0;
  if (cached !== undefined && Date.now() - cachedAt < CACHE_TTL_MS) {
    return res.json({ result: cached, cached: true });
  }

  try {
    const results = await searchImages(q);
    const best = pickBest(results);
    cache.set(q, best);
    cacheTimestamps.set(q, Date.now());
    res.json({ result: best, cached: false });
  } catch (err) {
    console.error(`image-search failed for "${q}":`, err.message);
    res.status(502).json({ error: "search failed", detail: err.message });
  }
});

// --- NRS Daily Sales & Live Stock Endpoints ---

// 1. Get Live Inventory & Sales State
app.get("/api/nrs/state", (_req, res) => {
  try {
    if (fs.existsSync(LIVE_DATA_PATH)) {
      const raw = fs.readFileSync(LIVE_DATA_PATH, "utf-8");
      return res.json(JSON.parse(raw));
    }
    res.status(404).json({ error: "No live inventory data found. Run sync first." });
  } catch (err) {
    res.status(500).json({ error: "Failed to read live data", detail: err.message });
  }
});

// 2. Trigger NRS Ingestion Pipeline (From Gmail or local sample)
app.post("/api/nrs/sync", (req, res) => {
  const fromGmail = req.query.gmail === "true";
  const cmd = fromGmail
    ? "python3 -m nrs_pipeline.sync_engine --fetch-gmail"
    : "python3 -m nrs_pipeline.sync_engine";

  console.log(`[NRS Sync] Executing: ${cmd}`);
  exec(cmd, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[NRS Sync Error]:`, stderr || error.message);
      return res.status(500).json({ error: "Sync failed", detail: stderr || error.message, output: stdout });
    }
    console.log(`[NRS Sync Output]:\n${stdout}`);
    
    // Read newly exported state
    let state = null;
    if (fs.existsSync(LIVE_DATA_PATH)) {
      try {
        state = JSON.parse(fs.readFileSync(LIVE_DATA_PATH, "utf-8"));
      } catch (e) {}
    }
    
    res.json({ success: true, message: "NRS sync completed", output: stdout, state });
  });
});

// 3. Apply Reconciled Invoice to live_inventory.json
app.post("/api/invoices/apply", (req, res) => {
  try {
    const { invoice, updatedProducts } = req.body;
    if (!updatedProducts || !Array.isArray(updatedProducts)) {
      return res.status(400).json({ error: "missing updatedProducts array" });
    }

    if (!fs.existsSync(LIVE_DATA_PATH)) {
      return res.status(404).json({ error: "live_inventory.json not found" });
    }

    const currentData = JSON.parse(fs.readFileSync(LIVE_DATA_PATH, "utf-8"));
    currentData.products = updatedProducts;

    // Persist invoice audit log
    const INVOICE_HISTORY_PATH = path.join(PROJECT_ROOT, "qilbo-app", "src", "data", "invoices_history.json");
    let history = [];
    if (fs.existsSync(INVOICE_HISTORY_PATH)) {
      try {
        history = JSON.parse(fs.readFileSync(INVOICE_HISTORY_PATH, "utf-8"));
      } catch (e) {}
    }
    if (invoice) {
      history.unshift({
        ...invoice,
        appliedAt: new Date().toISOString(),
      });
      fs.writeFileSync(INVOICE_HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");
    }

    fs.writeFileSync(LIVE_DATA_PATH, JSON.stringify(currentData, null, 2), "utf-8");
    console.log(`[Invoice Applied] Successfully updated ${updatedProducts.length} products in live_inventory.json`);
    res.json({ success: true, message: `Updated ${updatedProducts.length} products`, products: updatedProducts });
  } catch (err) {
    console.error("[Invoice Apply Error]:", err.message);
    res.status(500).json({ error: "Failed to apply invoice", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Qilbo image-search server listening on http://localhost:${PORT}`);
});
