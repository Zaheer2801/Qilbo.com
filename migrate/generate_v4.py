import json
import sqlite3

with open('migrate/category_review_suggestions.json') as f:
    data = json.load(f)

suggestions = data['suggestions']
print(f"Loaded {len(suggestions)} suggestions")

lines = [
    "-- Category reclassifications for Discount Liquor (v4)",
    "-- Reduces 'Other Spirits – review' from 330 down to under 30 items",
    "",
    "CREATE TABLE IF NOT EXISTS category_review_suggestions (",
    "  product_id INTEGER PRIMARY KEY REFERENCES products(id),",
    "  name TEXT NOT NULL,",
    "  clean_name TEXT,",
    "  size TEXT,",
    "  department TEXT,",
    "  current_category TEXT,",
    "  current_sub_category TEXT,",
    "  suggested_category TEXT NOT NULL,",
    "  suggested_sub_category TEXT NOT NULL,",
    "  suggested_brand TEXT,",
    "  confidence REAL NOT NULL,",
    "  reason TEXT,",
    "  source TEXT DEFAULT 'brand_match',",
    "  status TEXT DEFAULT 'approved',",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",
    ""
]

def esc(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

for s in suggestions:
    pid = s['product_id']
    name = esc(s['name'])
    clean = esc(s.get('clean_name'))
    size = esc(s.get('size'))
    dept = esc(s.get('department'))
    cur_cat = esc(s.get('current_category', 'Spirits'))
    cur_sub = esc(s.get('current_sub_category', 'Other Spirits – review'))
    sug_cat = esc(s['suggested_category'])
    sug_sub = esc(s['suggested_sub_category'])
    sug_brand = esc(s.get('suggested_brand', 'Generic'))
    conf = float(s.get('confidence', 0.90))
    reason = esc(s.get('reason', ''))
    source = esc(s.get('source', 'brand_match'))

    # Insert suggestion
    lines.append(
        f"INSERT OR REPLACE INTO category_review_suggestions(product_id, name, clean_name, size, department, current_category, current_sub_category, suggested_category, suggested_sub_category, suggested_brand, confidence, reason, source, status) "
        f"VALUES({pid}, {name}, {clean}, {size}, {dept}, {cur_cat}, {cur_sub}, {sug_cat}, {sug_sub}, {sug_brand}, {conf}, {reason}, {source}, 'approved');"
    )

    # Update product
    lines.append(
        f"UPDATE products SET category = {sug_cat}, sub_category = {sug_sub}, brand = {sug_brand}, updated_at = datetime('now') WHERE id = {pid};"
    )

with open('migrate/v4_categories.sql', 'w') as f:
    f.write("\n".join(lines) + "\n")

print(f"Wrote {len(lines)} lines to migrate/v4_categories.sql")
