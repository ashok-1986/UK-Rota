// =============================================================
// CareRota — Kinde auth helpers (server-only)
// Never call getKindeServerSession() directly outside this file.
// =============================================================
import 'server-only'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { redirect } from 'next/navigation'
import type { AppRole } from '@/types'

// ------------------------------------------------------------------
// Internal: decode access token without network call
// ------------------------------------------------------------------

interface KindeTokenPayload {
  sub?: string
  user_properties?: Record<string, { v: string }>
  org_code?: string
  exp?: number
}

function decodeJwtPayload(token: string): KindeTokenPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // base64url decode — handle padding
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
  } catch {
    return null
  }
}

// ------------------------------------------------------------------
// 1. getKindeAuth()
// ------------------------------------------------------------------
// Decodes the Kinde access token manually (no network call).
// Returns null if not authenticated or properties are missing.
// user_properties are at payload.user_properties.role.v and
// payload.user_properties.homeid.v (Kinde forces keys lowercase)

export async function getKindeAuth(): Promise<{
  kindeUserId: string
  role: AppRole
  homeId: string
} | null> {
  const { getUser, isAuthenticated, getAccessTokenRaw } = getKindeServerSession()

  const authenticated = await isAuthenticated()
  if (!authenticated) return null

  const user = await getUser()
  if (!user?.id) return null

  try {
    const rawToken = await getAccessTokenRaw()
    if (!rawToken) return null

    const payload = decodeJwtPayload(rawToken)

    const role = payload?.user_properties?.role?.v as AppRole | undefined
    const homeId = payload?.user_properties?.homeid?.v as string | undefined

    if (!role || !homeId) return null

    return { kindeUserId: user.id, role, homeId }
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
): Promise<{ role: AppRole; homeId: string; kindeUserId: string }> {
  const auth = await getKindeAuth()
  if (!auth) redirect('/api/auth/kinde/login')
  if (!roles.includes(auth.role)) redirect('/')
  return auth
}

// ------------------------------------------------------------------
// 3. getSessionContext()
// ------------------------------------------------------------------
// Convenience wrapper — redirects if not authenticated.

export async function getSessionContext(): Promise<{ role: AppRole; homeId: string }> {
  const auth = await getKindeAuth()
  if (!auth) redirect('/api/auth/kinde/login')
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
export async function getSessionFromHeaders(headers: Headers): Promise<{
  userId: string | null
  homeId: string | null
  role: AppRole | null
}> {
  // Middleware now injects these headers properly again!
  const homeId = headers.get('x-home-id')
  const role = headers.get('x-user-role') as AppRole | null
  const userId = headers.get('x-user-id')

  if (homeId && role) {
    return { userId, homeId, role }
  }

  // Fall back to decoding the Kinde JWT directly if not present (e.g. bypass)
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
