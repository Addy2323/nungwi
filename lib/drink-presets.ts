export interface DrinkPreset {
  id: string
  name: string
  brand: string
  category: string
  subcategory?: string
  drink_type: 'ALCOHOLIC' | 'NON_ALCOHOLIC'
  type?: 'ALCOHOLIC' | 'NON_ALCOHOLIC'
  variant?: string
  flavor?: string
  alcohol_percentage: number
  volume_ml: number
  volume: string
  packaging: 'Bottle' | 'Can' | 'Carton' | 'Pack'
  country_of_origin: string
  manufacturer?: string
  unit: 'bottle' | 'can' | 'pack' | 'carton' | 'crate'
  unit_size: number
  price: number
  stock?: number
  status?: string
  image: string
  description: string
  barcode?: string
}

export const MASTER_CATEGORY_TREE = {
  ALCOHOLIC: [
    {
      category: 'Beer & Lager',
      subcategories: ['Local Beer', 'Imported Beer', 'Craft Beer']
    },
    {
      category: 'Cider',
      subcategories: ['Apple Cider', 'Flavoured Cider']
    },
    {
      category: 'RTD / Premixed',
      subcategories: ['Spirit Coolers', 'Flavoured Malt']
    },
    {
      category: 'Vodka',
      subcategories: ['Standard Vodka', 'Flavoured Vodka']
    },
    {
      category: 'Whisky',
      subcategories: ['Scotch Whisky', 'Irish Whiskey', 'Bourbon / American Whiskey']
    },
    {
      category: 'Gin',
      subcategories: ['London Dry Gin', 'Craft Gin', 'Flavoured Gin']
    },
    {
      category: 'Rum',
      subcategories: ['White Rum', 'Dark Rum', 'Spiced Rum']
    },
    {
      category: 'Brandy',
      subcategories: ['VS Brandy', 'VSOP Brandy']
    },
    {
      category: 'Cognac',
      subcategories: ['VS Cognac', 'VSOP Cognac', 'XO Cognac']
    },
    {
      category: 'Tequila',
      subcategories: ['Blanco', 'Reposado', 'Añejo']
    },
    {
      category: 'Liqueur',
      subcategories: ['Cream Liqueur', 'Herbal Liqueur', 'Fruit Liqueur']
    },
    {
      category: 'Wine',
      subcategories: ['Red Wine', 'White Wine', 'Rosé', 'Sparkling Wine']
    },
    {
      category: 'Champagne',
      subcategories: ['Brut', 'Demi-Sec', 'Rosé Champagne']
    },
    {
      category: 'Cocktails',
      subcategories: ['Pre-mixed Cocktails', 'Cocktail Mixers']
    },
    {
      category: 'Traditional Alcohol',
      subcategories: ['Local Brews', 'Palm Wine']
    }
  ],
  NON_ALCOHOLIC: [
    {
      category: 'Soft Drinks',
      subcategories: ['Carbonated Soda', 'Tonic & Mixers']
    },
    {
      category: 'Energy Drinks',
      subcategories: ['Caffeinated Energy', 'Sugar Free Energy']
    },
    {
      category: 'Malt Drinks',
      subcategories: ['Non-Alcoholic Malt']
    },
    {
      category: 'Juice',
      subcategories: ['Fruit Juice', 'Fresh Juice', 'Nectar']
    },
    {
      category: 'Water',
      subcategories: ['Still Water', 'Sparkling Water', 'Flavoured Water']
    },
    {
      category: 'Traditional / Local Drinks',
      subcategories: ['Tamarind (Ukwaju)', 'Hibiscus (Zobo/Roselle)', 'Baobab (Ubuyu)']
    },
    {
      category: 'Dairy & Yoghurt',
      subcategories: ['Mtindi (Sour Milk)', 'Drinking Yoghurt', 'Fresh Milk']
    },
    {
      category: 'Smoothies & Milkshakes',
      subcategories: ['Fruit Smoothies', 'Milkshakes']
    },
    {
      category: 'Tea',
      subcategories: ['Black Tea', 'Green Tea', 'Spiced Chai']
    },
    {
      category: 'Coffee & Hot Drinks',
      subcategories: ['African Coffee', 'Hot Chocolate', 'Milo']
    }
  ]
}

export const TANZANIA_DRINK_PRESETS: DrinkPreset[] = [
  // --- ALCOHOLIC ---
  {
    id: 'preset-konyagi-750',
    name: 'Konyagi Spirit 750ml',
    brand: 'Konyagi',
    category: 'Vodka',
    subcategory: 'Standard Spirit',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Original',
    flavor: 'Citrus & Herbal',
    alcohol_percentage: 35.0,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Tanzania Distilleries Limited',
    unit: 'bottle',
    unit_size: 1,
    price: 18000,
    image: '/logo.png',
    description: 'The premier spirit of Tanzania, smooth citrus and herbal notes.',
    barcode: '6001007000400'
  },
  {
    id: 'preset-kvant-750',
    name: 'K-Vant Premium Spirit 750ml',
    brand: 'K-Vant',
    category: 'Vodka',
    subcategory: 'Standard Spirit',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Premium Gold',
    alcohol_percentage: 40.0,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Mega Beverages Company',
    unit: 'bottle',
    unit_size: 1,
    price: 17000,
    image: '/logo.png',
    description: 'Smooth triple-distilled Tanzanian spirit.',
    barcode: '6001007000420'
  },
  {
    id: 'preset-safari-500',
    name: 'Safari Lager 500ml',
    brand: 'Safari',
    category: 'Beer & Lager',
    subcategory: 'Local Beer',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Lager',
    alcohol_percentage: 5.5,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Tanzania Breweries Limited',
    unit: 'bottle',
    unit_size: 1,
    price: 3000,
    image: '/logo.png',
    description: 'Iconic Tanzanian full-bodied lager by TBL.',
    barcode: '6001007000100'
  },
  {
    id: 'preset-kili-500',
    name: 'Kilimanjaro Premium Lager 500ml',
    brand: 'Kilimanjaro',
    category: 'Beer & Lager',
    subcategory: 'Local Beer',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Premium Lager',
    alcohol_percentage: 4.5,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Tanzania Breweries Limited',
    unit: 'bottle',
    unit_size: 1,
    price: 3000,
    image: '/logo.png',
    description: 'Crisp and refreshing Tanzanian lager brewed with water from Mt. Kilimanjaro.',
    barcode: '6001007000200'
  },
  {
    id: 'preset-serengeti-500',
    name: 'Serengeti Premium Lager 500ml',
    brand: 'Serengeti',
    category: 'Beer & Lager',
    subcategory: 'Local Beer',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: '100% Malt',
    alcohol_percentage: 5.0,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Serengeti Breweries Limited',
    unit: 'bottle',
    unit_size: 1,
    price: 3000,
    image: '/logo.png',
    description: '100% malt premium lager by SBL.',
    barcode: '6001007000300'
  },
  {
    id: 'preset-balimi-500',
    name: 'Balimi Extra Lager 500ml',
    brand: 'Balimi',
    category: 'Beer & Lager',
    subcategory: 'Local Beer',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    alcohol_percentage: 5.2,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Tanzania Breweries Limited',
    unit: 'bottle',
    unit_size: 1,
    price: 2500,
    image: '/logo.png',
    description: 'Popular Lake Zone lager in Tanzania.',
    barcode: '6001007000350'
  },
  {
    id: 'preset-ndovu-500',
    name: 'Ndovu Special Malt 500ml',
    brand: 'Ndovu',
    category: 'Beer & Lager',
    subcategory: 'Local Beer',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    alcohol_percentage: 4.8,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Tanzania Breweries Limited',
    unit: 'bottle',
    unit_size: 1,
    price: 3500,
    image: '/logo.png',
    description: 'Premium craft malt lager.',
    barcode: '6001007000360'
  },
  {
    id: 'preset-heineken-330',
    name: 'Heineken Lager Beer 330ml',
    brand: 'Heineken',
    category: 'Beer & Lager',
    subcategory: 'Imported Beer',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    alcohol_percentage: 5.0,
    volume_ml: 330,
    volume: '330ml',
    packaging: 'Bottle',
    country_of_origin: 'Netherlands',
    manufacturer: 'Heineken N.V.',
    unit: 'bottle',
    unit_size: 1,
    price: 4500,
    image: '/logo.png',
    description: 'World famous Dutch lager.',
    barcode: '8712000000010'
  },
  {
    id: 'preset-guinness-500',
    name: 'Guinness Foreign Extra Stout 500ml',
    brand: 'Guinness',
    category: 'Beer & Lager',
    subcategory: 'Stout',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    alcohol_percentage: 7.5,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Serengeti Breweries Limited',
    unit: 'bottle',
    unit_size: 1,
    price: 4000,
    image: '/logo.png',
    description: 'Rich dark stout with roasted malt bitterness.',
    barcode: '6001007000370'
  },
  {
    id: 'preset-johnnie-red-750',
    name: 'Johnnie Walker Red Label 750ml',
    brand: 'Johnnie Walker',
    category: 'Whisky',
    subcategory: 'Scotch Whisky',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Red Label',
    alcohol_percentage: 40.0,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'Scotland',
    manufacturer: 'Diageo',
    unit: 'bottle',
    unit_size: 1,
    price: 45000,
    image: '/logo.png',
    description: 'Vibrant blended Scotch whisky.',
    barcode: '5000267024105'
  },
  {
    id: 'preset-jameson-750',
    name: 'Jameson Irish Whiskey 750ml',
    brand: 'Jameson',
    category: 'Whisky',
    subcategory: 'Irish Whiskey',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    alcohol_percentage: 40.0,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'Ireland',
    manufacturer: 'Irish Distillers',
    unit: 'bottle',
    unit_size: 1,
    price: 55000,
    image: '/logo.png',
    description: 'Triple distilled smooth Irish whiskey.',
    barcode: '5011013100156'
  },
  {
    id: 'preset-jack-750',
    name: 'Jack Daniel’s Old No. 7 Tennessee Whiskey 750ml',
    brand: "Jack Daniel's",
    category: 'Whisky',
    subcategory: 'Bourbon / American Whiskey',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Old No. 7',
    alcohol_percentage: 40.0,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'USA',
    manufacturer: 'Brown-Forman',
    unit: 'bottle',
    unit_size: 1,
    price: 65000,
    image: '/logo.png',
    description: 'Charcoal mellowed Tennessee whiskey.',
    barcode: '082184090466'
  },
  {
    id: 'preset-gordons-750',
    name: "Gordon's London Dry Gin 750ml",
    brand: "Gordon's",
    category: 'Gin',
    subcategory: 'London Dry Gin',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    alcohol_percentage: 37.5,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'UK',
    manufacturer: 'Diageo',
    unit: 'bottle',
    unit_size: 1,
    price: 38000,
    image: '/logo.png',
    description: 'Classic juniper-forward London dry gin.',
    barcode: '5000267011105'
  },
  {
    id: 'preset-hennessy-vs-750',
    name: 'Hennessy VS Cognac 750ml',
    brand: 'Hennessy',
    category: 'Cognac',
    subcategory: 'VS Cognac',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Very Special (VS)',
    alcohol_percentage: 40.0,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'France',
    manufacturer: 'Jas Hennessy & Co.',
    unit: 'bottle',
    unit_size: 1,
    price: 135000,
    image: '/logo.png',
    description: 'Bold and aromatic French cognac.',
    barcode: '3245900001018'
  },
  {
    id: 'preset-amarula-750',
    name: 'Amarula Cream Liqueur 750ml',
    brand: 'Amarula',
    category: 'Liqueur',
    subcategory: 'Cream Liqueur',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    flavor: 'Marula Fruit & Cream',
    alcohol_percentage: 17.0,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'South Africa',
    manufacturer: 'Distell',
    unit: 'bottle',
    unit_size: 1,
    price: 42000,
    image: '/logo.png',
    description: 'Velvety cream liqueur crafted from wild Marula fruit.',
    barcode: '6001495000014'
  },
  {
    id: 'preset-dodoma-red',
    name: 'Dodoma Dry Red Wine 750ml',
    brand: 'Dodoma Wine',
    category: 'Wine',
    subcategory: 'Red Wine',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Dry Red',
    alcohol_percentage: 12.5,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Tanzania Wine Ltd',
    unit: 'bottle',
    unit_size: 1,
    price: 22000,
    image: '/logo.png',
    description: 'Authentic Tanzanian dry red wine produced in Dodoma region.',
    barcode: '6001007000700'
  },
  {
    id: 'preset-4th-street-sweet-red-750',
    name: '4th Street Sweet Red Wine 750ml',
    brand: '4th Street',
    category: 'Wine',
    subcategory: 'Red Wine',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Sweet Red',
    alcohol_percentage: 8.0,
    volume_ml: 750,
    volume: '750ml',
    packaging: 'Bottle',
    country_of_origin: 'South Africa',
    manufacturer: 'Distell',
    unit: 'bottle',
    unit_size: 1,
    price: 25000,
    image: '/logo.png',
    description: 'Easy-drinking fruity sweet red wine.',
    barcode: '6001495060018'
  },
  {
    id: 'preset-savanna-330',
    name: 'Savanna Dry Premium Cider 330ml',
    brand: 'Savanna',
    category: 'Cider',
    subcategory: 'Apple Cider',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Dry',
    alcohol_percentage: 5.5,
    volume_ml: 330,
    volume: '330ml',
    packaging: 'Bottle',
    country_of_origin: 'South Africa',
    manufacturer: 'Distell',
    unit: 'bottle',
    unit_size: 1,
    price: 4500,
    image: '/logo.png',
    description: 'Crisp dry South African apple cider.',
    barcode: '6001495005019'
  },
  {
    id: 'preset-smirnoff-ice-330',
    name: 'Smirnoff Ice Black 330ml',
    brand: 'Smirnoff',
    category: 'RTD / Premixed',
    subcategory: 'Spirit Coolers',
    drink_type: 'ALCOHOLIC',
    type: 'ALCOHOLIC',
    variant: 'Black',
    flavor: 'Guarana & Lemon',
    alcohol_percentage: 5.5,
    volume_ml: 330,
    volume: '330ml',
    packaging: 'Can',
    country_of_origin: 'Tanzania',
    manufacturer: 'Serengeti Breweries Limited',
    unit: 'can',
    unit_size: 1,
    price: 3500,
    image: '/logo.png',
    description: 'Premixed vodka cooler with lemon & guarana.',
    barcode: '6001007000380'
  },

  // --- NON-ALCOHOLIC ---
  {
    id: 'preset-cocacola-500',
    name: 'Coca-Cola Original 500ml PET',
    brand: 'Coca-Cola',
    category: 'Soft Drinks',
    subcategory: 'Carbonated Soda',
    drink_type: 'NON_ALCOHOLIC',
    type: 'NON_ALCOHOLIC',
    variant: 'Original Taste',
    flavor: 'Cola',
    alcohol_percentage: 0.0,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Nyanza Bottling Company',
    unit: 'bottle',
    unit_size: 1,
    price: 1500,
    image: '/logo.png',
    description: 'Classic sparkling cola drink.',
    barcode: '5449000000996'
  },
  {
    id: 'preset-fanta-500',
    name: 'Fanta Orange 500ml PET',
    brand: 'Fanta',
    category: 'Soft Drinks',
    subcategory: 'Carbonated Soda',
    drink_type: 'NON_ALCOHOLIC',
    type: 'NON_ALCOHOLIC',
    flavor: 'Orange',
    alcohol_percentage: 0.0,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Coca-Cola Kwanza',
    unit: 'bottle',
    unit_size: 1,
    price: 1500,
    image: '/logo.png',
    description: 'Fruity sparkling orange soda.',
    barcode: '5449000000997'
  },
  {
    id: 'preset-stoney-500',
    name: 'Stoney Tangawizi 500ml PET',
    brand: 'Stoney',
    category: 'Soft Drinks',
    subcategory: 'Carbonated Soda',
    drink_type: 'NON_ALCOHOLIC',
    type: 'NON_ALCOHOLIC',
    flavor: 'Ginger (Tangawizi)',
    alcohol_percentage: 0.0,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Coca-Cola Kwanza',
    unit: 'bottle',
    unit_size: 1,
    price: 1500,
    image: '/logo.png',
    description: 'Spicy and fiery Tanzanian ginger beer.',
    barcode: '5449000000998'
  },
  {
    id: 'preset-redbull-250',
    name: 'Red Bull Energy Drink 250ml',
    brand: 'Red Bull',
    category: 'Energy Drinks',
    subcategory: 'Caffeinated Energy',
    drink_type: 'NON_ALCOHOLIC',
    type: 'NON_ALCOHOLIC',
    alcohol_percentage: 0.0,
    volume_ml: 250,
    volume: '250ml',
    packaging: 'Can',
    country_of_origin: 'Austria',
    manufacturer: 'Red Bull GmbH',
    unit: 'can',
    unit_size: 1,
    price: 4500,
    image: '/logo.png',
    description: 'Vitalizes body and mind.',
    barcode: '90162602'
  },
  {
    id: 'preset-azam-embe-1L',
    name: 'Azam Mango Juice 1L Tetra Pak',
    brand: 'Azam Juice',
    category: 'Juice',
    subcategory: 'Fruit Juice',
    drink_type: 'NON_ALCOHOLIC',
    type: 'NON_ALCOHOLIC',
    flavor: 'Mango (Embe)',
    alcohol_percentage: 0.0,
    volume_ml: 1000,
    volume: '1L',
    packaging: 'Carton',
    country_of_origin: 'Tanzania',
    manufacturer: 'Bakhresa Group',
    unit: 'carton',
    unit_size: 1,
    price: 3000,
    image: '/logo.png',
    description: 'Rich Tanzanian mango fruit nectar.',
    barcode: '6001007000800'
  },
  {
    id: 'preset-ukwaju-500',
    name: 'Fresh Tamarind Juice (Ukwaju) 500ml',
    brand: 'Traditional Drinks',
    category: 'Traditional / Local Drinks',
    subcategory: 'Tamarind (Ukwaju)',
    drink_type: 'NON_ALCOHOLIC',
    type: 'NON_ALCOHOLIC',
    flavor: 'Spiced Tamarind',
    alcohol_percentage: 0.0,
    volume_ml: 500,
    volume: '500ml',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Local Zanzibar Craft',
    unit: 'bottle',
    unit_size: 1,
    price: 2000,
    image: '/logo.png',
    description: 'Tangy spiced traditional Tanzanian tamarind juice.',
    barcode: '6001007000900'
  },
  {
    id: 'preset-kiliwater-1500',
    name: 'Kilimanjaro Pure Drinking Water 1.5L',
    brand: 'Kilimanjaro Water',
    category: 'Water',
    subcategory: 'Still Water',
    drink_type: 'NON_ALCOHOLIC',
    type: 'NON_ALCOHOLIC',
    alcohol_percentage: 0.0,
    volume_ml: 1500,
    volume: '1.5L',
    packaging: 'Bottle',
    country_of_origin: 'Tanzania',
    manufacturer: 'Bonite Bottlers Limited',
    unit: 'bottle',
    unit_size: 1,
    price: 1500,
    image: '/logo.png',
    description: 'Pure purified drinking water from Mt. Kilimanjaro source.',
    barcode: '6001007000600'
  }
]
