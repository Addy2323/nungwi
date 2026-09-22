import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // Match only the alternate production host. Local previews must remain usable.
  if (request.headers.get('host')?.split(':')[0].toLowerCase() === 'www.vunjabeiliquorzanzibar.co.tz') {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, 'https://vunjabeiliquorzanzibar.co.tz')
    return NextResponse.redirect(target, 301)
  }
  return NextResponse.next()
}
