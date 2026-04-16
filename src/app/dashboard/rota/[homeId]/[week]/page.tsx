import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { RotaCalendar } from '@/components/rota/RotaCalendar'
import type { AppRole, WeekView, Staff } from '@/types'

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

export default async function DashboardRotaPage({ params }: PageProps) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const { homeId, week } = await params

  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string } | undefined

  const role = metadata?.role
  const userHomeId = metadata?.homeId

  // Guard: managers can only view their own home's rota
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
    <RotaCalendar
      weekView={weekView}
      staff={staff}
      homeId={homeId}
      weekStart={week}
      isManager={isManager}
    />
  )
}
