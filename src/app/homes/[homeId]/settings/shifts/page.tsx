import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { ShiftForm } from '@/components/shifts/ShiftForm'
import { ShiftsList } from '@/components/shifts/ShiftsList'
import type { Shift } from '@/types'

interface PageProps {
  params: Promise<{ homeId: string }>
}

async function getShifts(homeId: string): Promise<Shift[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/shifts?homeId=${homeId}`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return []
  return res.json()
}

export default async function ShiftsPage({ params }: PageProps) {
  const session = await getSession()
  if (!session.isAuthenticated) redirect('/sign-in')

  const { homeId } = await params
  const { role } = session

  if (!['home_manager', 'system_admin'].includes(role ?? '')) {
    redirect('/dashboard')
  }

  const shifts = await getShifts(homeId)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shift Templates</h1>
        <p className="text-gray-500 text-sm mt-1">
          Define the standard shifts for your home (e.g., Early, Late, Night).
          These are used when building the weekly rota.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Shift</h2>
        <ShiftForm homeId={homeId} />
      </div>

      {shifts.length === 0 ? (
        <p className="text-gray-500">No shift templates yet. Add your first shift above.</p>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Existing Shifts</h2>
          <ShiftsList shifts={shifts} />
        </div>
      )}
    </div>
  )
}
