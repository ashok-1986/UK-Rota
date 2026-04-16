'use client'
import { useState } from 'react'
import { clsx } from 'clsx'
import { StatusBadge } from '@/components/ui/Badge'
import type { WeekViewCell, Staff } from '@/types'
import { formatTime, fullName } from '@/lib/utils'

interface ShiftCellProps {
  cell: WeekViewCell
  shiftDate: string
  availableStaff: Staff[]
  onAssign: (shiftId: string, shiftDate: string, staffId: string | null) => Promise<void>
  onCancel: (rotaShiftId: string) => Promise<void>
  isManager: boolean
}

export function ShiftCell({
  cell,
  shiftDate,
  availableStaff,
  onAssign,
  onCancel,
  isManager,
}: ShiftCellProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const { shift, rota_shift, staff } = cell
  const isAssigned = !!staff
  const isCancelled = rota_shift?.status === 'cancelled'

  async function handleSelect(staffId: string | null) {
    setLoading(true)
    try {
      await onAssign(shift.id, shiftDate, staffId)
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <div
      className={clsx(
        'relative min-h-[4.5rem] rounded-lg border p-2 text-xs transition-all',
        isCancelled
          ? 'border-gray-100 bg-gray-50 opacity-50'
          : isAssigned
          ? 'border-transparent'
          : 'border-dashed border-gray-300 bg-white',
        !isCancelled && isManager && 'cursor-pointer hover:ring-2 hover:ring-blue-400'
      )}
      style={isAssigned && !isCancelled ? { backgroundColor: shift.color + '22', borderColor: shift.color } : {}}
      onClick={() => isManager && !isCancelled && setOpen(true)}
    >
      {/* Shift time label */}
      <p className="font-medium text-gray-500 mb-1">
        {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
      </p>

      {rota_shift ? (
        <div className="space-y-1">
          {staff ? (
            <p className="font-semibold text-gray-900 leading-tight">{fullName(staff)}</p>
          ) : (
            <p className="text-amber-600 font-medium">Unfilled</p>
          )}
          <StatusBadge status={rota_shift.status} />
        </div>
      ) : (
        isManager && (
          <p className="text-gray-400 mt-1">+ Assign</p>
        )
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
          <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Staff picker dropdown */}
      {open && isManager && (
        <div
          className="absolute left-0 top-full mt-1 z-30 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>

          {rota_shift && (
            <button
              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 font-medium"
              onClick={() => {
                setOpen(false)
                onCancel(rota_shift.id)
              }}
            >
              Remove / Cancel shift
            </button>
          )}

          <hr className="my-1 border-gray-100" />
          <p className="px-3 py-1 text-xs text-gray-400 uppercase tracking-wide">Assign to</p>

          <button
            className="w-full text-left px-3 py-2 text-xs text-amber-700 hover:bg-amber-50"
            onClick={() => handleSelect(null)}
          >
            Leave unfilled (open slot)
          </button>

          {availableStaff.map(s => (
            <button
              key={s.id}
              className={clsx(
                'w-full text-left px-3 py-2 text-xs hover:bg-blue-50',
                rota_shift?.staff_id === s.id ? 'font-semibold text-blue-700 bg-blue-50' : 'text-gray-700'
              )}
              onClick={() => handleSelect(s.id)}
            >
              {fullName(s)}
              <span className="text-gray-400 ml-1">({s.role.replace('_', ' ')})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
