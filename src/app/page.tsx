import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { AppRole } from '@/types'
import LandingPage from '@/components/landing/LandingPage'
import sql from '@/lib/db'

async function checkNeedsSetup(): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/setup/first-home`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }
    })
    const data = await res.json()
    return data.needsSetup ?? false
  } catch {
    return false
  }
}

/**
 * If Clerk publicMetadata already has role+homeId, return it (no DB/API call needed).
 * Otherwise look up the staff record and sync it to Clerk.
 * Returns null only when no staff record exists at all.
 */
async function tryRepairMetadata(
  userId: string,
  existingClerkMeta: { role?: AppRole; homeId?: string } | undefined,
): Promise<{ role: AppRole; homeId: string } | null> {
  // Metadata already set on the Clerk user — JWT is just stale (propagation delay).
  // No repair needed; the user simply needs a fresh sign-in.
  if (existingClerkMeta?.role && existingClerkMeta?.homeId) {
    return { role: existingClerkMeta.role, homeId: existingClerkMeta.homeId }
  }

  try {
    const [staff] = await sql`
      SELECT role, home_id FROM staff
      WHERE clerk_user_id = ${userId} AND is_active = TRUE AND deleted_at IS NULL
      LIMIT 1
    `
    if (!staff) return null

    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { role: staff.role, homeId: staff.home_id },
    })
    return { role: staff.role as AppRole, homeId: staff.home_id as string }
  } catch {
    return null
  }
}

export default async function RootPage() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    return <LandingPage />
  }

  // Read from custom JWT template (sessionClaims.metadata) with fallback to
  // Clerk's default location (sessionClaims.publicMetadata) for when the
  // custom template is not configured in the Clerk Dashboard.
  const customMeta = (sessionClaims as Record<string, unknown>)?.metadata as
    | { role?: AppRole; homeId?: string }
    | undefined
  const pubMeta = (sessionClaims as Record<string, unknown>)?.publicMetadata as
    | { role?: AppRole; homeId?: string }
    | undefined

  let homeId = customMeta?.homeId ?? pubMeta?.homeId
  let role = customMeta?.role ?? pubMeta?.role

  // Build Monday of this week
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  now.setDate(now.getDate() + diff)
  const thisWeek = now.toISOString().slice(0, 10)

  if (!homeId || !role) {
    const clerkUser = await (await clerkClient()).users.getUser(userId)
    const clerkPubMeta = clerkUser.publicMetadata as { role?: AppRole; homeId?: string } | undefined

    const repaired = await tryRepairMetadata(userId, clerkPubMeta)

    if (repaired) {
      // Metadata exists on Clerk backend — JWT was just stale; fall through to role-based redirect
      role = repaired.role
      homeId = repaired.homeId
    } else {
      // No staff record exists for this user
      const needsSetup = await checkNeedsSetup()

      if (needsSetup) {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to CareRota</h1>
              <p className="text-gray-600 mb-6">
                It looks like this is your first time here. Let&apos;s set up your care home.
              </p>
              <form action="/api/setup/first-home" method="POST" className="space-y-4">
                <input type="hidden" name="homeName" value="My Care Home" />
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Create My Care Home
                </button>
              </form>
              <p className="text-sm text-gray-500 mt-4">
                This will create a home and link your account as manager.
              </p>
            </div>
          </div>
        )
      }

      redirect('/account-not-linked?reason=new')
    }
  }

  if (role === 'system_admin') {
    redirect('/dashboard')
  }

  if (role === 'home_manager') {
    redirect(`/dashboard/rota/${homeId}/${thisWeek}`)
  }

  redirect('/staff/rota')
}
