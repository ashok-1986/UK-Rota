// =============================================================
// CareRota — Next.js Middleware
// Standard NextResponse — no Kinde SDK (Edge runtime incompatible).
// Kinde manages its own session via httpOnly cookies.
// =============================================================
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Public routes — no auth required
const PUBLIC_PATHS = [
  '/',
  '/privacy',
  '/account-not-linked',
  '/invite',
  '/register',
]

const PUBLIC_PREFIXES = [
  '/api/auth/kinde',      // Kinde callback and login/logout routes
  '/api/webhooks/',       // Kinde webhook handlers
  '/api/setup/',          // First-home setup
  '/api/onboarding/',     // Home registration (guarded by ONBOARDING_SECRET)
  '/invite/',             // Invite accept pages
  '/_next/',
  '/favicon',
]

const CRON_PREFIXES = [
  '/api/notify/',
  '/api/admin/',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static files and Next internals
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Exact public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // Cron routes — Bearer secret only
  if (CRON_PREFIXES.some(p => pathname.startsWith(p))) {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Check Kinde session cookie exists
  // Kinde sets cookies whose names vary by SDK version.
  // Check for any cookie starting with 'kinde' or named 'id_token'.
  const kindeSessionExists = request.cookies.getAll().some(
    c => c.name.startsWith('kinde') || c.name === 'id_token'
  )

  if (!kindeSessionExists) {
    // Sign-in and sign-up pages — let through (they render LoginLink/RegisterLink)
    if (pathname === '/sign-in' || pathname === '/sign-up') {
      return NextResponse.next()
    }

    const loginUrl = new URL('/api/auth/kinde/login', request.url)
    loginUrl.searchParams.set('post_login_redirect_url', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // NOTE: We do NOT inject x-home-id or x-user-role headers here.
  // Middleware runs on Edge and cannot decode the Kinde JWT.
  // Each page calls getKindeAuth() from src/lib/auth.ts.
  // API routes call getSessionFromHeaders() which falls back to
  // getKindeAuth() when headers are not present.

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
