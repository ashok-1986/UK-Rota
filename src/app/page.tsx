import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { AppRole } from '@/types'

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
    // Check if any home exists in the system
    const needsSetup = await checkNeedsSetup()
    
    if (needsSetup) {
      // First time setup - show option to create home
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to CareRota</h1>
            <p className="text-gray-600 mb-6">
              It looks like this is your first time here. Let's set up your care home.
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

    // Home exists but user not linked
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Not Linked</h1>
          <p className="text-gray-600 mb-6">
            Your account is not linked to a care home. Please contact your administrator.
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
