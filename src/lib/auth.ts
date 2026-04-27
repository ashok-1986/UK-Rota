// =============================================================
// CareRota — Kinde auth helpers (server-only)
// Never call getKindeServerSession() directly outside this file.
// =============================================================
import 'server-only'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { redirect } from 'next/navigation'
import type { AppRole } from '@/types'
import sql from '@/lib/db'

// ------------------------------------------------------------------
// Internal: decode access token without network call
// ------------------------------------------------------------------

interface KindeTokenPayload {
  sub?: string
  org_code?: string
  org_roles?: { key: string; name?: string }[]
  exp?: number
}

// ------------------------------------------------------------------
// 1. getKindeAuth()

export async function getKindeAuth(): Promise<{
  kindeUserId: string
  role: AppRole
  homeId: string
  orgCode: string
} | null> {
  const { getUser, isAuthenticated, getAccessTokenRaw } = getKindeServerSession()

  const authenticated = await isAuthenticated()
  if (!authenticated) return null

  const user = await getUser()
  if (!user?.id) return null

  try {
    const rawToken = await getAccessTokenRaw()
    if (!rawToken) return null

    const parts = rawToken.split('.')
    if (parts.length !== 3) return null

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const payload = JSON.parse(
      Buffer.from(padded, 'base64').toString('utf-8')
    ) as KindeTokenPayload

    // Standard Kinde org claims
    const orgCode = payload?.org_code
    const orgRole = payload?.org_roles?.[0]?.key  // 'admin' | 'member' — sanity check only

    if (!orgCode) {
      console.warn('[auth] No org_code in token for user:', user.id)
      return null
    }

    // Sanity: token must be org-scoped
    if (orgRole !== 'admin' && orgRole !== 'member') {
      console.warn('[auth] Unexpected org_role in token:', orgRole, 'for user:', user.id)
      return null
    }

    // Resolve home + exact AppRole from DB (staff record is source of truth)
    const [home] = await sql`
      SELECT id FROM homes WHERE kinde_org_code = ${orgCode} LIMIT 1
    `
    if (!home) {
      console.warn('[auth] No home found for org_code:', orgCode)
      return null
    }
    const homeId = home.id as string

    const [staffRow] = await sql`
      SELECT role FROM staff
      WHERE kinde_user_id = ${user.id}
        AND home_id = ${homeId}
        AND deleted_at IS NULL
      LIMIT 1
    `
    if (!staffRow) {
      console.warn('[auth] No staff record for user:', user.id, 'home:', homeId)
      return null
    }

    return { kindeUserId: user.id, role: staffRow.role as AppRole, homeId, orgCode }
  } catch (err) {
    console.error('[auth] Token decode failed:', err)
    return null
  }
}

// ------------------------------------------------------------------
// 2. requireRole()
// ------------------------------------------------------------------
// Use in server components. Redirects if not authenticated or wrong role.

export async function requireRole(
  ...roles: AppRole[]
): Promise<{ role: AppRole; homeId: string; kindeUserId: string; orgCode: string }> {
  const auth = await getKindeAuth()
  if (!auth) {
    const { isAuthenticated } = getKindeServerSession()
    if (await isAuthenticated()) {
      redirect('/account-not-linked')
    }
    redirect('/api/auth/kinde/login')
  }
  if (!roles.includes(auth.role)) redirect('/')
  return auth
}

// ------------------------------------------------------------------
// 3. getSessionContext()
// ------------------------------------------------------------------
// Convenience wrapper — redirects if not authenticated.

export async function getSessionContext(): Promise<{ role: AppRole; homeId: string }> {
  const auth = await getKindeAuth()
  if (!auth) {
    const { isAuthenticated } = getKindeServerSession()
    if (await isAuthenticated()) {
      redirect('/account-not-linked')
    }
    redirect('/api/auth/kinde/login')
  }
  return { role: auth.role, homeId: auth.homeId }
}

// ------------------------------------------------------------------
// 4. Header helpers (used by API routes reading middleware-injected headers)
// ------------------------------------------------------------------

export function getHomeIdFromHeaders(headers: Headers): string {
  const homeId = headers.get('x-home-id')
  if (!homeId) throw new Error('Missing x-home-id header')
  return homeId
}

export function getRoleFromHeaders(headers: Headers): AppRole {
  const role = headers.get('x-user-role') as AppRole | null
  if (!role) throw new Error('Missing x-user-role header')
  return role
}

// ------------------------------------------------------------------
// 5. Backward-compatible aliases
//    Used by 25+ API routes and 14+ page components.
//    Will be removed in Phase 3 cleanup.
// ------------------------------------------------------------------

/** @deprecated Use getKindeAuth() instead */
export interface AuthSession {
  userId: string
  role: AppRole | null
  homeId: string | null
  isAuthenticated: boolean
}

/** @deprecated Use getKindeAuth() instead */
export async function getSession(): Promise<AuthSession> {
  const auth = await getKindeAuth()
  if (!auth) {
    // Try to check if at least authenticated (even without properties)
    const { isAuthenticated, getUser } = getKindeServerSession()
    const authed = await isAuthenticated()
    if (!authed) {
      return { userId: '', role: null, homeId: null, isAuthenticated: false }
    }
    const user = await getUser()
    return { userId: user?.id ?? '', role: null, homeId: null, isAuthenticated: true }
  }
  return {
    userId: auth.kindeUserId,
    role: auth.role,
    homeId: auth.homeId,
    isAuthenticated: true,
  }
}

/** @deprecated Use getKindeAuth() directly instead */
export async function getSessionFromHeaders(_headers: Headers): Promise<{
  userId: string | null
  homeId: string | null
  role: AppRole | null
}> {
  // Middleware no longer injects x-user-id / x-home-id / x-user-role.
  // Fall back to decoding the Kinde JWT directly.
  const auth = await getKindeAuth()
  if (!auth) {
    return { userId: null, homeId: null, role: null }
  }
  return {
    userId: auth.kindeUserId,
    homeId: auth.homeId,
    role: auth.role,
  }
}

/** @deprecated Kept for API route compatibility */
export function authError(type: 'UNAUTHORIZED' | 'FORBIDDEN') {
  const status = type === 'UNAUTHORIZED' ? 401 : 403
  const error = type === 'UNAUTHORIZED' ? 'Unauthorized' : 'Forbidden'
  return Response.json({ error }, { status })
}
