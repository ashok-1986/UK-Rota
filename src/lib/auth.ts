// Central Kinde auth helper for CareRota.
// Server components and API routes use these — never call getKindeServerSession() directly.
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import type { AppRole } from '@/types'

export interface AuthSession {
  userId: string
  role: AppRole | null
  homeId: string | null
  isAuthenticated: boolean
}

export async function getSession(): Promise<AuthSession> {
  const { getUser, isAuthenticated, getIdToken } = getKindeServerSession()

  const authenticated = await isAuthenticated()
  if (!authenticated) {
    return { userId: '', role: null, homeId: null, isAuthenticated: false }
  }

  const user = await getUser()

  // Use getIdToken() instead of getAccessToken() — reads from cookie directly
  // without making a network call to Kinde's token endpoint
  const idToken = await getIdToken() as Record<string, unknown> | null

  // Kinde stores custom properties under user_properties.{key}.v
  const userProps = idToken?.user_properties as
    Record<string, { v: string }> | undefined

  let role = (userProps?.role?.v ?? null) as AppRole | null
  let homeId = userProps?.homeid?.v ?? null

  // Fallback: read directly from known token claims
  if (!role) {
    role = (idToken?.role as AppRole) ?? null
  }
  if (!homeId) {
    homeId = (idToken?.homeid as string) ?? null
  }

  return {
    userId: user?.id ?? '',
    role,
    homeId,
    isAuthenticated: true,
  }
}

export async function requireAuth(): Promise<AuthSession> {
  const session = await getSession()
  if (!session.isAuthenticated || !session.userId) {
    throw new Error('UNAUTHORIZED')
  }
  return session
}

export async function requireRole(
  allowed: AppRole | AppRole[]
): Promise<AuthSession> {
  const session = await requireAuth()
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed]
  if (!session.role || !allowedRoles.includes(session.role)) {
    throw new Error('FORBIDDEN')
  }
  return session
}

/**
 * Read auth from headers injected by middleware.
 * Faster than calling getSession() — use this in API routes.
 */
export function getSessionFromHeaders(headers: Headers): {
  userId: string | null
  homeId: string | null
  role: AppRole | null
} {
  return {
    userId: headers.get('x-user-id'),
    homeId: headers.get('x-home-id'),
    role: headers.get('x-user-role') as AppRole | null,
  }
}

export function authError(type: 'UNAUTHORIZED' | 'FORBIDDEN') {
  const status = type === 'UNAUTHORIZED' ? 401 : 403
  const error = type === 'UNAUTHORIZED' ? 'Unauthorized' : 'Forbidden'
  return Response.json({ error }, { status })
}
