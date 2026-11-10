import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import { classifyProductFull, classifyNewProduct } from "../src/classify.js";
import worker from "../src/index.js";

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
  console.log("🧪 TESTING CATEGORY CLASSIFICATION & REVIEW ENDPOINTS");
  console.log("============================================================\n");

  // Test 1: Typo-tolerant matching of user-specified items
  console.log("[Test 1] User-specified typo items verification:");
  const testCases = [
    { input: "Jackdaniel blk", expectedGroup: "Spirits", expectedSub: "Whiskey", expectedBrand: "Jack Daniel's" },
    { input: "Jimbean peach", expectedGroup: "Spirits", expectedSub: "Whiskey", expectedBrand: "Jim Beam" },
    { input: "Hennesy VS", expectedGroup: "Spirits", expectedSub: "Cognac/Brandy", expectedBrand: "Hennessy" },
    { input: "Paum massion", expectedGroup: "Spirits", expectedSub: "Cognac/Brandy", expectedBrand: "Paul Masson" },
    { input: "Micgelab ultra", expectedGroup: "Beer & RTD", expectedSub: "Beer", expectedBrand: "Michelob" },
    { input: "Sunkist", expectedGroup: "Drinks & Mixers", expectedSub: "Drinks & Mixers", expectedBrand: "Sunkist" },
    { input: "RC Cola", expectedGroup: "Drinks & Mixers", expectedSub: "Drinks & Mixers", expectedBrand: "RC Cola" },
    { input: "Starbucks Frappuccino", expectedGroup: "Drinks & Mixers", expectedSub: "Drinks & Mixers", expectedBrand: "Starbucks" },
    { input: "Bluebird juice", expectedGroup: "Drinks & Mixers", expectedSub: "Drinks & Mixers", expectedBrand: "Bluebird" },
    { input: "Premier Protein", expectedGroup: "Drinks & Mixers", expectedSub: "Drinks & Mixers", expectedBrand: "Premier Protein" },
    { input: "Club tail blue", expectedGroup: "Beer & RTD", expectedSub: "RTD/Seltzer", expectedBrand: "Clubtails" },
    { input: "Buzz ball", expectedGroup: "Beer & RTD", expectedSub: "RTD/Seltzer", expectedBrand: "BuzzBallz" },
    { input: "Big Sipz", expectedGroup: "Beer & RTD", expectedSub: "RTD/Seltzer", expectedBrand: "Big Sipz" },
    { input: "MD 20/20", expectedGroup: "Wine", expectedSub: "Wine", expectedBrand: "MD 20/20" },
    { input: "Pink Whitney 750ml", expectedGroup: "Spirits", expectedSub: "Vodka", expectedBrand: "Pink Whitney" },
    { input: "Benjamin banana", expectedGroup: "Spirits", expectedSub: "Liqueur", expectedBrand: "Benjamin Banana" },
    { input: "99shot", expectedGroup: "Spirits", expectedSub: "Liqueur", expectedBrand: "99 Brand" },
    { input: "Canadian Mist", expectedGroup: "Spirits", expectedSub: "Whiskey", expectedBrand: "Canadian Mist" },
    { input: "Proper 12", expectedGroup: "Spirits", expectedSub: "Whiskey", expectedBrand: "Proper Twelve" },
    { input: "Coronita", expectedGroup: "Beer & RTD", expectedSub: "Beer", expectedBrand: "Corona" },
    { input: "Calypso spiced", expectedGroup: "Spirits", expectedSub: "Rum", expectedBrand: "Calypso" },
  ];

  for (const tc of testCases) {
    const res = classifyProductFull({ name: tc.input });
    if (!res) throw new Error(`Failed to classify: ${tc.input}`);
    if (res.group !== tc.expectedGroup || res.sub_category !== tc.expectedSub) {
      throw new Error(`Mismatch for ${tc.input}: got ${res.group} > ${res.sub_category}, expected ${tc.expectedGroup} > ${tc.expectedSub}`);
    }
    console.log(`  ✓ "${tc.input}" -> [${res.group} > ${res.sub_category}] (${res.brand}) conf=${res.confidence}`);
  }
  console.log("  -> ✅ All 21 user-specified items classified accurately!\n");

  // Test 2: Ingestion Classification Helper
  console.log("[Test 2] Testing classifyNewProduct for auto-ingestion:");
  const auto1 = classifyNewProduct({ name: "Jackdaniel black 375ml", unitPrice: 15.0 });
  if (auto1.category !== "Spirits" || auto1.sub_category !== "Whiskey") throw new Error("Auto-classify failed");
  const auto2 = classifyNewProduct({ name: "Doritos Nacho 9.25oz", department: "General Merchandise", unitPrice: 4.5 });
  if (auto2.category !== "Snacks & Grocery") throw new Error("Snacks auto-classify failed");
  console.log("  -> ✅ classifyNewProduct verified for new items.\n");

  // Test 3: Backend API Endpoints (GET /api/categories/suggestions & POST /api/categories/apply)
  console.log("[Test 3] Testing Worker endpoints:");
  const rawDb = new DatabaseSync(":memory:");
  rawDb.exec(fs.readFileSync("schema.sql", "utf-8"));
  rawDb.exec(fs.readFileSync("migrate/merged.sql", "utf-8"));
  rawDb.exec(fs.readFileSync("migrate/v4_categories.sql", "utf-8"));
  const db = createD1Emulator(rawDb);

  const env = { DB: db, TEST_MODE: true };

  // Call GET /api/categories/suggestions
  const req1 = new Request("https://discount-liquor.test/api/categories/suggestions?status=approved");
  const res1 = await worker.fetch(req1, env, {});
  const data1 = await res1.json();
  console.log(`  GET /api/categories/suggestions returned ${data1.suggestions.length} suggestions`);
  if (!data1.suggestions || data1.suggestions.length !== 330) {
    throw new Error(`Expected 330 suggestions, got ${data1.suggestions?.length}`);
  }

  // Call POST /api/categories/apply with a custom override
  const req2 = new Request("https://discount-liquor.test/api/categories/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      items: [
        { product_id: 26, category: "Snacks & Grocery", sub_category: "Snacks & Grocery", brand: "Deconna" }
      ]
    })
  });
  const res2 = await worker.fetch(req2, env, {});
  const data2 = await res2.json();
  if (!data2.ok || data2.count !== 1) throw new Error("POST /api/categories/apply failed");
  console.log("  POST /api/categories/apply succeeded with count 1");

  // Verify product 26 in database
  const p26 = db.prepare("SELECT category, sub_category, brand FROM products WHERE id=26").first();
  if (p26.category !== "Snacks & Grocery" || p26.brand !== "Deconna") {
    throw new Error(`Product 26 update failed: ${JSON.stringify(p26)}`);
  }
  console.log("  ✓ Product 26 confirmed updated in database:", p26);

  console.log("\n============================================================");
  console.log("🎉 ALL CATEGORY REVIEW TESTS PASSED PERFECTLY!");
  console.log("============================================================\n");
}

run().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
