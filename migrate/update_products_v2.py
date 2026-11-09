import sqlite3
import re
from collections import Counter
from migrate.classify import classify_product_cat, extract_brand

def generate_updates():
    con = sqlite3.connect(':memory:')
    with open('schema.sql') as f: con.executescript(f.read())
    with open('migrate/merged.sql') as f: con.executescript(f.read())

    rows = con.execute('SELECT id, name, clean_name, category, sub_category, cost, price, distributor FROM products').fetchall()
    
    cat_counts = Counter()
    brand_counts = Counter()
    sql_statements = []

    for r in rows:
        pid, name, clean, old_cat, old_sub, cost, price, dist = r
        new_cat = classify_product_cat(name, old_cat, old_sub)
        brand = extract_brand(name, new_cat)
        
        cat_counts[new_cat] += 1
        brand_counts[brand] += 1
        
        # Escape single quotes for SQL
        b_escaped = brand.replace("'", "''")
        c_escaped = new_cat.replace("'", "''")
        sql_statements.append(f"UPDATE products SET category='{c_escaped}', brand='{b_escaped}' WHERE id={pid};")

    print(f"Total products processed: {len(rows)}")
    print("\n================== CATEGORY BREAKDOWN ==================")
    for c, cnt in cat_counts.most_common():
        pct = (cnt / len(rows)) * 100
        print(f"  {c:<25} : {cnt:>4} items ({pct:>4.1f}%)")

    print("\n================== TOP 20 BRANDS ==================")
    for b, cnt in brand_counts.most_common(20):
        print(f"  {b:<25} : {cnt:>4} items")

    print("\n================== 20 EXAMPLES ==================")
    sample_ids = [9, 22, 151, 681, 928, 1294, 1344, 1, 50, 100, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800]
    for pid in sample_ids:
        row = con.execute("SELECT name, size FROM products WHERE id=?", (pid,)).fetchone()
        if row:
            name, size = row
            c = classify_product_cat(name, '', '')
            b = extract_brand(name, c)
            print(f"  ID {pid:>4}: [{c:<22}] Brand: {b:<18} | {name} ({size})")

    with open('migrate/v2_categories_brands.sql', 'w') as out_f:
        out_f.write("-- Migration: Add brand column and update categories and brands\n")
        out_f.write("ALTER TABLE products ADD COLUMN brand TEXT;\n\n")
        out_f.write("\n".join(sql_statements) + "\n")
        
    print("\nWrote migrate/v2_categories_brands.sql successfully.")

if __name__ == '__main__':
    generate_updates()
