import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { AppRole } from '@/types'

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ homeId: string }>
}) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const { homeId } = await params
  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string } | undefined

  const role = metadata?.role
  const userHomeId = metadata?.homeId

  if (!['home_manager', 'unit_manager', 'system_admin'].includes(role ?? '')) {
    redirect('/dashboard')
  }

  // Unit managers can only access settings for their assigned unit's home
  if (role === 'unit_manager' && homeId !== userHomeId) {
    redirect('/dashboard')
  }

  const isManager = role === 'home_manager' || role === 'system_admin'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Home Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your home's configuration, rules, and templates.
        </p>
      </div>

      {isManager && (
        <nav className="flex gap-2 border-b border-gray-200 pb-2">
          <Link
            href={`/homes/${homeId}/settings/home`}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Home
          </Link>
          <Link
            href={`/homes/${homeId}/settings/rules`}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Rules
          </Link>
          <Link
            href={`/homes/${homeId}/settings/shifts`}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Shifts
          </Link>
          <Link
            href={`/homes/${homeId}/settings/units`}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Units
          </Link>
        </nav>
      )}

      {children}
    </div>
  )
}