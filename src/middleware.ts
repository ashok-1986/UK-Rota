// =============================================================
// CareRota — Next.js Middleware (Multi-Tenant)
// Handles:
//   1. Clerk JWT verification (authentication)
//   2. RBAC — role-based access control from session claims
//   3. Tenant scoping — injects x-home-id header for API routes
//
// JWT Template (configure in Clerk Dashboard → JWT Templates):
// {
//   "metadata": {
//     "role":   "{{user.public_metadata.role}}",
//     "homeId": "{{user.public_metadata.homeId}}"
//   }
// }
// If the template is NOT configured, publicMetadata is read directly
// from sessionClaims.publicMetadata (Clerk default).
// =============================================================
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AppRole } from '@/types';

// ------------------------------------------------------------------
// Route matchers
// ------------------------------------------------------------------
const isPublicRoute = createRouteMatcher([
  '/',                          // landing page — unauthenticated users must see this
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/account-not-linked(.*)',    // needs to be reachable without valid metadata
  '/privacy',
  '/api/webhooks/clerk',
  '/api/setup/first-home(.*)',
]);

const isCronRoute = createRouteMatcher([
  '/api/notify/(.*)',
  '/api/admin/(.*)',
]);

// Only home_manager, unit_manager, or system_admin
const isManagerRoute = createRouteMatcher([
  '/homes/(.*)/settings(.*)',
  '/api/staff(.*)',
  '/api/shifts(.*)',
  '/api/units(.*)',
  '/api/rules(.*)',
  '/api/rota/assign(.*)',
  '/api/rota/publish(.*)',
  '/api/reports(.*)',
  '/api/homes(.*)',
]);

// Only system_admin
const isAdminRoute = createRouteMatcher([
  '/api/auth/signup-home(.*)',
]);

// ------------------------------------------------------------------
// Middleware
// ------------------------------------------------------------------
export default clerkMiddleware(async (auth, request: NextRequest) => {
  // 1. Public routes — no auth required
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // 2. Cron routes — secret header only
  if (isCronRoute(request)) {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 3. Authenticate
  await auth.protect();
  const { sessionClaims } = await auth();

  // Read role + homeId from JWT.
  // Primary:  sessionClaims.metadata  (set by custom JWT template in Clerk Dashboard)
  // Fallback: sessionClaims.publicMetadata (Clerk default — present when no custom template)
  const customMeta = (sessionClaims as Record<string, unknown>)?.metadata as
    | { role?: AppRole; homeId?: string }
    | undefined;
  const pubMeta = (sessionClaims as Record<string, unknown>)?.publicMetadata as
    | { role?: AppRole; homeId?: string }
    | undefined;

  // Support Clerk Organizations as a secondary fallback
  const orgId = (sessionClaims as Record<string, unknown>)?.org_id as string | null ?? null;
  const orgRole = (sessionClaims as Record<string, unknown>)?.org_role as string | null ?? null;

  let role: AppRole | null = customMeta?.role ?? pubMeta?.role ?? null;
  let homeId: string | null = customMeta?.homeId ?? pubMeta?.homeId ?? orgId ?? null;

  // Map Clerk org role → app role when no explicit role is set
  if (orgRole && !role) {
    if (orgRole === 'admin') role = 'home_manager';
    else if (orgRole === 'member') role = 'care_staff';
    else if (orgRole === 'guest') role = 'bank_staff';
  }

  // 4. Admin-only guard
  if (isAdminRoute(request) && role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 5. Manager-only guard
  if (isManagerRoute(request) && !['home_manager', 'unit_manager', 'system_admin'].includes(role ?? '')) {
    return NextResponse.json({ error: 'Forbidden - Manager access required' }, { status: 403 });
  }

  // 6. Tenant isolation validation
  const urlPath = request.nextUrl.pathname;
  const homeIdMatch = urlPath.match(/^\/homes\/([^/]+)/);
  if (homeIdMatch && homeId && homeIdMatch[1] !== homeId && role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden - Tenant mismatch' }, { status: 403 });
  }

  // 7. Inject role + homeId as headers for API handlers
  const requestHeaders = new Headers(request.headers);
  if (homeId) requestHeaders.set('x-home-id', homeId);
  if (role) requestHeaders.set('x-user-role', role);

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
