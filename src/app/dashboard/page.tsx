import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import type { AppRole } from '@/types'

interface DashboardStats {
  staff: {
    active: number
    managers: number
    careStaff: number
    bankStaff: number
  }
  shifts: {
    total: number
    draft: number
    published: number
    confirmed: number
    unfilled: number
  }
  upcoming: {
    total: number
    unfilled: number
  }
  gaps: { date: string; shift_name: string; start_time: string }[]
  rules: Record<string, string>
}

async function getStats(homeId: string): Promise<DashboardStats | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/dashboard/stats`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return null
  return res.json()
}

export default async function DashboardPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string } | undefined

  const role = metadata?.role
  const homeId = metadata?.homeId

  if (!homeId || !role) {
    redirect('/')
  }

  // Only managers see dashboard
  if (role === 'care_staff' || role === 'bank_staff') {
    redirect('/staff/rota')
  }

  const stats = await getStats(homeId)

  // Get current week
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  now.setDate(now.getDate() + diff)
  const thisWeek = now.toISOString().slice(0, 10)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">CareRota</h1>
            <nav className="hidden md:flex gap-2 ml-6">
              <Link href={`/dashboard/rota/${homeId}/${thisWeek}`} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                Rota
              </Link>
              <Link href={`/homes/${homeId}/staff`} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                Staff
              </Link>
              <Link href={`/homes/${homeId}/settings/home`} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                Settings
              </Link>
              <Link href="/swaps" className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">
                Swaps
              </Link>
            </nav>
          </div>
          <UserButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

        {stats && (
          <div className="space-y-6">
            {/* Staff Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Total Staff</p>
                <p className="text-3xl font-bold text-gray-900">{stats.staff.active}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Care Staff</p>
                <p className="text-3xl font-bold text-blue-600">{stats.staff.careStaff}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Bank Staff</p>
                <p className="text-3xl font-bold text-purple-600">{stats.staff.bankStaff}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Managers</p>
                <p className="text-3xl font-bold text-green-600">{stats.staff.managers}</p>
              </div>
            </div>

            {/* This Week */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">This Week's Shifts</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total</span>
                    <span className="font-semibold">{stats.shifts.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Draft</span>
                    <span className="font-semibold text-yellow-600">{stats.shifts.draft}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Published</span>
                    <span className="font-semibold text-blue-600">{stats.shifts.published}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confirmed</span>
                    <span className="font-semibold text-green-600">{stats.shifts.confirmed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unfilled</span>
                    <span className="font-semibold text-red-600">{stats.shifts.unfilled}</span>
                  </div>
                </div>
                <Link 
                  href={`/dashboard/rota/${homeId}/${thisWeek}`}
                  className="mt-4 block text-center text-blue-600 hover:text-blue-700 text-sm"
                >
                  View Rota →
                </Link>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming (Next 7 Days)</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Shifts</span>
                    <span className="font-semibold">{stats.upcoming.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Unfilled</span>
                    <span className="font-semibold text-red-600">{stats.upcoming.unfilled}</span>
                  </div>
                </div>

                {stats.gaps && stats.gaps.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Gaps This Week</h4>
                    <div className="space-y-1">
                      {stats.gaps.slice(0, 3).map((gap, i) => (
                        <div key={i} className="text-xs text-red-600">
                          {gap.date}: {gap.shift_name} @ {gap.start_time?.slice(0,5)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href={`/homes/${homeId}/settings/shifts`} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition">
                <p className="font-medium text-gray-900">Shift Templates</p>
                <p className="text-sm text-gray-500">Manage shift types</p>
              </Link>
              <Link href={`/homes/${homeId}/settings/units`} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition">
                <p className="font-medium text-gray-900">Units</p>
                <p className="text-sm text-gray-500">Manage wards</p>
              </Link>
              <Link href={`/homes/${homeId}/settings/rules`} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition">
                <p className="font-medium text-gray-900">Rules</p>
                <p className="text-sm text-gray-500">WTR settings</p>
              </Link>
              <Link href={`/homes/${homeId}/staff`} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition">
                <p className="font-medium text-gray-900">Add Staff</p>
                <p className="text-sm text-gray-500">Invite new staff</p>
              </Link>
            </div>
          </div>
        )}

        {!stats && (
          <div className="text-center py-12 text-gray-500">
            Unable to load dashboard. Please try again.
          </div>
        )}
      </main>
    </div>
  )
}