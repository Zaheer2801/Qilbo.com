-- Getting a new store's data in. Each pilot store gets a private link (intake_token) that opens its upload page
-- and links its Telegram chat. Every file it sends (upload page, Telegram or email) is kept in R2 under
-- stores/<code>/... and logged here, so onboarding progress can be shown and the files processed for that store.
-- Discount Liquor (store 1) keeps its own pipeline and is not touched.
ALTER TABLE stores ADD COLUMN intake_token TEXT;
ALTER TABLE stores ADD COLUMN tg_chat_id TEXT;
ALTER TABLE stores ADD COLUMN tg_linked_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS stores_intake_token ON stores(intake_token);
CREATE UNIQUE INDEX IF NOT EXISTS stores_tg_chat ON stores(tg_chat_id);

CREATE TABLE IF NOT EXISTS store_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id    INTEGER NOT NULL REFERENCES stores(id),
  kind        TEXT NOT NULL DEFAULT 'other',   -- items | sales | invoice | deals | other
  file_key    TEXT NOT NULL,                   -- R2 key
  file_name   TEXT,
  mime        TEXT,
  size        INTEGER,
  source      TEXT,                            -- upload | telegram | email
  report_date TEXT,                            -- the day a sales report covers, when we can tell
  status      TEXT NOT NULL DEFAULT 'received',-- received | processed | failed
  note        TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS store_files_store ON store_files(store_id, kind);
