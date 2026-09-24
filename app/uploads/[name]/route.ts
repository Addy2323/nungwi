import { readFile } from 'node:fs/promises'
import path from 'node:path'
export async function GET(_request:Request,{params}:{params:Promise<{name:string}>}) {
  const {name}=await params
  if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(name))return new Response('Not found',{status:404})
  try {
    const uploadDir = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(process.cwd(), 'data/uploads'))
    const filePath = path.join(/*turbopackIgnore: true*/ uploadDir, name)
    const buffer = await readFile(/*turbopackIgnore: true*/ filePath)
    return new Response(buffer,{headers:{'Content-Type':name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'}})
  } catch {
    return new Response('Not found',{status:404})
  }
}
