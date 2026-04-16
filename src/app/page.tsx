import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { AppRole } from '@/types'

export default async function RootPage() {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string } | undefined

  const homeId = metadata?.homeId
  const role = metadata?.role

  // Build Monday of this week
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  now.setDate(now.getDate() + diff)
  const thisWeek = now.toISOString().slice(0, 10)

  // Check if user has role and homeId set up
  if (!homeId || !role) {
    // Show setup needed page
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Setup Required</h1>
          <p className="text-gray-600 mb-6">
            Your account is not linked to a care home yet. Please contact your administrator to set up your account.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Or create a new home via the API: POST /api/auth/signup-home
          </p>
          <Link href="/sign-in" className="text-blue-600 hover:underline">
            Sign out and try another account
          </Link>
        </div>
      </div>
    )
  }

  if (role === 'home_manager' || role === 'system_admin') {
    redirect(`/dashboard/rota/${homeId}/${thisWeek}`)
  }

  // Staff land on their shift view
  redirect('/staff/rota')
}
