-- Discount Liquor – Store Database Schema (Cloudflare D1 / SQLite)
-- 2105 E Orange Ave, Eustis FL 32726

CREATE TABLE IF NOT EXISTS products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  clean_name     TEXT,
  size           TEXT,
  category       TEXT,
  department     TEXT,
  sub_category   TEXT,
  distributor    TEXT,
  case_size      INTEGER,
  units_per_case INTEGER,
  units_per_pack INTEGER,
  cost           REAL,
  price          REAL,
  price_source   TEXT DEFAULT 'estimated',
  price_warning  TEXT,
  reorder_point  INTEGER,
  image_key      TEXT,
  active         INTEGER DEFAULT 1,
  is_top_shelf   INTEGER DEFAULT 0,
  do_not_reorder INTEGER DEFAULT 0,
  created_at     TEXT DEFAULT (datetime('now')),
  updated_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_upcs (
  upc        TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS product_codes (
  distributor TEXT NOT NULL,
  code        TEXT NOT NULL,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  PRIMARY KEY (distributor, code)
);

CREATE TABLE IF NOT EXISTS invoices (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor  TEXT,
  invoice_no   TEXT,
  invoice_date TEXT,
  total        REAL,
  status       TEXT DEFAULT 'posted',
  file_key     TEXT,
  source       TEXT,
  raw_json     TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE (distributor, invoice_no)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id),
  description TEXT,
  item_code   TEXT,
  upc         TEXT,
  cases       REAL,
  bottles     REAL,
  unit_cost   REAL,
  line_total  REAL
);

CREATE TABLE IF NOT EXISTS sales (
  sale_date  TEXT NOT NULL,
  upc        TEXT NOT NULL,
  name       TEXT,
  qty        REAL,
  amount     REAL,
  product_id INTEGER REFERENCES products(id),
  PRIMARY KEY (sale_date, upc)
);

CREATE TABLE IF NOT EXISTS dept_sales (
  sale_date  TEXT NOT NULL,
  department TEXT NOT NULL,
  qty        REAL,
  amount     REAL,
  PRIMARY KEY (sale_date, department)
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        REAL NOT NULL,
  counted_at TEXT NOT NULL DEFAULT (datetime('now')),
  note       TEXT
);

CREATE TABLE IF NOT EXISTS adjustments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  delta      REAL NOT NULL,
  reason     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processed_files (
  name         TEXT PRIMARY KEY,
  processed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  role       TEXT,
  text       TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_lines_product ON invoice_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_counts_product ON stock_counts(product_id, counted_at);
CREATE INDEX IF NOT EXISTS idx_adj_product ON adjustments(product_id, created_at);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_clean ON products(clean_name);
