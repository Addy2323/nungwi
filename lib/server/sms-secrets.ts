import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
function key() {
 const value = process.env.SMS_ENCRYPTION_KEY || ''
 if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('SMS_ENCRYPTION_KEY must be a 32-byte hex key.')
 return Buffer.from(value,'hex')
}
export function sealSms(message: string) {
 const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',key(),iv)
 const data = Buffer.concat([cipher.update(message,'utf8'),cipher.final()])
 return [iv,cipher.getAuthTag(),data].map(v=>v.toString('base64')).join('.')
}
export function openSms(payload: string) {
 const [iv,tag,data] = payload.split('.').map(v=>Buffer.from(v,'base64'))
 const cipher = createDecipheriv('aes-256-gcm',key(),iv)
 cipher.setAuthTag(tag)
 return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8')
}
