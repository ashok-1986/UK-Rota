import { redirect } from 'next/navigation'
import { getKindeAuth } from '@/lib/auth'
import LandingPage from '@/components/landing/LandingPage'

async function checkNeedsSetup(): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/setup/first-home`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    return data.needsSetup ?? false
  } catch {
    return false
  }
}

export default async function RootPage() {
  const kindeAuth = await getKindeAuth()

  if (!kindeAuth) {
    const needsSetup = await checkNeedsSetup()
    if (needsSetup) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to CareRota</h1>
            <p className="text-gray-600 mb-6">
              Let&apos;s set up your care home to get started.
            </p>
            <form action="/api/setup/first-home" method="POST">
              <input type="hidden" name="homeName" value="My Care Home" />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Create My Care Home
              </button>
            </form>
          </div>
        </div>
      )
    }
    return <LandingPage />
  }

  if (!kindeAuth.role || !kindeAuth.homeId) {
    redirect('/account-not-linked')
  }

  const { role, homeId } = kindeAuth

  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  now.setDate(now.getDate() + diff)
  const thisWeek = now.toISOString().slice(0, 10)

  if (role === 'system_admin') redirect('/dashboard')
  if (role === 'home_manager' || role === 'unit_manager') {
    redirect(`/dashboard/rota/${homeId}/${thisWeek}`)
  }
  redirect('/staff/rota')
}
