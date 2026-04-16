// =============================================================
// Clerk server-side auth helpers
// =============================================================
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { AppRole } from '@/types'

/**
 * Asserts the current user has one of the given roles.
 * Redirects to /sign-in if not authenticated.
 * Returns the matched role.
 */
export async function requireRole(...roles: AppRole[]): Promise<AppRole> {
  const { sessionClaims } = await auth()
  const role = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole } | undefined

  if (!role?.role) {
    redirect('/sign-in')
  }
  if (!roles.includes(role.role)) {
    redirect('/sign-in')
  }
  return role.role
}

/**
 * Returns the homeId stored in the session claims.
 * Throws if missing (should not happen for authenticated users).
 */
export async function getHomeId(): Promise<string> {
  const { sessionClaims } = await auth()
  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { homeId?: string } | undefined

  if (!metadata?.homeId) {
    throw new Error('No homeId in session claims — is the Clerk JWT template configured?')
  }
  return metadata.homeId
}

/**
 * Returns both role and homeId from session claims.
 */
export async function getSessionContext(): Promise<{ role: AppRole; homeId: string }> {
  const { sessionClaims } = await auth()
  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string } | undefined

  if (!metadata?.role || !metadata?.homeId) {
    redirect('/sign-in')
  }
  return { role: metadata.role, homeId: metadata.homeId }
}

/**
 * Reads the x-home-id header injected by middleware.
 * Use this in API routes to avoid re-fetching session claims.
 */
export function getHomeIdFromHeaders(headers: Headers): string {
  const homeId = headers.get('x-home-id')
  if (!homeId) throw new Error('Missing x-home-id header — check middleware configuration')
  return homeId
}

/**
 * Reads the x-user-role header injected by middleware.
 */
export function getRoleFromHeaders(headers: Headers): AppRole {
  const role = headers.get('x-user-role') as AppRole | null
  if (!role) throw new Error('Missing x-user-role header — check middleware configuration')
  return role
}
