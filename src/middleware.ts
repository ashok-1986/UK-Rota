// =============================================================
// CareRota — Next.js Middleware (Kinde Auth — Phase 2 RBAC)
// =============================================================
import { withAuth } from '@kinde-oss/kinde-auth-nextjs/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { AppRole } from '@/types'

const CRON_PATHS = ['/api/notify/', '/api/admin/']

const MANAGER_PATHS = [
  '/homes/',
  '/api/staff',
  '/api/shifts',
  '/api/units',
  '/api/rules',
  '/api/rota/assign',
  '/api/rota/publish',
  '/api/reports',
  '/api/homes',
]

const ADMIN_PATHS = ['/api/auth/signup-home']

function isCron(pathname: string) {
  return CRON_PATHS.some((p) => pathname.startsWith(p))
}

function isManagerRoute(pathname: string) {
  return MANAGER_PATHS.some((p) => pathname.startsWith(p))
}

function isAdminRoute(pathname: string) {
  return ADMIN_PATHS.some((p) => pathname.startsWith(p))
}

export default withAuth(
  function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // 1. Cron routes — secret header only, no session needed
    if (isCron(pathname)) {
      const authHeader = request.headers.get('authorization')
      const cronSecret = process.env.CRON_SECRET
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return NextResponse.next()
    }

    // 2. Extract claims from the Kinde-decoded JWT injected by withAuth
    // withAuth decodes and verifies the token before calling this function,
    // then attaches it to request.kindeAuth.token
    const token = (request as NextRequest & { kindeAuth?: { token?: Record<string, unknown> } })
      .kindeAuth?.token

    const userId = (token?.sub as string) ?? null

    // Kinde stores custom data in user_properties: { role: { v: "..." }, homeid: { v: "..." } }
    const userProps = token?.user_properties as Record<string, { v: string }> | undefined
    const role = (userProps?.role?.v ?? null) as AppRole | null
    const homeId = userProps?.homeid?.v ?? null

    // 3. Admin guard
    if (isAdminRoute(pathname) && role !== 'system_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Manager guard
    if (
      isManagerRoute(pathname) &&
      !['home_manager', 'unit_manager', 'system_admin'].includes(role ?? '')
    ) {
      return NextResponse.json({ error: 'Forbidden — manager access required' }, { status: 403 })
    }

    // 5. Tenant isolation — skip for RSC prefetch requests
    const isRscPrefetch =
      request.headers.get('RSC') === '1' ||
      request.nextUrl.searchParams.has('_rsc')

    if (!isRscPrefetch && homeId) {
      const homeIdMatch = pathname.match(/^\/homes\/([^/]+)/)
      if (homeIdMatch && homeIdMatch[1] !== homeId && role !== 'system_admin') {
        return NextResponse.json({ error: 'Forbidden — tenant mismatch' }, { status: 403 })
      }
    }

    // 6. Inject headers for API routes and server components
    const requestHeaders = new Headers(request.headers)
    if (userId) requestHeaders.set('x-user-id', userId)
    if (homeId) requestHeaders.set('x-home-id', homeId)
    if (role) requestHeaders.set('x-user-role', role)

    return NextResponse.next({ request: { headers: requestHeaders } })
  },
  {
    isReturnToCurrentPage: true,
    loginPage: '/sign-in',
  }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)|sign-in|sign-up|api/auth/kinde|privacy|api/webhooks|api/setup|api/notify|api/admin|$).*)',
  ],
}
