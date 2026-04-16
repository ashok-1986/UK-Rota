'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { Unit } from '@/types'

interface UnitsListProps {
  units: Unit[]
}

export function UnitsList({ units }: UnitsListProps) {
  return (
    <div className="space-y-3">
      {units.map(unit => (
        <UnitCard key={unit.id} unit={unit} />
      ))}
    </div>
  )
}

function UnitCard({ unit }: { unit: Unit }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deleteUnit() {
    if (!confirm('Are you sure you want to delete this unit?')) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/units/${unit.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete unit')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
      <div>
        <p className="font-semibold text-gray-900">{unit.name}</p>
        <p className="text-sm text-gray-500">
          Max staff: {unit.max_staff > 0 ? unit.max_staff : 'No limit'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {error && <p className="text-sm text-red-600 mr-2">{error}</p>}
        <Button size="sm" variant="ghost" onClick={deleteUnit} loading={loading}>
          Delete
        </Button>
      </div>
    </div>
  )
}