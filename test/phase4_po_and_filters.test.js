import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import {
  inventory,
  stockFor,
  getDraftPOs,
  addToDraftPO,
  updateDraftPOLine,
  removeLineFromDraftPO,
  addAllReorderToDraftPO,
  clearDraftPO,
  markPOAsOrdered,
  getPOHistory,
  checkDistributorMinimum
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
        return { results: rows || [] };
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

async function run() {
  console.log("============================================================");
  console.log("🧪 TESTING CRITICAL BUG FIX & PURCHASE ORDERS (PO)");
  console.log("============================================================\n");

  const rawDb = new DatabaseSync(":memory:");
  rawDb.exec(fs.readFileSync("migrate/merged.sql", "utf-8"));
  rawDb.exec(fs.readFileSync("migrate/v2_categories_brands.sql", "utf-8"));
  rawDb.exec(fs.readFileSync("schema.sql", "utf-8"));
  rawDb.exec(fs.readFileSync("migrate/v3_categories.sql", "utf-8"));
  const db = createD1Emulator(rawDb);

  // 1. Critical Filter Bug Test
  console.log("[Test 1] Category & Distributor Filters:");
  const vodkaItems = await inventory(db, { category: "Vodka", onlyTracked: false });
  console.log(`  category=Vodka returned: ${vodkaItems.length} items`);
  if (vodkaItems.length !== 131 && vodkaItems.length !== 137) {
    throw new Error(`Expected category=Vodka to return 131 or 137 items, got ${vodkaItems.length}`);
  }
  console.log(`  -> ✅ category=Vodka returns ${vodkaItems.length} items!`);

  const breakthruItems = await inventory(db, { distributor: "Breakthru", onlyTracked: false });
  console.log(`  distributor=Breakthru returned: ${breakthruItems.length} items`);
  if (breakthruItems.length === 0) {
    throw new Error(`Expected distributor=Breakthru to return > 0 items, got ${breakthruItems.length}`);
  }
  console.log("  -> ✅ distributor=Breakthru returns > 0 items!");

  const tequilaItems = await inventory(db, { category: "Tequila/Mezcal", onlyTracked: false });
  console.log(`  category=Tequila/Mezcal returned: ${tequilaItems.length} items`);
  if (tequilaItems.length === 0) {
    throw new Error("Expected Tequila/Mezcal items > 0");
  }

  // 2. Enriched Inventory Fields Test
  console.log("\n[Test 2] Enriched Inventory Fields:");
  const dj = vodkaItems.find(it => it.id === 928) || (await inventory(db, { onlyTracked: false })).find(it => it.id === 928);
  console.log(`  Product: ${dj.clean_name || dj.name}`);
  console.log(`  On hand: ${dj.on_hand} | Arithmetic: ${dj.arithmetic}`);
  console.log(`  Cost: $${dj.cost} | Price: $${dj.price} | Margin: ${dj.margin_pct}% (+$${dj.profit_per_bottle}/btl)`);
  console.log(`  Suggested cases: ${dj.suggested_cases} cs | Distributor: ${dj.distributor}`);
  if (dj.on_hand !== 5) throw new Error(`Expected Don Julio 750 to have 5 on hand, got ${dj.on_hand}`);
  console.log("  -> ✅ Enriched inventory fields verified!");

  // 3. Purchase Orders Engine Tests
  console.log("\n[Test 3] Purchase Orders (Draft & Lifecycle):");

  // Initial drafts
  let drafts = await getDraftPOs(db);
  console.log(`  Draft POs initialized: ${drafts.length} distributors`);
  if (drafts.length < 5) throw new Error("Expected at least 5 standard distributors");

  // Add Don Julio 750 (ID 928) to Southern Glazer's draft PO
  console.log("  Adding 2 cases of Don Julio Reposado 750 to draft PO...");
  drafts = await addToDraftPO(db, { productId: 928, cases: 2, distributor: "Southern Glazer's" });
  let sg = drafts.find(d => d.distributor === "Southern Glazer's");
  console.log(`  Southern Glazer's draft: ${sg.total_cases} cases, $${sg.total_cost}`);
  console.log(`  Meets minimum: ${sg.meets_minimum} (${sg.minimum_text})`);
  if (sg.total_cases !== 2) throw new Error(`Expected 2 cases, got ${sg.total_cases}`);
  if (sg.items.length !== 1) throw new Error(`Expected 1 line item, got ${sg.items.length}`);
  const lineId = sg.items[0].id;

  // Update cases on the line: 2 -> 5 cases
  console.log("  Updating line to 5 cases...");
  drafts = await updateDraftPOLine(db, { lineId, cases: 5 });
  sg = drafts.find(d => d.distributor === "Southern Glazer's");
  console.log(`  Southern Glazer's draft after update: ${sg.total_cases} cases, $${sg.total_cost}`);
  if (sg.total_cases !== 5) throw new Error(`Expected 5 cases, got ${sg.total_cases}`);
  if (!sg.meets_minimum) throw new Error("5 cases should meet Southern Glazer's minimum");

  // Stock check BEFORE marking as ordered
  const stockBefore = await stockFor(db, 928);
  console.log(`  Stock on hand before marking ordered: ${stockBefore.on_hand}`);

  // Mark PO as ordered
  console.log("  Marking Southern Glazer's PO as ordered...");
  const orderRes = await markPOAsOrdered(db, { distributor: "Southern Glazer's" });
  console.log(`  PO #${orderRes.orderedPoId} marked ordered.`);

  // Check PO History
  const history = await getPOHistory(db);
  console.log(`  PO History count: ${history.length} (latest: PO #${history[0].id}, ${history[0].distributor}, ${history[0].total_cases} cs)`);
  if (history.length === 0 || history[0].total_cases !== 5) throw new Error("PO history check failed");

  // CRITICAL CHECK: Verify stock on hand did NOT change!
  const stockAfter = await stockFor(db, 928);
  console.log(`  Stock on hand after marking ordered: ${stockAfter.on_hand}`);
  if (stockAfter.on_hand !== stockBefore.on_hand) {
    throw new Error(`CRITICAL FAILURE: Stock on hand changed from ${stockBefore.on_hand} to ${stockAfter.on_hand} when marking PO ordered!`);
  }
  console.log("  -> ✅ Stock remains completely unchanged (strictly updates on invoice post).");

  // Draft for Southern Glazer's should now be empty / reset
  drafts = await getDraftPOs(db);
  sg = drafts.find(d => d.distributor === "Southern Glazer's");
  console.log(`  Southern Glazer's new draft: ${sg.total_cases} cases, ${sg.items.length} items`);
  if (sg.total_cases !== 0 || sg.items.length !== 0) throw new Error("Expected reset draft PO after ordering");

  // Minimum logic verification
  console.log("\n[Test 4] Distributor Minimum Rules:");
  const sgMin1 = checkDistributorMinimum("Southern Glazer's", 4, 150);
  console.log(`  SG 4cs / $150: meets=${sgMin1.meetsMin}`);
  if (sgMin1.meetsMin) throw new Error("SG 4cs / $150 should not meet minimum");

  const sgMin2 = checkDistributorMinimum("Southern Glazer's", 5, 150);
  console.log(`  SG 5cs / $150: meets=${sgMin2.meetsMin}`);
  if (!sgMin2.meetsMin) throw new Error("SG 5cs should meet minimum");

  const gcMin1 = checkDistributorMinimum("Gold Coast", 2, 250);
  console.log(`  Gold Coast $250: meets=${gcMin1.meetsMin}`);
  if (gcMin1.meetsMin) throw new Error("Gold Coast $250 should not meet $300 min");

  const gcMin2 = checkDistributorMinimum("Gold Coast", 2, 350);
  console.log(`  Gold Coast $350: meets=${gcMin2.meetsMin}`);
  if (!gcMin2.meetsMin) throw new Error("Gold Coast $350 should meet $300 min");

  console.log("  -> ✅ Distributor minimum rules verified!");

  console.log("\n============================================================");
  console.log("🎉 ALL PHASE 4 PO & FILTER TESTS PASSED PERFECTLY!");
  console.log("============================================================");
}

run().catch(e => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});
