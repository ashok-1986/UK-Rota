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
// =============================================================
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { AppRole } from '@/types';

// ------------------------------------------------------------------
// Route matchers
// ------------------------------------------------------------------
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
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
  // 1. Public routes
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // 2. Cron routes
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

  // Load tenant ID and role from metadata (in a real app, this comes from the custom JWT template)
  const metadata = (sessionClaims as any)?.metadata as { role?: AppRole; homeId?: string } | undefined;
  
  // Fallback: if role is missing, default to care_staff (will be restricted to their own view)
  // If homeId is missing, user won't have access to tenant-scoped routes until assigned to a home
  const role = metadata?.role ?? null;
  const homeId = metadata?.homeId ?? null;

  // 4. Admin-only guard
  if (isAdminRoute(request) && role !== 'system_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 5. Manager-only guard
  if (isManagerRoute(request) && !['home_manager', 'unit_manager', 'system_admin'].includes(role ?? '')) {
    return NextResponse.json({ error: 'Forbidden - Manager access required' }, { status: 403 });
  }

  // 6. Tenant isolation validation
  // If the URL contains a homeId, check if it matches the user's tenant
  const urlPath = request.nextUrl.pathname;
  const homeIdMatch = urlPath.match(/^\/homes\/([^/]+)/);
  if (homeIdMatch && homeIdMatch[1] !== homeId && role !== 'system_admin') {
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
