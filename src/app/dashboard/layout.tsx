import { getSession } from '@/lib/auth'
import { LogoutLink } from '@kinde-oss/kinde-auth-nextjs/components'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { AppRole } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session.isAuthenticated || !session.userId) {
    redirect('/sign-in')
  }

  const { role, homeId } = session

  if (!role || !homeId) {
    redirect('/account-not-linked?reason=claims-pending')
  }

  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  now.setDate(now.getDate() + diff)
  const thisWeek = now.toISOString().slice(0, 10)

  const roleLabel =
    role === 'system_admin' ? 'Admin'
    : role === 'home_manager' ? 'Manager'
    : role === 'unit_manager' ? 'Unit Manager'
    : 'Staff'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold text-blue-900">CareRota</Link>

              <nav className="hidden md:flex items-center gap-6">
                <NavLink href={`/dashboard/rota/${homeId}/${thisWeek}`} active={true}>
                  Rota
                </NavLink>
                <NavLink href={`/homes/${homeId}/staff`}>Staff</NavLink>
                <NavLink href={`/homes/${homeId}/settings/rules`}>Settings</NavLink>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500 hidden sm:block">{roleLabel}</span>
              <LogoutLink className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Sign out
              </LogoutLink>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, children, active }: {
  href: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`text-sm font-medium transition-colors ${
        active
          ? 'text-blue-700 border-b-2 border-blue-700 pb-1'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </Link>
  )
}
