// =============================================================
// CareRota — Next.js Middleware (Kinde Auth Stub)
// Phase 2 will restore full RBAC + tenant isolation.
// =============================================================
import { withAuth } from '@kinde-oss/kinde-auth-nextjs/middleware'
import type { NextRequest } from 'next/server'

export default withAuth(function middleware(_req: NextRequest) {
  return
}, {
  isReturnToCurrentPage: true,
  loginPage: '/sign-in',
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)|sign-in|sign-up|api/auth/kinde|privacy|api/webhooks|api/setup|api/notify|api/admin|$).*)',
  ],
}
