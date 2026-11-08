"""
Database Layer for NRS Ingestion & Qilbo Integration
Supports SQLite (local / synced) and PostgreSQL (Supabase / Cloud DB).
"""

import os
import sqlite3
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import asdict

from nrs_pipeline.parser import ParsedNRSReport, NRSSaleItem


DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "qilbo_inventory.db")


def get_connection(db_path: str = DEFAULT_DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = DEFAULT_DB_PATH):
    """Initializes tables for products, daily sales, reports, and summaries."""
    conn = get_connection(db_path)
    cur = conn.cursor()

    # Products / Master Inventory
    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
        upc TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        clean_name TEXT,
        department TEXT,
        category TEXT,
        sub_category TEXT,
        size TEXT,
        qty_on_hand INTEGER DEFAULT 50,
        reorder_point INTEGER DEFAULT 15,
        purchase_price REAL DEFAULT 0.0,
        selling_price REAL DEFAULT 0.0,
        is_top_shelf INTEGER DEFAULT 0,
        last_sold_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Safe migration for existing DB
    try:
        cur.execute("ALTER TABLE products ADD COLUMN department TEXT;")
    except Exception:
        pass
    try:
        cur.execute("ALTER TABLE products ADD COLUMN sub_category TEXT;")
    except Exception:
        pass

    # Daily Sales Line Items
    cur.execute("""
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL,
        upc TEXT NOT NULL,
        product_name TEXT NOT NULL,
        department TEXT,
        category TEXT,
        sub_category TEXT,
        size TEXT,
        qty_sold INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        is_top_shelf INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (upc) REFERENCES products(upc)
    );
    """)

    try:
        cur.execute("ALTER TABLE sales ADD COLUMN department TEXT;")
    except Exception:
        pass
    try:
        cur.execute("ALTER TABLE sales ADD COLUMN sub_category TEXT;")
    except Exception:
        pass
    try:
        cur.execute("ALTER TABLE sales ADD COLUMN store_id TEXT DEFAULT '87287';")
    except Exception:
        pass
    try:
        cur.execute("ALTER TABLE sales ADD COLUMN store_name TEXT DEFAULT 'Discount Liquor';")
    except Exception:
        pass

    # Daily Report Ingestion Log
    cur.execute("""
    CREATE TABLE IF NOT EXISTS daily_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL,
        store_id TEXT DEFAULT '87287',
        store_name TEXT DEFAULT 'Discount Liquor',
        raw_filename TEXT,
        gdrive_file_id TEXT,
        total_items_sold INTEGER,
        total_revenue REAL,
        top_shelf_units INTEGER,
        top_shelf_revenue REAL,
        ingested_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(report_date, store_id)
    );
    """)

    try:
        cur.execute("ALTER TABLE daily_reports ADD COLUMN store_id TEXT DEFAULT '87287';")
    except Exception:
        pass
    try:
        cur.execute("ALTER TABLE daily_reports ADD COLUMN store_name TEXT DEFAULT 'Discount Liquor';")
    except Exception:
        pass

    # Department Summaries
    cur.execute("""
    CREATE TABLE IF NOT EXISTS department_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT NOT NULL,
        department TEXT NOT NULL,
        qty_sold INTEGER,
        total_amount REAL
    );
    """)

    conn.commit()
    conn.close()


def ingest_parsed_report(
    report: ParsedNRSReport,
    raw_filename: str = "",
    gdrive_file_id: str = "",
    store_id: str = "87287",
    store_name: str = "Discount Liquor",
    db_path: str = DEFAULT_DB_PATH
):
    """
    Ingests a ParsedNRSReport into the database:
    - Inserts daily report log
    - Upserts products
    - Deducts sold quantity from qty_on_hand
    - Inserts daily sales records with store_id and store_name
    - Records department summaries
    """
    conn = get_connection(db_path)
    cur = conn.cursor()

    report_date = report.report_date or datetime.now().strftime("%Y-%m-%d")

    # 1. Daily Report Entry
    cur.execute("DELETE FROM daily_reports WHERE report_date = ? AND store_id = ?", (report_date, store_id))
    cur.execute("""
    INSERT INTO daily_reports (report_date, store_id, store_name, raw_filename, gdrive_file_id, total_items_sold, total_revenue, top_shelf_units, top_shelf_revenue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        report_date,
        store_id,
        store_name,
        raw_filename,
        gdrive_file_id,
        report.total_items_sold,
        report.total_revenue,
        report.top_shelf_units,
        report.top_shelf_revenue
    ))

    # Delete any previous sales for this date and store (idempotent re-run)
    cur.execute("DELETE FROM sales WHERE report_date = ? AND store_id = ?", (report_date, store_id))
    cur.execute("DELETE FROM department_summaries WHERE report_date = ?", (report_date,))

    # 2. Products and Sales
    for item in report.items:
        # Check if product exists
        cur.execute("SELECT qty_on_hand, reorder_point FROM products WHERE upc = ?", (item.upc,))
        existing = cur.fetchone()

        if existing:
            new_qty = max(0, existing["qty_on_hand"] - item.qty_sold)
            cur.execute("""
            UPDATE products 
            SET name = ?, clean_name = ?, department = ?, category = ?, sub_category = ?, size = ?, selling_price = ?,
                is_top_shelf = ?, last_sold_date = ?, qty_on_hand = ?, updated_at = CURRENT_TIMESTAMP
            WHERE upc = ?;
            """, (
                item.raw_name, item.clean_name, item.department, item.sub_category, item.sub_category, item.size,
                item.unit_price, 1 if item.is_top_shelf else 0, report_date, new_qty, item.upc
            ))
        else:
            # Default initial stock estimate for newly discovered items
            initial_stock = max(10, item.qty_sold * 7)
            reorder_pt = max(5, item.qty_sold * 2)
            cur.execute("""
            INSERT INTO products (upc, name, clean_name, department, category, sub_category, size, qty_on_hand, reorder_point, selling_price, is_top_shelf, last_sold_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (
                item.upc, item.raw_name, item.clean_name, item.department, item.sub_category, item.sub_category, item.size,
                initial_stock, reorder_pt, item.unit_price, 1 if item.is_top_shelf else 0, report_date
            ))

        # Insert sale record
        cur.execute("""
        INSERT INTO sales (report_date, store_id, store_name, upc, product_name, department, category, sub_category, size, qty_sold, unit_price, total_amount, is_top_shelf)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            report_date, store_id, store_name, item.upc, item.clean_name, item.department, item.sub_category, item.sub_category, item.size,
            item.qty_sold, item.unit_price, item.total_amount, 1 if item.is_top_shelf else 0
        ))

    # 3. Department Summaries
    for s in report.department_summaries:
        cur.execute("""
        INSERT INTO department_summaries (report_date, department, qty_sold, total_amount)
        VALUES (?, ?, ?, ?);
        """, (report_date, s.department, s.qty_sold, s.total_amount))

    conn.commit()
    conn.close()


def get_top_shelf_report(date: Optional[str] = None, db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    """Returns top shelf sales performance and current stock."""
    conn = get_connection(db_path)
    cur = conn.cursor()

    query = """
    SELECT 
        s.report_date,
        s.upc,
        s.product_name,
        s.category,
        s.size,
        s.qty_sold,
        s.unit_price,
        s.total_amount,
        p.qty_on_hand,
        p.reorder_point,
        ROUND(CAST(p.qty_on_hand AS REAL) / NULLIF(s.qty_sold, 0), 1) as days_of_inventory
    FROM sales s
    JOIN products p ON s.upc = p.upc
    WHERE s.is_top_shelf = 1
    """
    params = []
    if date:
        query += " AND s.report_date = ?"
        params.append(date)

    query += " ORDER BY s.total_amount DESC;"

    cur.execute(query, params)
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows


def get_reorder_recommendations(db_path: str = DEFAULT_DB_PATH) -> List[Dict[str, Any]]:
    """Identifies items where stock is below or near reorder point."""
    conn = get_connection(db_path)
    cur = conn.cursor()

    cur.execute("""
    SELECT 
        upc,
        clean_name as product_name,
        category,
        size,
        qty_on_hand,
        reorder_point,
        selling_price,
        is_top_shelf,
        (reorder_point * 2 - qty_on_hand) as suggested_reorder_qty
    FROM products
    WHERE qty_on_hand <= reorder_point
    ORDER BY is_top_shelf DESC, (reorder_point - qty_on_hand) DESC;
    """)
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows


def export_qilbo_app_state(store_id: Optional[str] = None, db_path: str = DEFAULT_DB_PATH) -> Dict[str, Any]:
    """
    Generates a full AppState compatible with Qilbo's React App (types.ts).
    Supports multi-store filtering.
    """
    conn = get_connection(db_path)
    cur = conn.cursor()

    # Get distinct stores tracked
    cur.execute("SELECT DISTINCT store_id, store_name FROM daily_reports ORDER BY store_id;")
    store_rows = cur.fetchall()
    stores = [{"storeId": r["store_id"] or "87287", "storeName": r["store_name"] or "Discount Liquor"} for r in store_rows]
    if not stores:
        stores = [
            {"storeId": "87287", "storeName": "Discount Liquor (87287)"},
            {"storeId": "83954", "storeName": "Discount Liquor (83954)"}
        ]

    cur.execute("SELECT * FROM products ORDER BY is_top_shelf DESC, name ASC;")
    products_rows = cur.fetchall()

    if store_id:
        cur.execute("SELECT * FROM sales WHERE store_id = ? ORDER BY report_date DESC, total_amount DESC;", (store_id,))
    else:
        cur.execute("SELECT * FROM sales ORDER BY report_date DESC, total_amount DESC;")
    sales_rows = cur.fetchall()

    conn.close()

    products = []
    for r in products_rows:
        dept = r["department"] if "department" in r.keys() and r["department"] else "Liquor"
        sub_cat = r["sub_category"] if "sub_category" in r.keys() and r["sub_category"] else (r["category"] or "Spirits")
        products.append({
            "id": r["upc"],
            "name": r["clean_name"] or r["name"],
            "department": dept,
            "category": sub_cat,
            "subCategory": sub_cat,
            "size": r["size"] or "750ml",
            "qty": r["qty_on_hand"],
            "reorderPoint": r["reorder_point"],
            "purchasePrice": r["purchase_price"] or round(r["selling_price"] * 0.65, 2),
            "sellingPrice": r["selling_price"],
            "expiryDate": "",
            "vendor": "Primary Distributor" if r["is_top_shelf"] else "Standard Wholesaler",
            "isTopShelf": bool(r["is_top_shelf"])
        })

    sales = []
    for s in sales_rows:
        sales.append({
            "id": f"SALE-{s['id']}",
            "productId": s["upc"],
            "productName": s["product_name"] if "product_name" in s.keys() else "",
            "storeId": s["store_id"] if "store_id" in s.keys() and s["store_id"] else "87287",
            "storeName": s["store_name"] if "store_name" in s.keys() and s["store_name"] else "Discount Liquor",
            "department": s["department"] if "department" in s.keys() and s["department"] else "Liquor",
            "subCategory": s["sub_category"] if "sub_category" in s.keys() and s["sub_category"] else (s["category"] or "Spirits"),
            "size": s["size"] if "size" in s.keys() else "",
            "qty": s["qty_sold"],
            "unitPrice": s["unit_price"] if "unit_price" in s.keys() else round(s["total_amount"] / max(1, s["qty_sold"]), 2),
            "date": s["report_date"],
            "amount": s["total_amount"],
            "isTopShelf": bool(s["is_top_shelf"]) if "is_top_shelf" in s.keys() else False
        })

    return {
        "products": products,
        "sales": sales,
        "stores": stores
    }
