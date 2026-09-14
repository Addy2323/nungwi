import { readFile } from 'node:fs/promises'
import path from 'node:path'
export async function GET(_request:Request,{params}:{params:Promise<{name:string}>}) {
  const {name}=await params
  if(!/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(name))return new Response('Not found',{status:404})
  try {const buffer=await readFile(path.join(path.resolve(process.env.UPLOAD_DIR||'data/uploads'),name));return new Response(buffer,{headers:{'Content-Type':name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'}})}catch{return new Response('Not found',{status:404})}
}
