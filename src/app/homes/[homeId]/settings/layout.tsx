import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Link from 'next/link'

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ homeId: string }>
}) {
  const session = await getSession()
  if (!session.isAuthenticated) redirect('/sign-in')

  const { homeId: routeHomeId } = await params
  const { role, homeId: userHomeId } = session

  if (!['home_manager', 'unit_manager', 'system_admin'].includes(role ?? '')) {
    redirect('/dashboard')
  }

  if (role === 'unit_manager' && routeHomeId !== userHomeId) {
    redirect('/dashboard')
  }

  const isManager = role === 'home_manager' || role === 'system_admin'

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Home Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your home&apos;s configuration, rules, and templates.
        </p>
      </div>

      {isManager && (
        <nav className="flex gap-2 border-b border-gray-200 pb-2">
          <Link
            href={`/homes/${routeHomeId}/settings/home`}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Home
          </Link>
          <Link
            href={`/homes/${routeHomeId}/settings/rules`}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Rules
          </Link>
          <Link
            href={`/homes/${routeHomeId}/settings/shifts`}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Shifts
          </Link>
          <Link
            href={`/homes/${routeHomeId}/settings/units`}
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
