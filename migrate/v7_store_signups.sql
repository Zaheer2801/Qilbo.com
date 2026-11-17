-- New stores signing up through /join. Each signup becomes a row in stores with status 'pending'
-- until the owner of Qilbo approves it as a pilot. Discount Liquor (id 1) stays as it is, status 'active'.
ALTER TABLE stores ADD COLUMN code TEXT;
ALTER TABLE stores ADD COLUMN status TEXT DEFAULT 'pending';      -- pending | pilot | active | declined
ALTER TABLE stores ADD COLUMN owner_name TEXT;
ALTER TABLE stores ADD COLUMN phone TEXT;
ALTER TABLE stores ADD COLUMN email TEXT;
ALTER TABLE stores ADD COLUMN address TEXT;
ALTER TABLE stores ADD COLUMN city TEXT;
ALTER TABLE stores ADD COLUMN state TEXT;
ALTER TABLE stores ADD COLUMN zip TEXT;
ALTER TABLE stores ADD COLUMN pos TEXT;
ALTER TABLE stores ADD COLUMN profile TEXT;                         -- JSON: distributors, sales range, goals, problems, alerts
ALTER TABLE stores ADD COLUMN signup_ip TEXT;
ALTER TABLE stores ADD COLUMN decided_at TEXT;

UPDATE stores SET code = 'QLB-0001', status = 'active', city = 'Eustis', state = 'FL', pos = 'NRS',
  address = '2105 E Orange Ave', zip = '32726' WHERE id = 1;
CREATE UNIQUE INDEX IF NOT EXISTS stores_code ON stores(code);
