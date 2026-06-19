import { NextRequest, NextResponse } from 'next/server'

const PROTECTED = /^\/(dashboard|bank-accounts|bank-transfer|pay-bills|e-statement|smart-spend|api\/(accounts|transactions|transfer|search|admin))/

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!PROTECTED.test(pathname)) return NextResponse.next()

  if (!request.cookies.get('session')?.value) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, message: 'Authentication required.' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}
