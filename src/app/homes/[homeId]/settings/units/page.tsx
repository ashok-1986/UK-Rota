import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { UnitForm } from '@/components/units/UnitForm'
import { UnitsList } from '@/components/units/UnitsList'
import type { Unit } from '@/types'

interface PageProps {
  params: Promise<{ homeId: string }>
}

async function getUnits(homeId: string): Promise<Unit[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/units?homeId=${homeId}`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return []
  return res.json()
}

export default async function UnitsPage({ params }: PageProps) {
  const session = await getSession()
  if (!session.isAuthenticated) redirect('/sign-in')

  const { homeId } = await params
  const { role } = session

  if (!['home_manager', 'system_admin'].includes(role ?? '')) {
    redirect('/dashboard')
  }

  const units = await getUnits(homeId)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Units/Wards</h1>
        <p className="text-gray-500 text-sm mt-1">
          Create and manage units (wards, floors, departments) within your care home.
          Staff can be assigned to specific units.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Unit</h2>
        <UnitForm homeId={homeId} />
      </div>

      {units.length === 0 ? (
        <p className="text-gray-500">No units yet. Add your first unit above.</p>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Existing Units</h2>
          <UnitsList units={units} />
        </div>
      )}
    </div>
  )
}
