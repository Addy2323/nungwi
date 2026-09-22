-- 004_master_drinks_catalog.sql
-- Master Category Structure & Comprehensive Tanzania Drinks Product Database Expansion

ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flavor TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging TEXT DEFAULT 'Bottle';
ALTER TABLE products ADD COLUMN IF NOT EXISTS country_of_origin TEXT DEFAULT 'Tanzania';
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer TEXT;

-- Create/update drink categories & subcategories
INSERT INTO drink_categories (code, name, drink_type, icon_name, sort_order) VALUES
('ALC_BEER', 'Beer & Lager', 'ALCOHOLIC', 'beer', 1),
('ALC_CIDER', 'Cider', 'ALCOHOLIC', 'wine', 2),
('ALC_RTD', 'RTD / Premixed', 'ALCOHOLIC', 'glass-water', 3),
('ALC_VODKA', 'Vodka', 'ALCOHOLIC', 'wine-glass', 4),
('ALC_WHISKY', 'Whisky', 'ALCOHOLIC', 'flame', 5),
('ALC_GIN', 'Gin', 'ALCOHOLIC', 'citrus', 6),
('ALC_RUM', 'Rum', 'ALCOHOLIC', 'palmtree', 7),
('ALC_BRANDY', 'Brandy', 'ALCOHOLIC', 'wine', 8),
('ALC_COGNAC', 'Cognac', 'ALCOHOLIC', 'award', 9),
('ALC_TEQUILA', 'Tequila', 'ALCOHOLIC', 'sun', 10),
('ALC_LIQUEUR', 'Liqueur', 'ALCOHOLIC', 'sparkles', 11),
('ALC_WINE', 'Wine', 'ALCOHOLIC', 'wine', 12),
('ALC_CHAMPAGNE', 'Champagne', 'ALCOHOLIC', 'sparkles', 13),
('ALC_COCKTAILS', 'Cocktails', 'ALCOHOLIC', 'martini', 14),
('ALC_TRADITIONAL', 'Traditional Alcohol', 'ALCOHOLIC', 'beer', 15),

('NON_SOFT', 'Soft Drinks', 'NON_ALCOHOLIC', 'cup-soda', 16),
('NON_ENERGY', 'Energy Drinks', 'NON_ALCOHOLIC', 'zap', 17),
('NON_MALT', 'Malt Drinks', 'NON_ALCOHOLIC', 'coffee', 18),
('NON_JUICE', 'Juice', 'NON_ALCOHOLIC', 'apple', 19),
('NON_WATER', 'Water', 'NON_ALCOHOLIC', 'droplet', 20),
('NON_LOCAL', 'Traditional / Local Drinks', 'NON_ALCOHOLIC', 'leaf', 21),
('NON_DAIRY', 'Dairy & Yoghurt', 'NON_ALCOHOLIC', 'milk', 22),
('NON_SMOOTHIE', 'Smoothies & Milkshakes', 'NON_ALCOHOLIC', 'cup-soda', 23),
('NON_TEA', 'Tea', 'NON_ALCOHOLIC', 'coffee', 24),
('NON_COFFEE', 'Coffee & Hot Drinks', 'NON_ALCOHOLIC', 'coffee', 25)
ON CONFLICT (code) DO NOTHING;

-- Seed Subcategories
INSERT INTO drink_subcategories (category_id, code, name, sort_order)
SELECT id, 'WHISKY_SCOTCH', 'Scotch Whisky', 1 FROM drink_categories WHERE code = 'ALC_WHISKY'
ON CONFLICT (code) DO NOTHING;

INSERT INTO drink_subcategories (category_id, code, name, sort_order)
SELECT id, 'WHISKY_IRISH', 'Irish Whiskey', 2 FROM drink_categories WHERE code = 'ALC_WHISKY'
ON CONFLICT (code) DO NOTHING;

INSERT INTO drink_subcategories (category_id, code, name, sort_order)
SELECT id, 'WHISKY_BOURBON', 'Bourbon / American Whiskey', 3 FROM drink_categories WHERE code = 'ALC_WHISKY'
ON CONFLICT (code) DO NOTHING;

INSERT INTO drink_subcategories (category_id, code, name, sort_order)
SELECT id, 'WINE_RED', 'Red Wine', 1 FROM drink_categories WHERE code = 'ALC_WINE'
ON CONFLICT (code) DO NOTHING;

INSERT INTO drink_subcategories (category_id, code, name, sort_order)
SELECT id, 'WINE_WHITE', 'White Wine', 2 FROM drink_categories WHERE code = 'ALC_WINE'
ON CONFLICT (code) DO NOTHING;

INSERT INTO drink_subcategories (category_id, code, name, sort_order)
SELECT id, 'WINE_ROSE', 'Rosé', 3 FROM drink_categories WHERE code = 'ALC_WINE'
ON CONFLICT (code) DO NOTHING;

INSERT INTO drink_subcategories (category_id, code, name, sort_order)
SELECT id, 'WINE_SPARKLING', 'Sparkling Wine', 4 FROM drink_categories WHERE code = 'ALC_WINE'
ON CONFLICT (code) DO NOTHING;

-- Seed Key Tanzania Products
INSERT INTO products (
  id, name, brand, category, subcategory, drink_type, alcohol_percentage, volume_ml, packaging, country_of_origin, manufacturer, sku, barcode, barcode_type, price, cost, unit, unit_size, image, description, active
) VALUES
('prod-konyagi-750', 'Konyagi Spirit 750ml', 'Konyagi', 'Spirits & Liqueurs', 'Vodka / Spirits', 'ALCOHOLIC', 35.0, 750, 'Bottle', 'Tanzania', 'Tanzania Distilleries Limited', 'KONYAGI-750ML', '6001007000400', 'EAN_13', 18000, 14000, 'bottle', 1, '/images/mango-coast.png', 'The premier spirit of Tanzania, smooth citrus and herbal notes.', true),
('prod-kvant-750', 'K-Vant Premium Spirit 750ml', 'K-Vant', 'Spirits & Liqueurs', 'Vodka / Spirits', 'ALCOHOLIC', 40.0, 750, 'Bottle', 'Tanzania', 'Mega Beverages Company', 'KVANT-750ML', '6001007000420', 'EAN_13', 17000, 13000, 'bottle', 1, '/images/mango-coast.png', 'Smooth triple-distilled Tanzanian spirit.', true),
('prod-safari-500', 'Safari Lager 500ml', 'Safari', 'Beer & Lager', 'Beer & Lager', 'ALCOHOLIC', 5.5, 500, 'Bottle', 'Tanzania', 'Tanzania Breweries Limited', 'SAFARI-500ML', '6001007000100', 'EAN_13', 3000, 2200, 'bottle', 1, '/images/mango-coast.png', 'Iconic Tanzanian full-bodied lager by TBL.', true),
('prod-kili-500', 'Kilimanjaro Premium Lager 500ml', 'Kilimanjaro', 'Beer & Lager', 'Beer & Lager', 'ALCOHOLIC', 4.5, 500, 'Bottle', 'Tanzania', 'Tanzania Breweries Limited', 'KILI-500ML', '6001007000200', 'EAN_13', 3000, 2200, 'bottle', 1, '/images/mango-coast.png', 'Crisp and refreshing Tanzanian lager brewed with water from Mt. Kilimanjaro.', true),
('prod-serengeti-500', 'Serengeti Premium Lager 500ml', 'Serengeti', 'Beer & Lager', 'Beer & Lager', 'ALCOHOLIC', 5.0, 500, 'Bottle', 'Tanzania', 'Serengeti Breweries Limited', 'SERENGETI-500ML', '6001007000300', 'EAN_13', 3000, 2200, 'bottle', 1, '/images/mango-coast.png', '100% malt premium lager by SBL.', true),
('prod-balimi-500', 'Balimi Extra Lager 500ml', 'Balimi', 'Beer & Lager', 'Beer & Lager', 'ALCOHOLIC', 5.2, 500, 'Bottle', 'Tanzania', 'Tanzania Breweries Limited', 'BALIMI-500ML', '6001007000350', 'EAN_13', 2500, 1800, 'bottle', 1, '/images/mango-coast.png', 'Popular Lake Zone lager in Tanzania.', true),
('prod-ndovu-500', 'Ndovu Special Malt 500ml', 'Ndovu', 'Beer & Lager', 'Beer & Lager', 'ALCOHOLIC', 4.8, 500, 'Bottle', 'Tanzania', 'Tanzania Breweries Limited', 'NDOVU-500ML', '6001007000360', 'EAN_13', 3500, 2600, 'bottle', 1, '/images/mango-coast.png', 'Premium craft malt lager.', true),
('prod-grandmalt-330', 'Grand Malt 330ml Can', 'Grand Malt', 'Soft Drinks & Water', 'Malt Drinks', 'NON_ALCOHOLIC', 0.0, 330, 'Can', 'Tanzania', 'Tanzania Breweries Limited', 'GRANDMALT-330ML', '6001007000500', 'EAN_13', 2000, 1400, 'can', 1, '/images/mango-coast.png', 'Rich non-alcoholic malt drink packed with energy & vitamins.', true),
('prod-cocacola-500', 'Coca-Cola 500ml PET', 'Coca-Cola', 'Soft Drinks & Water', 'Soft Drinks', 'NON_ALCOHOLIC', 0.0, 500, 'Bottle', 'Tanzania', 'Nyanza Bottling Company', 'COCACOLA-500ML', '5449000000996', 'EAN_13', 1500, 1000, 'bottle', 1, '/images/mango-coast.png', 'Classic sparkling cola drink.', true),
('prod-kiliwater-1500', 'Kilimanjaro Pure Drinking Water 1.5L', 'Kilimanjaro Water', 'Soft Drinks & Water', 'Water', 'NON_ALCOHOLIC', 0.0, 1500, 'Bottle', 'Tanzania', 'Bonite Bottlers Limited', 'KILIWATER-1.5L', '6001007000600', 'EAN_13', 1500, 900, 'bottle', 1, '/images/mango-coast.png', 'Pure purified drinking water from Mt. Kilimanjaro source.', true),
('prod-dodoma-red', 'Dodoma Dry Red Wine 750ml', 'Dodoma Wine', 'Wine & Champagne', 'Red Wine', 'ALCOHOLIC', 12.5, 750, 'Bottle', 'Tanzania', 'Tanzania Wine Ltd', 'DODOMA-RED-750ML', '6001007000700', 'EAN_13', 22000, 16000, 'bottle', 1, '/images/mango-coast.png', 'Authentic Tanzanian dry red wine produced in Dodoma region.', true)
ON CONFLICT (id) DO UPDATE SET
  subcategory = EXCLUDED.subcategory,
  packaging = EXCLUDED.packaging,
  country_of_origin = EXCLUDED.country_of_origin,
  manufacturer = EXCLUDED.manufacturer;

-- Ensure product_codes mapping entries exist
INSERT INTO product_codes (product_id, code, code_type, is_primary)
VALUES
('prod-konyagi-750', '6001007000400', 'EAN_13', true),
('prod-kvant-750', '6001007000420', 'EAN_13', true),
('prod-safari-500', '6001007000100', 'EAN_13', true),
('prod-kili-500', '6001007000200', 'EAN_13', true),
('prod-serengeti-500', '6001007000300', 'EAN_13', true),
('prod-balimi-500', '6001007000350', 'EAN_13', true),
('prod-ndovu-500', '6001007000360', 'EAN_13', true),
('prod-grandmalt-330', '6001007000500', 'EAN_13', true),
('prod-cocacola-500', '5449000000996', 'EAN_13', true),
('prod-kiliwater-1500', '6001007000600', 'EAN_13', true),
('prod-dodoma-red', '6001007000700', 'EAN_13', true)
ON CONFLICT (code) DO NOTHING;
