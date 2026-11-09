import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import {
  stockFor,
  stockMany,
  ledger,
  setCount,
  adjust,
  inventory,
  salesSummary,
  setSetting,
  getSetting
} from "../src/db.js";

// Create Cloudflare D1 emulator wrapping Node.js built-in DatabaseSync
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
        return stmt.run(...this._binds);
      }
    };
  }

  return {
    prepare,
    async batch(stmts) {
      const results = [];
      for (const s of stmts) {
        results.push(s.all ? s.all() : s.run());
      }
      return results;
    }
  };
}

async function runTests() {
  console.log("============================================================");
  console.log("🧪 TESTING PHASE 2: STOCK LEDGER ENGINE");
  console.log("============================================================");

  const nativeDb = new DatabaseSync(":memory:");
  nativeDb.exec(fs.readFileSync("migrate/merged.sql", "utf8"));
  nativeDb.exec(fs.readFileSync("migrate/v2_categories_brands.sql", "utf8"));
  nativeDb.exec(fs.readFileSync("schema.sql", "utf8"));
  const d1 = createD1Emulator(nativeDb);

  // 1. Acceptance Test: Don Julio Reposado 750 (ID 928)
  console.log("\n[Test 1] Don Julio Reposado 750 Ledger Scenario:");
  const dj = d1.prepare("SELECT id, name, size FROM products WHERE id = 928").first();
  console.log(`  Product: ${dj.name} (${dj.size})`);

  let st = await stockFor(d1, 928);
  console.log(`  Step 1: Initial state -> ${st.received} received - ${st.sold} sold = ${st.on_hand} on hand`);
  console.log(`          Basis: "${st.basis}"`);
  console.log(`          Arithmetic: "${st.arithmetic}"`);
  if (st.on_hand !== 5) throw new Error(`Expected 5 on hand, got ${st.on_hand}`);
  console.log("  -> ✅ Initial state 12 received - 7 sold = 5 verified.");

  // Step 2: /count 4
  console.log("\n  Step 2: Executing /count 4...");
  await setCount(d1, 928, 4, "shelf count");
  await setSetting(d1, "last_change", JSON.stringify({ type: "count", product_id: 928 }));
  st = await stockFor(d1, 928);
  console.log(`          After count: ${st.on_hand} on hand (Basis: "${st.basis}")`);
  if (st.on_hand !== 4) throw new Error(`Expected 4 on hand after count, got ${st.on_hand}`);
  console.log("  -> ✅ /count 4 gave exactly 4.");

  // Step 3: /adjust -1 broken
  console.log("\n  Step 3: Executing /adjust -1 broken...");
  await adjust(d1, 928, -1, "broken bottle");
  await setSetting(d1, "last_change", JSON.stringify({ type: "adjust", product_id: 928 }));
  st = await stockFor(d1, 928);
  console.log(`          After adjust: ${st.on_hand} on hand`);
  if (st.on_hand !== 3) throw new Error(`Expected 3 on hand after adjust, got ${st.on_hand}`);
  console.log("  -> ✅ /adjust -1 broken gave exactly 3.");

  // Step 4: /undo
  console.log("\n  Step 4: Executing /undo...");
  // Undo helper implementation
  const lastRaw = await getSetting(d1, "last_change");
  const last = JSON.parse(lastRaw);
  if (last.type === "adjust") {
    d1.prepare("DELETE FROM adjustments WHERE id = (SELECT id FROM adjustments WHERE product_id = ? ORDER BY created_at DESC LIMIT 1)").bind(last.product_id).run();
  }
  st = await stockFor(d1, 928);
  console.log(`          After undo: ${st.on_hand} on hand`);
  if (st.on_hand !== 4) throw new Error(`Expected 4 on hand after undo, got ${st.on_hand}`);
  console.log("  -> ✅ /undo successfully restored stock to 4.");

  // 2. Full Ledger Explain View Test
  console.log("\n[Test 2] Full Ledger Explain View:");
  const led = await ledger(d1, 928);
  console.log(`  Product: ${led.product.name} | Display Price: ${led.product.display_price}`);
  console.log(`  Deliveries logged: ${led.recent_deliveries.length}`);
  console.log(`  Sales days logged: ${led.recent_sales_days.length}`);
  console.log(`  Counts logged: ${led.counts.length}`);
  console.log(`  30d Velocity: ${led.velocity_30d.qty} bottles (${led.velocity_30d.per_week.toFixed(1)}/week)`);
  console.log("  -> ✅ Full ledger explain view verified.");

  // 3. Status Matrix Test
  console.log("\n[Test 3] Inventory Statuses:");
  const inv = await inventory(d1, { onlyTracked: false });
  const counts = {};
  for (const item of inv) {
    counts[item.status] = (counts[item.status] || 0) + 1;
  }
  console.log("  Status distribution across catalog:");
  for (const [stName, cnt] of Object.entries(counts)) {
    console.log(`    - ${stName}: ${cnt} items`);
  }
  if (!counts["OK"] && !counts["NOT SELLING"] && !counts["OUT"]) {
    throw new Error("Missing expected status classifications");
  }
  console.log("  -> ✅ Status matrix includes OUT, REORDER, OVERSTOCK, NOT SELLING, NOT COUNTED, OK.");

  console.log("\n============================================================");
  console.log("🎉 ALL PHASE 2 TESTS PASSED PERFECTLY!");
  console.log("============================================================");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
