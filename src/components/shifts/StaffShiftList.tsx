'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import type { RotaShiftDetailed } from '@/types'
import { formatShortDate, formatTime } from '@/lib/utils'
import { clsx } from 'clsx'

interface StaffShiftListProps {
  shifts: RotaShiftDetailed[]
}

export function StaffShiftList({ shifts }: StaffShiftListProps) {
  const router = useRouter()

  if (shifts.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <svg className="mx-auto w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="font-medium">No upcoming shifts</p>
        <p className="text-sm mt-1">Your published shifts will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {shifts.map(shift => (
        <ShiftCard key={shift.id} shift={shift} onRefresh={() => router.refresh()} />
      ))}
    </div>
  )
}

function ShiftCard({ shift, onRefresh }: { shift: RotaShiftDetailed; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false)

  const isConfirmable = shift.status === 'published'
  const isPast = new Date(shift.shift_date) < new Date(new Date().toDateString())

  async function confirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/rota/shifts/${shift.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Failed to confirm shift')
        return
      }
      onRefresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={clsx(
        'flex items-center justify-between p-4 bg-white rounded-xl border shadow-sm',
        isPast ? 'opacity-60' : 'border-gray-200'
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: shift.shift.color }}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900">{shift.shift.name}</p>
          <StatusBadge status={shift.status} />
        </div>
        <p className="text-sm text-gray-600">
          {formatShortDate(shift.shift_date)} &middot; {formatTime(shift.shift.start_time)}–{formatTime(shift.shift.end_time)}
        </p>
        {shift.notes && (
          <p className="text-xs text-gray-500 mt-1">{shift.notes}</p>
        )}
      </div>

      {isConfirmable && !isPast && (
        <Button size="sm" variant="primary" loading={loading} onClick={confirm}>
          Confirm
        </Button>
      )}
      {shift.status === 'confirmed' && (
        <span className="text-green-600 text-sm font-medium">Confirmed</span>
      )}
    </div>
  )
}
