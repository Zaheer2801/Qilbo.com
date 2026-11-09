CREATE TABLE IF NOT EXISTS purchase_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft',
  total_cases  INTEGER DEFAULT 0,
  total_cost   REAL DEFAULT 0.0,
  ordered_at   TEXT,
  notes        TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id          INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(id),
  cases          INTEGER NOT NULL DEFAULT 1,
  bottles        INTEGER NOT NULL DEFAULT 0,
  case_cost      REAL NOT NULL DEFAULT 0.0,
  line_total     REAL NOT NULL DEFAULT 0.0,
  created_at     TEXT DEFAULT (datetime('now')),
  UNIQUE(po_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_po_distributor ON purchase_orders(distributor, status);
CREATE INDEX IF NOT EXISTS idx_po_lines_po ON purchase_order_lines(po_id);
