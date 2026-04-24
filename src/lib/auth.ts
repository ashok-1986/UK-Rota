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
    const payload = parts[1]
    // Add padding if needed
    const padded = payload + '=='.slice(0, (4 - payload.length % 4) % 4)
    const decoded = Buffer.from(padded, 'base64').toString('utf-8')
    return JSON.parse(decoded) as KindeTokenPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<AuthSession> {
  const { getUser, isAuthenticated, getAccessTokenRaw } = getKindeServerSession()

  const authenticated = await isAuthenticated()
  if (!authenticated) {
    return { userId: '', role: null, homeId: null, isAuthenticated: false }
  }

  const user = await getUser()

  // getAccessTokenRaw() reads JWT string from cookie — no network call
  const rawToken = await getAccessTokenRaw()

  if (!rawToken) {
    return { userId: user?.id ?? '', role: null, homeId: null, isAuthenticated: true }
  }

  const payload = decodeJwtPayload(rawToken)
  const userProps = payload?.user_properties

  const role = (userProps?.role?.v ?? null) as AppRole | null
  const homeId = userProps?.homeid?.v ?? null

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
