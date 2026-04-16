import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { RotaCalendar } from '@/components/rota/RotaCalendar'
import sql from '@/lib/db'
import type { AppRole, WeekView, Staff } from '@/types'

interface PageProps {
  params: Promise<{ homeId: string; unitId: string; week: string }>
}

async function getRotaData(homeId: string, week: string, unitId?: string): Promise<WeekView | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url = unitId 
    ? `${baseUrl}/api/rota/${homeId}/${week}?unitId=${unitId}`
    : `${baseUrl}/api/rota/${homeId}/${week}`
  const res = await fetch(url, { cache: 'no-store', credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

async function getStaffForUnit(homeId: string, unitId: string): Promise<Staff[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/staff?homeId=${homeId}&unitId=${unitId}`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return []
  return res.json()
}

export default async function UnitRotaPage({ params }: PageProps) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const { homeId, unitId, week } = await params

  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string; unitId?: string } | undefined

  const role = metadata?.role
  const userHomeId = metadata?.homeId
  const userUnitId = metadata?.unitId

  // Unit managers can only view their assigned unit's rota
  if (role !== 'unit_manager' && role !== 'home_manager' && role !== 'system_admin') {
    redirect('/dashboard')
  }

  if (role === 'unit_manager') {
    if (homeId !== userHomeId || unitId !== userUnitId) {
      redirect('/dashboard')
    }
  } else if (role !== 'system_admin' && homeId !== userHomeId) {
    redirect('/sign-in')
  }

  // Verify unit exists and belongs to home
  const [unit] = await sql`
    SELECT id, name FROM units WHERE id = ${unitId} AND home_id = ${homeId} LIMIT 1
  `
  if (!unit) notFound()

  const [weekView, staff] = await Promise.all([
    getRotaData(homeId, week, unitId),
    getStaffForUnit(homeId, unitId),
  ])

  if (!weekView) notFound()

  const isManager = role === 'unit_manager' || role === 'home_manager' || role === 'system_admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{unit.name} - Weekly Rota</h1>
        <p className="text-gray-500 text-sm mt-1">
          {isManager ? 'Manage shifts for this unit.' : 'View your scheduled shifts.'}
        </p>
      </div>

      <RotaCalendar
        weekView={weekView}
        staff={staff}
        homeId={homeId}
        weekStart={week}
        isManager={isManager}
        unitId={unitId}
      />
    </div>
  )
}