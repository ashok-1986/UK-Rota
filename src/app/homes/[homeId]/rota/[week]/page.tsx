import { redirect, notFound } from 'next/navigation'
import { getKindeAuth } from '@/lib/auth'
import { RotaCalendar } from '@/components/rota/RotaCalendar'
import type { WeekView, Staff } from '@/types'

interface PageProps {
  params: Promise<{ homeId: string; week: string }>
}

async function getRotaData(homeId: string, week: string): Promise<WeekView | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/rota/${homeId}/${week}`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return null
  return res.json()
}

async function getStaff(homeId: string): Promise<Staff[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/staff?homeId=${homeId}`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return []
  return res.json()
}

export default async function RotaPage({ params }: PageProps) {
  const auth = await getKindeAuth()
  if (!auth) redirect('/sign-in')

  const { homeId, week } = await params
  const { role, homeId: userHomeId } = auth

  if (role !== 'system_admin' && homeId !== userHomeId) {
    redirect('/sign-in')
  }

  const isManager = role === 'home_manager' || role === 'system_admin'

  const [weekView, staff] = await Promise.all([
    getRotaData(homeId, week),
    isManager ? getStaff(homeId) : Promise.resolve([]),
  ])

  if (!weekView) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Weekly Rota</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isManager ? 'Assign and publish shifts for your team.' : 'View your scheduled shifts.'}
        </p>
      </div>

      <RotaCalendar
        weekView={weekView}
        staff={staff}
        homeId={homeId}
        weekStart={week}
        isManager={isManager}
      />
    </div>
  )
}
