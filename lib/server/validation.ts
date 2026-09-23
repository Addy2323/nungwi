import { normalizePhone } from '../phone-number'
import { z } from 'zod'
export const text = z.string().trim().min(1).max(500)
export const phone = z.string().transform((value, ctx) => { try { return normalizePhone(value) } catch { ctx.addIssue({code:'custom',message:'Enter a valid phone number, e.g. 0712345678 or +255712345678.'}); return z.NEVER } })
export const money = z.number().int().min(0).max(1000000000)
export const quantity = z.number().int().min(1).max(1000000)
export const unitsInput = z.preprocess((val) => {
  if (typeof val === 'string') {
    try {
      return val.trim() ? JSON.parse(val) : []
    } catch {
      return []
    }
  }
  return val || []
}, z.array(z.object({unit:z.string().min(1).max(30),unit_size:quantity,price:money,hotel_price:money.nullable().default(null),deposit:money.default(0)})).max(6).default([]))

export const date = z.string().datetime({ offset:true }).transform(value=>new Date(value).toISOString())
const image = z.string().max(500000).refine(value => value === '' || value.startsWith('/images/') || value.startsWith('/uploads/') || value.startsWith('data:image/') || /^https?:\/\/[^\s]+$/.test(value),'Use an uploaded image or HTTPS image URL.')
export const drinkTypeEnum = z.enum(['ALCOHOLIC', 'NON_ALCOHOLIC'])
export const codeTypeEnum = z.enum(['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'QR', 'INTERNAL_QR'])

export const productInput = z.object({
  id: z.string().optional(),
  name: text,
  brand: z.string().max(100).default(''),
  category: text,
  description: z.string().max(3000).default(''),
  image: image.default('/logo.png'),
  volume: z.string().max(50).default(''),
  unit: z.enum(['bottle','can','pack','carton','crate']).default('bottle'),
  unit_size: z.preprocess((val) => (val === null || val === '' || val === undefined ? 1 : Number(val)), quantity.default(1)),
  price: z.preprocess((val) => (val === null || val === '' || val === undefined ? 0 : Number(val)), money),
  hotel_price: z.preprocess((val) => (val === null || val === '' || val === undefined ? null : Number(val)), money.nullable().default(null)),
  cost: z.preprocess((val) => (val === null || val === '' || val === undefined ? 0 : Number(val)), money.default(0)),
  sku: text,
  reorder_level: z.preprocess((val) => (val === null || val === '' || val === undefined ? 10 : Number(val)), money.default(10)),
  min_qty: z.preprocess((val) => (val === null || val === '' || val === undefined ? 1 : Number(val)), quantity.default(1)),
  deposit: z.preprocess((val) => (val === null || val === '' || val === undefined ? 0 : Number(val)), money.default(0)),
  active: z.boolean().default(true),
  // Tanzania Drinks & Scanner additions
  drink_type: drinkTypeEnum.default('ALCOHOLIC'),
  category_id: z.string().optional().nullable(),
  subcategory_id: z.string().optional().nullable(),
  variant: z.string().max(100).default(''),
  flavor: z.string().max(100).default(''),
  volume_ml: z.preprocess((val) => (val === null || val === '' || val === undefined ? 500 : Number(val)), z.number().int().min(0).max(100000).default(500)),
  packaging: z.string().max(50).default('bottle'),
  alcohol_percentage: z.preprocess((val) => (val === null || val === '' || val === undefined ? null : Number(val)), z.number().min(0).max(100).optional().nullable()),
  country_of_origin: z.string().max(100).default('Tanzania'),
  manufacturer: z.string().max(100).default(''),
  barcode: z.string().max(100).optional().nullable(),
  barcode_type: codeTypeEnum.optional().nullable(),
  qr_code: z.string().max(100).optional().nullable(),
  qr_code_type: codeTypeEnum.optional().nullable(),
  internal_code: z.string().max(100).optional().nullable(),
  availability_region: z.string().max(100).default('Nationwide')
})

export const scannerLookupInput = z.object({
  code: z.string().trim().min(1).max(128),
  codeType: z.string().optional().default('UNKNOWN'),
  source: z.enum(['scanner', 'manual', 'file']).default('scanner')
})

export const productCodeInput = z.object({
  product_id: z.string().min(1),
  code: z.string().trim().min(1).max(128),
  code_type: codeTypeEnum,
  is_primary: z.boolean().default(true),
  source: z.enum(['manual', 'seeded', 'external_api', 'generated']).default('manual')
})

export const registerScannedProductInput = productInput.extend({
  scannedCode: z.string().trim().min(1).max(128),
  scannedCodeType: codeTypeEnum.default('EAN_13')
})

export const ruleInput = z.object({method:z.enum(['percentage','fixed','tiered']),value:money,scope:z.enum(['referral','purchase','both']).default('referral'),tiers:z.array(z.object({threshold:money,rate:z.number().min(0).max(100)})).max(10).default([])}).refine(r => r.method !== 'percentage' || r.value <= 100,'Percentage cannot exceed 100.').refine(r => r.method !== 'tiered' || r.tiers.length>0,'Add at least one tier.')
export const hotelInput = z.object({id:z.string().optional(),name:text,contact:text,phone,address:text,instructions:z.string().max(1000).default(''),code:z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/),active:z.boolean().default(true),rule:ruleInput})
export const driverInput = z.object({id:z.string().optional(),name:text,phone,vehicle:z.enum(['motorcycle','Bajaj','van','other']),registration:text,active:z.boolean().default(true)})
export const promotionInput = z.object({id:z.string().optional(),code:z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/),title:text,offer_text:text,image:image.default(''),color:z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ff5405'),template:z.enum(['banner','card','badge']).default('banner'),button:text.default('Shop now'),product_ids:z.array(z.string()).max(100).default([]),audience:z.enum(['all','customer','hotel']).default('all'),kind:z.enum(['percentage','fixed']),value:money,starts_at:date,ends_at:date,active:z.boolean().default(true)}).refine(p=>p.ends_at>p.starts_at,'End date must follow the start date.').refine(p=>p.kind!=='percentage'||p.value<=100,'Percentage cannot exceed 100.')
export const orderInput = z.object({items:z.array(z.object({product_id:z.string(),unit:z.string().max(30).optional(),quantity:z.number().int().min(1).max(1000)})).min(1).max(100),recipient:text,phone,address:text,instructions:z.string().max(1000).default(''),delivery_window:z.string().max(100).default(''),payment_method:z.enum(['cash','bank_transfer','card']),promotion:z.string().max(30).default(''),referral_code:z.string().max(30).default(''),idempotency_key:z.string().uuid()})
export const accountInput = z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase()),name:text,password:z.string().min(10).max(128),phone})
export const invitationInput = z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase()),name:text,phone,role:z.enum(['admin','sales','stock','delivery','customer','hotel_manager','hotel_staff']),hotel_id:z.string().nullable().default(null),password:z.preprocess((val)=>(val===''||val===null||val===undefined?null:String(val)),z.string().min(6).max(128).nullable().default(null))})

