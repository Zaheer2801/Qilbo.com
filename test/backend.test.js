import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import {
  parseCsv,
  dateFromFilename,
  extractSizeAndCleanName,
  classifyProduct,
  isTopShelfItem,
  ingestSalesCsv,
  stageInvoice,
  postInvoice
} from "../src/ingest.js";
import {
  salesSummary,
  inventory,
  ledger,
  distributorOrderSuggestions,
  setCount,
  adjust
} from "../src/db.js";

function createD1Emulator(db) {
  function prepare(sql) {
    return {
      _binds: [],
      bind(...args) {
        this._binds = args;
        return this;
      },
      first() {
        const stmt = db.prepare(sql);
        return stmt.get(...this._binds) || null;
      },
      all() {
        const stmt = db.prepare(sql);
        const rows = stmt.all(...this._binds);
        return { results: rows };
      },
      run() {
        const stmt = db.prepare(sql);
        const res = stmt.run(...this._binds);
        return {
          meta: { changes: res.changes, last_row_id: Number(res.lastInsertRowid) },
          results: []
        };
      }
    };
  }

  return {
    prepare,
    batch: async (stmts) => stmts.map(s => {
      try {
        return s.all();
      } catch (err) {
        return s.run();
      }
    })
  };
}

async function runTests() {
  console.log("============================================================");
  console.log("🧪 TESTING PHASE 3: CLOUDFLARE BACKEND & INGESTION ENGINE");
  console.log("============================================================\n");

  // Test 1: Parser & Classification Rules
  console.log("[Test 1] Classification & Size Extraction Rules:");
  const sample1 = extractSizeAndCleanName("Don Julio Reposado Tequila 750ml");
  console.log("  Don Julio 750ml -> Clean:", sample1.clean_name, "| Size:", sample1.size);
  if (sample1.size !== "750ml" || !sample1.clean_name.includes("Don Julio")) throw new Error("Size extraction failed");

  const sample2 = extractSizeAndCleanName("Natural Ice 6-pack");
  console.log("  Natural Ice 6-pack -> Clean:", sample2.clean_name, "| Size:", sample2.size);
  if (!sample2.size.includes("6-pack")) throw new Error("Pack size extraction failed");

  const c1 = classifyProduct("Hennessy VS Cognac 375ml", 22.0);
  console.log("  Hennessy -> Dept:", c1.department, "| SubCat:", c1.sub_category, "| Cat:", c1.category);
  if (c1.sub_category !== "Cognac & Brandy") throw new Error("Classification failed for Hennessy");

  const top1 = isTopShelfItem("Hennessy VS Cognac 375ml", c1.department, c1.sub_category, 22.0);
  console.log("  Hennessy is_top_shelf:", top1);
  if (!top1) throw new Error("Hennessy should be top shelf");

  const c2 = classifyProduct("Scratchers Wild 9s", 5.0);
  console.log("  Wild 9s -> Dept:", c2.department, "| Cat:", c2.category);
  if (c2.category !== "Lottery") throw new Error("Lottery classification failed");
  console.log("  -> ✅ Classification rules verified.\n");

  // Setup In-Memory D1 Database with merged data + v2 categories/brands + schema
  const rawDb = new DatabaseSync(":memory:");
  rawDb.exec(fs.readFileSync("migrate/merged.sql", "utf-8"));
  rawDb.exec(fs.readFileSync("migrate/v2_categories_brands.sql", "utf-8"));
  rawDb.exec(fs.readFileSync("schema.sql", "utf-8"));
  const db = createD1Emulator(rawDb);

  // Test 2: Sales Ingestion & Lottery Exclusion
  console.log("[Test 2] Sales CSV Ingestion & Reconciliation:");
  const csvContent = `UPC,Name,Qty,Amount
087692017820,"Twisted Tea Extreme 24oz Can",2,8.22
798028123456,"Florida Lottery Scratch-Off",1,10.00
,BEER,1,5.00
,"LOTTERY+ SCRATCH OFF",1,20.00`;

  const ingestRes = await ingestSalesCsv(db, csvContent, "2026-11-06", "Daily_Sales_Report_87287_2026-11-06.csv");
  console.log("  Ingested Date:", ingestRes.date);
  console.log("  Items:", ingestRes.items, "| Depts:", ingestRes.departments, "| Store Sales:", ingestRes.store_sales);

  // Store sales should be 8.22 (Twisted Tea) + 5.00 (Beer dept) = 13.22 (Lottery excluded!)
  if (ingestRes.store_sales !== 13.22) {
    throw new Error(`Expected store sales 13.22 but got ${ingestRes.store_sales}`);
  }
  console.log("  -> ✅ CSV ingest accurately calculated $13.22 store sales with lottery cleanly excluded.\n");

  // Test 3: API Summaries & Top Shelf Share
  console.log("[Test 3] Sales Summary & Top Shelf Share:");
  const sum = await salesSummary(db, "2026-11-05", "2026-11-05");
  console.log("  Store Sales 2026-11-05:", sum.store_sales);
  console.log("  Tracked Profit:", sum.tracked_profit, "| Tracked Margin:", (sum.tracked_margin * 100).toFixed(1) + "%");
  console.log("  Top Shelf Revenue:", sum.top_shelf.amount, "| Top Shelf Share:", (sum.top_shelf.share * 100).toFixed(1) + "%");
  if (sum.store_sales !== 1782.07) throw new Error("Acceptance criteria failed for 2026-11-05");
  console.log("  -> ✅ Acceptance verified ($1,782.07 store sales).\n");

  // Test 4: Distributor Order Suggestions
  console.log("[Test 4] Distributor Order Suggestions (2-week cover, 30d velocity):");
  const orders = await distributorOrderSuggestions(db);
  for (const d of orders) {
    console.log(`  ${d.distributor}: ${d.total_cases} cases ($${d.total_cost}) | Rule: ${d.minimum_rule || 'none'} | Meets: ${d.meets_minimum}`);
    if (d.fee_warning) console.log(`    ⚠️ ${d.fee_warning}`);
    if (d.rep_text) console.log(`    📱 Rep Text:\n${d.rep_text.split('\n').slice(0, 3).map(l => '      ' + l).join('\n')}\n      ...`);
  }
  const sg = orders.find(o => o.distributor === "Southern Glazer's");
  if (!sg) throw new Error("Southern Glazer's not found in distributor order suggestions");
  console.log("  -> ✅ Distributor order suggestions verified.\n");

  // Test 5: Invoice Staging & Approval (Never auto-save)
  console.log("[Test 5] Invoice Staging & Approval:");
  const mockInvoice = {
    distributor: "Southern Glazer's",
    invoice_no: "INV-99901",
    invoice_date: "2026-11-06",
    total: 359.94,
    lines: [
      {
        description: "Don Julio Repasado 750ml",
        item_code: "534869",
        cases: 1,
        units_per_case: 6,
        bottles: 6,
        unit_cost: 49.99,
        line_total: 299.94
      }
    ]
  };

  const staged = await stageInvoice(db, mockInvoice, { source: "test" });
  console.log("  Staged Invoice ID:", staged.id, "| Status: pending");
  const invRow = await db.prepare("SELECT status FROM invoices WHERE id=?").bind(staged.id).first();
  if (invRow.status !== "pending") throw new Error("Invoice should be staged as pending");
  console.log("  -> ✅ Staged invoice verified as pending (never auto-saved).\n");

  // Post invoice
  console.log("  Posting invoice ID:", staged.id);
  const postRes = await postInvoice(db, staged.id);
  const postRow = await db.prepare("SELECT status FROM invoices WHERE id=?").bind(staged.id).first();
  if (postRow.status !== "posted") throw new Error("Invoice should now be posted");
  console.log("  -> ✅ Invoice posted to ledger successfully.\n");

  console.log("============================================================");
  console.log("🎉 ALL PHASE 3 TESTS PASSED PERFECTLY!");
  console.log("============================================================");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
