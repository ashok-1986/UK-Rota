// =============================================================
// CareRota — Next.js Middleware
// Standard NextResponse — no Kinde SDK (Edge runtime incompatible).
// Kinde manages its own session via httpOnly cookies.
// =============================================================
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decodeJwt, jwtVerify, createRemoteJWKSet } from 'jose'

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

export async function middleware(request: NextRequest) {
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

  // Kinde sets cookies whose names vary by SDK version.
  // We'll look for access_token or id_token to decode role and homeId
  const allCookies = request.cookies.getAll()
  let tokenStr: string | undefined

  for (const c of allCookies) {
    if (c.name.includes('access_token')) {
      tokenStr = c.value
      break
    }
  }

  if (!tokenStr) {
    for (const c of allCookies) {
      if (c.name.includes('id_token')) {
        tokenStr = c.value
        break
      }
    }
  }

  const kindeSessionExists = allCookies.some(
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

  let role: string | null = null
  let homeId: string | null = null
  let userId: string | null = null

  if (tokenStr) {
    try {
      // Secure validation of JWT signature using Kinde's JWKS
      const issuerUrl = process.env.KINDE_ISSUER_URL
      if (!issuerUrl) {
        console.error('[middleware] Missing KINDE_ISSUER_URL env var')
      } else {
        const jwksUrl = new URL('/.well-known/jwks.json', issuerUrl)
        const JWKS = createRemoteJWKSet(jwksUrl)
        const { payload } = await jwtVerify(tokenStr, JWKS, {
          issuer: issuerUrl,
        })

        userId = payload.sub || null
        // user_properties is stored as lower case keys in Kinde
        const userProps = payload.user_properties as Record<string, { v: string }> | undefined
        if (userProps) {
          role = userProps.role?.v || null
          homeId = userProps.homeid?.v || null
        }
      }
    } catch (e) {
      console.error('[middleware] Failed to verify JWT:', e)
    }
  }

  const isRSC = request.headers.get('RSC') === '1' || request.nextUrl.searchParams.has('_rsc')
  const isManagerRoute = pathname.match(/^\/homes\/.*\/settings/) ||
                         pathname.match(/^\/api\/(staff|shifts|units|rules|rota\/assign|rota\/publish|reports|homes)/)
  const isAdminRoute = pathname.match(/^\/api\/auth\/signup-home/)

  // If this is a normal request and we're navigating to a manager or admin route, check roles
  if (!isRSC) {
    if (isAdminRoute && role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (isManagerRoute && !['system_admin', 'home_manager', 'unit_manager'].includes(role || '')) {
      // 403 or redirect
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      } else {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  }

  const requestHeaders = new Headers(request.headers)

  // Security fix: Strip any existing spoofed headers
  requestHeaders.delete('x-user-role')
  requestHeaders.delete('x-home-id')
  requestHeaders.delete('x-user-id')

  if (role) requestHeaders.set('x-user-role', role)
  if (homeId) requestHeaders.set('x-home-id', homeId)
  if (userId) requestHeaders.set('x-user-id', userId)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
