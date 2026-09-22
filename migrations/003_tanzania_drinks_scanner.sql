-- Migration 003: Tanzania Drinks Catalog & Universal QR/Barcode Scanner Schema

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'drink_type') THEN
        CREATE TYPE drink_type AS ENUM ('ALCOHOLIC', 'NON_ALCOHOLIC');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS drink_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type drink_type NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drink_subcategories (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES drink_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Extended product properties
ALTER TABLE products ADD COLUMN IF NOT EXISTS drink_type drink_type DEFAULT 'ALCOHOLIC';
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES drink_categories(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id TEXT REFERENCES drink_subcategories(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS flavor TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS volume_ml INTEGER NOT NULL DEFAULT 500 CHECK(volume_ml >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging TEXT NOT NULL DEFAULT 'bottle';
ALTER TABLE products ADD COLUMN IF NOT EXISTS alcohol_percentage NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS country_of_origin TEXT NOT NULL DEFAULT 'Tanzania';
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS qr_code_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_code TEXT UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS availability_region TEXT NOT NULL DEFAULT 'Nationwide';

-- Multi-identifier mapping table
CREATE TABLE IF NOT EXISTS product_codes (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    code_type TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0,1)),
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_codes_code ON product_codes(code);
CREATE INDEX IF NOT EXISTS idx_product_codes_product ON product_codes(product_id);

-- Analytics log table
CREATE TABLE IF NOT EXISTS scanner_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    code TEXT NOT NULL,
    code_type TEXT NOT NULL,
    product_id TEXT REFERENCES products(id),
    result TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'scanner',
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scanner_analytics_created ON scanner_analytics(created_at);

-- Seed Categories & Subcategories
INSERT INTO drink_categories (id, name, type, icon, created_at) VALUES
('cat_beer', 'Beer & Lager', 'ALCOHOLIC', '🍺', NOW()),
('cat_cider', 'Cider', 'ALCOHOLIC', '🍏', NOW()),
('cat_rtd', 'RTD / Premixed', 'ALCOHOLIC', '🍹', NOW()),
('cat_vodka', 'Vodka', 'ALCOHOLIC', '🍸', NOW()),
('cat_whisky', 'Whisky', 'ALCOHOLIC', '🥃', NOW()),
('cat_gin', 'Gin', 'ALCOHOLIC', '🍸', NOW()),
('cat_rum', 'Rum', 'ALCOHOLIC', '🥃', NOW()),
('cat_brandy', 'Brandy', 'ALCOHOLIC', '🍷', NOW()),
('cat_cognac', 'Cognac', 'ALCOHOLIC', '🍷', NOW()),
('cat_tequila', 'Tequila', 'ALCOHOLIC', '🌵', NOW()),
('cat_liqueur', 'Liqueur', 'ALCOHOLIC', '🍶', NOW()),
('cat_wine', 'Wine', 'ALCOHOLIC', '🍷', NOW()),
('cat_champagne', 'Champagne', 'ALCOHOLIC', '🍾', NOW()),
('cat_traditional_alc', 'Traditional Alcohol', 'ALCOHOLIC', '🍯', NOW()),
('cat_soft_drinks', 'Soft Drinks', 'NON_ALCOHOLIC', '🥤', NOW()),
('cat_energy', 'Energy Drinks', 'NON_ALCOHOLIC', '⚡', NOW()),
('cat_malt', 'Malt Drinks', 'NON_ALCOHOLIC', '🌾', NOW()),
('cat_juice', 'Juice', 'NON_ALCOHOLIC', '🧃', NOW()),
('cat_water', 'Water', 'NON_ALCOHOLIC', '💧', NOW()),
('cat_traditional_non', 'Traditional / Local Drinks', 'NON_ALCOHOLIC', '🌴', NOW()),
('cat_dairy', 'Dairy & Yoghurt', 'NON_ALCOHOLIC', '🥛', NOW()),
('cat_hot', 'Tea, Coffee & Hot Drinks', 'NON_ALCOHOLIC', '☕', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO drink_subcategories (id, category_id, name, created_at) VALUES
('sub_scotch', 'cat_whisky', 'Scotch Whisky', NOW()),
('sub_irish', 'cat_whisky', 'Irish Whiskey', NOW()),
('sub_bourbon', 'cat_whisky', 'Bourbon / American Whiskey', NOW()),
('sub_red_wine', 'cat_wine', 'Red Wine', NOW()),
('sub_white_wine', 'cat_wine', 'White Wine', NOW()),
('sub_rose_wine', 'cat_wine', 'Rosé', NOW()),
('sub_sparkling_wine', 'cat_wine', 'Sparkling Wine', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Tanzania Drinks Catalog
-- 1. Safari Lager 500ml
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_safari_500', 'Safari Lager 500ml', 'Safari', 'Beer & Lager', 'Tanzania classic full-bodied amber lager beer.', '/images/mango-coast.png', '500ml', 'bottle', 1, 2500, 1600, 'TZ-SAFARI-500', '6001007000100', 'EAN_13', 'DRINK-01HSAFARI500', 'ALCOHOLIC', 'cat_beer', 500, 'bottle', 5.5, 'Tanzania', 'TBL / AB InBev', 'Nationwide', NOW(), '[{"unit":"crate","unit_size":24,"price":58000,"deposit":2000}]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_safari_1', 'tz_safari_500', '6001007000100', 'EAN_13', 1, 'seeded', NOW()),
('code_safari_2', 'tz_safari_500', 'DRINK-01HSAFARI500', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;

-- 2. Kilimanjaro Premium Lager 500ml
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_kili_500', 'Kilimanjaro Premium Lager 500ml', 'Kilimanjaro', 'Beer & Lager', 'Crisp premium lager named after Mount Kilimanjaro.', '/images/mango-coast.png', '500ml', 'bottle', 1, 2500, 1600, 'TZ-KILI-500', '6001007000209', 'EAN_13', 'DRINK-01HKILI500', 'ALCOHOLIC', 'cat_beer', 500, 'bottle', 4.5, 'Tanzania', 'TBL / AB InBev', 'Nationwide', NOW(), '[{"unit":"crate","unit_size":24,"price":58000,"deposit":2000}]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_kili_1', 'tz_kili_500', '6001007000209', 'EAN_13', 1, 'seeded', NOW()),
('code_kili_2', 'tz_kili_500', 'DRINK-01HKILI500', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;

-- 3. Serengeti Lager 500ml
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_serengeti_500', 'Serengeti Premium Lager 500ml', 'Serengeti', 'Beer & Lager', '100% malt premium Tanzanian lager.', '/images/mango-coast.png', '500ml', 'bottle', 1, 2500, 1600, 'TZ-SERENGETI-500', '6001234567890', 'EAN_13', 'DRINK-01HSERENGETI', 'ALCOHOLIC', 'cat_beer', 500, 'bottle', 5.0, 'Tanzania', 'SBL / Diageo', 'Nationwide', NOW(), '[{"unit":"crate","unit_size":24,"price":58000,"deposit":2000}]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_serengeti_1', 'tz_serengeti_500', '6001234567890', 'EAN_13', 1, 'seeded', NOW()),
('code_serengeti_2', 'tz_serengeti_500', 'DRINK-01HSERENGETI', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;

-- 4. Konyagi 750ml
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_konyagi_750', 'Konyagi The Spirit of Tanzania 750ml', 'Konyagi', 'Traditional Alcohol', 'Iconic Tanzanian clear spirit distilled with natural citrus notes.', '/images/mango-coast.png', '750ml', 'bottle', 1, 14000, 9500, 'TZ-KONYAGI-750', '6161234560011', 'EAN_13', 'DRINK-01HKONYAGI750', 'ALCOHOLIC', 'cat_traditional_alc', 750, 'bottle', 35.0, 'Tanzania', 'Tanzania Distilleries Limited', 'Nationwide', NOW(), '[]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_konyagi_1', 'tz_konyagi_750', '6161234560011', 'EAN_13', 1, 'seeded', NOW()),
('code_konyagi_2', 'tz_konyagi_750', 'DRINK-01HKONYAGI750', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;

-- 5. K-Vant Premium Spirit 750ml
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_kvant_750', 'K-Vant Premium Gin 750ml', 'K-Vant', 'Gin', 'Smooth premium Tanzanian gin.', '/images/mango-coast.png', '750ml', 'bottle', 1, 15000, 10000, 'TZ-KVANT-750', '6161234560028', 'EAN_13', 'DRINK-01HKVANT750', 'ALCOHOLIC', 'cat_gin', 750, 'bottle', 40.0, 'Tanzania', 'Mega Beverages', 'Nationwide', NOW(), '[]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_kvant_1', 'tz_kvant_750', '6161234560028', 'EAN_13', 1, 'seeded', NOW()),
('code_kvant_2', 'tz_kvant_750', 'DRINK-01HKVANT750', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;

-- 6. Red Bull Energy Drink 250ml
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_redbull_250', 'Red Bull Energy Drink 250ml', 'Red Bull', 'Energy Drinks', 'Vitalizes body and mind.', '/images/mango-coast.png', '250ml', 'can', 1, 4000, 2800, 'NZ-REDBULL-250', '9002490100070', 'EAN_13', 'DRINK-01HREDBULL', 'NON_ALCOHOLIC', 'cat_energy', 250, 'can', 0, 'Austria', 'Red Bull GmbH', 'Nationwide', NOW(), '[]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_redbull_1', 'tz_redbull_250', '9002490100070', 'EAN_13', 1, 'seeded', NOW()),
('code_redbull_2', 'tz_redbull_250', 'DRINK-01HREDBULL', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;

-- 7. Stoney Tangawizi 500ml
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_stoney_500', 'Stoney Tangawizi Ginger Soda 500ml', 'Stoney Tangawizi', 'Soft Drinks', 'Fiery Tanzanian ginger beer soft drink.', '/images/mango-coast.png', '500ml', 'bottle', 1, 1500, 900, 'TZ-STONEY-500', '5449000000996', 'EAN_13', 'DRINK-01HSTONEY500', 'NON_ALCOHOLIC', 'cat_soft_drinks', 500, 'bottle', 0, 'Tanzania', 'Coca-Cola Kwanza', 'Nationwide', NOW(), '[{"unit":"carton","unit_size":24,"price":32000,"deposit":0}]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_stoney_1', 'tz_stoney_500', '5449000000996', 'EAN_13', 1, 'seeded', NOW()),
('code_stoney_2', 'tz_stoney_500', 'DRINK-01HSTONEY500', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;

-- 8. Azam Mango Juice 1L
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_azam_mango_1l', 'Azam Mango Juice 1L', 'Azam', 'Juice', 'Rich tropical Tanzanian mango juice blend.', '/images/mango-coast.png', '1000ml', 'pack', 1, 3000, 2000, 'TZ-AZAM-MANGO-1L', '6161000123456', 'EAN_13', 'DRINK-01HAZAMMANGO', 'NON_ALCOHOLIC', 'cat_juice', 1000, 'pack', 0, 'Tanzania', 'Bakhresa Group', 'Nationwide', NOW(), '[]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_azam_1', 'tz_azam_mango_1l', '6161000123456', 'EAN_13', 1, 'seeded', NOW()),
('code_azam_2', 'tz_azam_mango_1l', 'DRINK-01HAZAMMANGO', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;

-- 9. Uhai Drinking Water 500ml
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_uhai_500', 'Uhai Natural Pure Drinking Water 500ml', 'Uhai', 'Water', 'Refreshingly pure Tanzanian spring drinking water.', '/images/mango-coast.png', '500ml', 'bottle', 1, 800, 400, 'TZ-UHAI-500', '6161000654321', 'EAN_13', 'DRINK-01HUHAI500', 'NON_ALCOHOLIC', 'cat_water', 500, 'bottle', 0, 'Tanzania', 'Bakhresa Group', 'Nationwide', NOW(), '[{"unit":"carton","unit_size":24,"price":16000,"deposit":0}]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_uhai_1', 'tz_uhai_500', '6161000654321', 'EAN_13', 1, 'seeded', NOW()),
('code_uhai_2', 'tz_uhai_500', 'DRINK-01HUHAI500', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;

-- 10. Johnnie Walker Black Label 750ml
INSERT INTO products (id, name, brand, category, description, image, volume, unit, unit_size, price, cost, sku, barcode, barcode_type, internal_code, drink_type, category_id, subcategory_id, volume_ml, packaging, alcohol_percentage, country_of_origin, manufacturer, availability_region, created_at, units) VALUES
('tz_jw_black_750', 'Johnnie Walker Black Label 12 Year 750ml', 'Johnnie Walker', 'Whisky', 'Iconic Scotch whisky aged for at least 12 years.', '/images/mango-coast.png', '750ml', 'bottle', 1, 75000, 52000, 'JW-BLACK-750', '5000267024310', 'EAN_13', 'DRINK-01HJWBLACK', 'ALCOHOLIC', 'cat_whisky', 'sub_scotch', 750, 'bottle', 40.0, 'Scotland', 'Diageo', 'Nationwide', NOW(), '[]')
ON CONFLICT (id) DO NOTHING;
INSERT INTO product_codes (id, product_id, code, code_type, is_primary, source, created_at) VALUES
('code_jwblack_1', 'tz_jw_black_750', '5000267024310', 'EAN_13', 1, 'seeded', NOW()),
('code_jwblack_2', 'tz_jw_black_750', 'DRINK-01HJWBLACK', 'INTERNAL_QR', 0, 'generated', NOW())
ON CONFLICT (code) DO NOTHING;
