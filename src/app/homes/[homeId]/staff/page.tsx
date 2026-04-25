import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { StaffTable } from '@/components/staff/StaffTable'
import { PendingInvites } from '@/components/staff/PendingInvites'
import { StaffActions } from './StaffActions'
import sql from '@/lib/db'
import type { Staff } from '@/types'

// Direct DB query — replaces self-fetch that broke with Kinde auth
async function getStaff(homeId: string): Promise<Staff[]> {
  const rows = await sql`
    SELECT s.*, u.name AS unit_name
    FROM staff s
    LEFT JOIN units u ON u.id = s.unit_id
    WHERE s.home_id = ${homeId}
      AND s.deleted_at IS NULL
    ORDER BY s.last_name, s.first_name
  `
  return rows as unknown as Staff[]
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
        <StaffActions homeId={homeId} />
      </div>

      <PendingInvites />

      <StaffTable staff={staff} />
    </div>
  )
}
