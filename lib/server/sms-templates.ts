import { setting } from './db'
export const smsTemplates = {
 OTP: 'Hello {{customerName}}, your NUNGWI SHOP verification code is {{code}}. It expires in 5 minutes. Please do not share it with anyone.',
 WELCOME: 'Hello {{customerName}}, welcome to NUNGWI SHOP! Your account is ready. Explore our products and place your first order. Thank you for choosing us.',
 ORDER_CREATED: 'Hello {{customerName}}, thank you for shopping with NUNGWI SHOP! Order {{orderNumber}} has been received and is {{orderStatus}}. We will keep you updated.',
 ADMIN_NEW_ORDER: 'NUNGWI SHOP ORDER ALERT. Order {{orderNumber}}. Customer: {{customerName}}, {{customerPhone}}. Amount: {{orderTotal}}. Please review and process: {{adminPortal}}',
 ORDER_CONFIRMED: 'Hello {{customerName}}, NUNGWI SHOP has confirmed order {{orderNumber}}. We will let you know when it is ready for delivery.',
 ORDER_PROCESSING: 'Hello {{customerName}}, we are preparing your NUNGWI SHOP order {{orderNumber}} with care. We will update you when your driver is assigned.',
 DRIVER_ASSIGNED: 'Hello {{customerName}}, your NUNGWI SHOP order {{orderNumber}} will be delivered by {{driverName}}, {{driverPhone}}. Delivery: {{customerLocation}}. Thank you for shopping with us!',
 DRIVER_DELIVERY: 'Hello {{driverName}}, NUNGWI SHOP assigned order {{orderNumber}} to you. PICKUP: {{shopName}}, {{shopLocation}}. DELIVERY: {{customerName}}, {{customerLocation}}. Customer phone: {{customerPhone}}. Please collect the order and drive safely. {{deliveryInstructions}} {{deliveryLink}}',
 READY_FOR_PICKUP: 'Hello {{customerName}}, your NUNGWI SHOP order {{orderNumber}} is ready for pickup by {{driverName}}. We will let you know when it is on the way.',
 ORDER_PICKED_UP: 'Hello {{customerName}}, {{driverName}} has picked up your NUNGWI SHOP order {{orderNumber}}. Please keep your phone available for delivery updates.',
 OUT_FOR_DELIVERY: 'Hello {{customerName}}, your NUNGWI SHOP order {{orderNumber}} is on the way! Driver {{driverName}}, {{driverPhone}}, is heading to {{customerLocation}}. Please keep your phone available.',
 DRIVER_ARRIVING: 'Hello {{customerName}}, your NUNGWI SHOP order {{orderNumber}} is almost there! {{driverName}} is approaching your location. Please keep your phone available.',
 ORDER_DELIVERED: 'Hello {{customerName}}, your NUNGWI SHOP order {{orderNumber}} has been delivered. Thank you for your trust! We look forward to serving you again.',
 ORDER_CANCELLED: 'Hello {{customerName}}, your NUNGWI SHOP order {{orderNumber}} has been cancelled. Please contact the shop if you need help with your next order.',
 ORDER_FAILED: 'Hello {{customerName}}, we could not complete delivery of NUNGWI SHOP order {{orderNumber}}. Please contact the shop to arrange the next step.',
 ORDER_RETURNED: 'Hello {{customerName}}, the return of NUNGWI SHOP order {{orderNumber}} has been recorded. Please contact the shop for assistance.'
} as const
export type SmsType = keyof typeof smsTemplates
export const templateVariables = ['title','customerName','orderNumber','shopName','shopLocation','driverName','driverPhone','customerPhone','customerLocation','orderItems','orderTotal','orderStatus','adminPortal','code','deliveryInstructions','deliveryLink']
export function validateTemplate(template: string) {
 if (!template.trim() || template.length > 1600) throw new Error('Templates must contain 1–1600 characters.')
 for (const match of template.matchAll(/{{\s*(.*?)\s*}}/g)) if (!templateVariables.includes(match[1])) throw new Error(`Unknown template variable: ${match[1]}`)
 if (/{{|}}/.test(template.replace(/{{\s*\w+\s*}}/g, ''))) throw new Error('Invalid template placeholder.')
}
export function renderTemplate(template: string, values: Record<string,string>) {
 validateTemplate(template)
 return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => values[key] ?? '').replace(/ +/g, ' ').trim()
}
export async function smsText(type: SmsType, values: Record<string,string>) {
 return renderTemplate(await setting(`sms_template_${type}`, smsTemplates[type]), {...values, shopName:'NUNGWI SHOP'})
}
