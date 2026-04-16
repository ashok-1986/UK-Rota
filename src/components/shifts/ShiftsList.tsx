'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { Shift } from '@/types'
import { formatTime } from '@/lib/utils'

interface ShiftsListProps {
  shifts: Shift[]
}

export function ShiftsList({ shifts }: ShiftsListProps) {
  return (
    <div className="space-y-3">
      {shifts.map(shift => (
        <ShiftCard key={shift.id} shift={shift} />
      ))}
    </div>
  )
}

function ShiftCard({ shift }: { shift: Shift }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const startTime = typeof shift.start_time === 'string' ? shift.start_time.slice(0, 5) : ''
  const endTime = typeof shift.end_time === 'string' ? shift.end_time.slice(0, 5) : ''

  async function toggleActive() {
    setLoading(true)
    try {
      const res = await fetch(`/api/shifts/${shift.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !shift.is_active }),
      })
      if (!res.ok) throw new Error('Failed to update shift')
      router.refresh()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
      <div className="flex items-center gap-4">
        <div
          className="w-4 h-12 rounded"
          style={{ backgroundColor: shift.color }}
        />
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{shift.name}</p>
            {shift.is_night && (
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">Night</span>
            )}
            {shift.is_weekend && (
              <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">Weekend</span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {startTime} – {endTime} ({shift.duration_hours}h)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded ${shift.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {shift.is_active ? 'Active' : 'Inactive'}
        </span>
        <Button size="sm" variant="secondary" loading={loading} onClick={toggleActive}>
          {shift.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </div>
  )
}