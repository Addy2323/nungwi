-- Extend the existing shop catalogue without importing demo products.
CREATE TABLE IF NOT EXISTS drink_categories (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'NON_ALCOHOLIC',
 icon TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
ALTER TABLE drink_categories ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1));
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS track_expiry INTEGER NOT NULL DEFAULT 1 CHECK(track_expiry IN (0,1));
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS flavor TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS country_of_origin TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS product_codes (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), code TEXT UNIQUE NOT NULL,
 code_type TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 1,
 source TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS product_codes_product ON product_codes(product_id);
CREATE INDEX IF NOT EXISTS products_catalogue_order ON products(lower(name),id);
CREATE INDEX IF NOT EXISTS products_barcode_search ON products(barcode);
CREATE INDEX IF NOT EXISTS stock_product_recent ON stock_movements(product_id,created_at DESC);
INSERT INTO drink_categories(id,name,type,icon,created_at)
 SELECT 'shop_' || md5(category), category, 'NON_ALCOHOLIC', '', now()::text
 FROM (SELECT DISTINCT category FROM products) p
 WHERE NOT EXISTS (SELECT 1 FROM drink_categories c WHERE lower(c.name)=lower(p.category))
 ON CONFLICT(id) DO NOTHING;
