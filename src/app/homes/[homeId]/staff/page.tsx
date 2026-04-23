import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { StaffTable } from '@/components/staff/StaffTable'
import { AddStaffButton } from './AddStaffButton'
import type { Staff } from '@/types'

async function getStaff(homeId: string): Promise<Staff[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/staff?homeId=${homeId}`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return []
  return res.json()
}

export default async function StaffPage() {
  const session = await getSession()
  if (!session.isAuthenticated) redirect('/sign-in')

  const { role, homeId } = session

  if (!['home_manager', 'system_admin'].includes(role ?? '')) {
    redirect('/dashboard')
  }
  if (!homeId) redirect('/sign-in')

  const staff = await getStaff(homeId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage staff members for your care home.
          </p>
        </div>
        <AddStaffButton homeId={homeId} />
      </div>

      <StaffTable staff={staff} />
    </div>
  )
}
