-- Qilbo brain: findings that the nightly checks raise, and how each one is resolved.
-- One row per problem. A problem that is still true the next night keeps its row (same key)
-- and only gets refreshed. When the problem is gone, an approved finding becomes 'verified'
-- and an untouched one becomes 'cleared'.

CREATE TABLE IF NOT EXISTS stores (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  store_type TEXT DEFAULT 'liquor',          -- liquor | convenience | smoke
  timezone   TEXT DEFAULT 'America/New_York',
  created_at TEXT DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO stores(id, name, store_type) VALUES (1, 'Discount Liquor', 'liquor');

CREATE TABLE IF NOT EXISTS findings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id      INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id),
  key           TEXT NOT NULL,               -- engine:type:subject, so the same problem is not raised twice
  engine        TEXT NOT NULL,               -- price | invoice | stock | loss | customer | ops | compliance
  type          TEXT NOT NULL,               -- e.g. zero_price_sale, below_cost, low_margin
  severity      INTEGER NOT NULL DEFAULT 2,  -- 1 = act today, 2 = this week, 3 = good to know
  product_id    INTEGER REFERENCES products(id),
  title         TEXT NOT NULL,
  detail        TEXT,
  action        TEXT,                        -- what Qilbo suggests the owner does
  value         REAL DEFAULT 0,              -- estimated dollars at stake per month
  data          TEXT,                        -- JSON with the numbers behind the finding
  status        TEXT NOT NULL DEFAULT 'open',-- open | approved | skipped | verified | cleared
  first_seen    TEXT DEFAULT (datetime('now')),
  last_seen     TEXT DEFAULT (datetime('now')),
  decided_at    TEXT,
  resolved_at   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS findings_store_key ON findings(store_id, key);
CREATE INDEX IF NOT EXISTS findings_status ON findings(store_id, status, severity);

-- Customer requests (asked for an item we don't carry) and the brain's run log
CREATE TABLE IF NOT EXISTS customer_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id    INTEGER NOT NULL DEFAULT 1,
  item        TEXT NOT NULL,
  size        TEXT,
  customer    TEXT,
  phone       TEXT,
  distributor TEXT,
  status      TEXT DEFAULT 'open',            -- open | ordered | told_customer | closed
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brain_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id    INTEGER NOT NULL DEFAULT 1,
  started_at  TEXT DEFAULT (datetime('now')),
  raised      INTEGER DEFAULT 0,
  refreshed   INTEGER DEFAULT 0,
  closed      INTEGER DEFAULT 0,
  errors      TEXT
);
