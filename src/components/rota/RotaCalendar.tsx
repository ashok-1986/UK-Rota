'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ShiftCell } from './ShiftCell'
import { PublishButton } from './PublishButton'
import { WeekNavigator } from './WeekNavigator'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { WeekView, Staff, RulesViolation } from '@/types'
import { formatShortDate } from '@/lib/utils'

interface RotaCalendarProps {
  weekView: WeekView
  staff: Staff[]
  homeId: string
  weekStart: string
  isManager: boolean
  unitId?: string
}

export function RotaCalendar({
  weekView,
  staff,
  homeId,
  weekStart,
  isManager,
  unitId,
}: RotaCalendarProps) {
  const router = useRouter()
  const [violationsModal, setViolationsModal] = useState<{
    violations: RulesViolation[]
    shiftId: string
    shiftDate: string
    staffId: string | null
  } | null>(null)

  const days = Object.keys(weekView.days).sort()

  // Count draft shifts for publish button
  const draftCount = days.reduce((acc, day) => {
    return acc + weekView.days[day].filter(c => c.rota_shift?.status === 'draft').length
  }, 0)

  const assign = useCallback(
    async (shiftId: string, shiftDate: string, staffId: string | null, override = false) => {
      const res = await fetch('/api/rota/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId, shiftDate, staffId, homeId, override }),
      })
      const data = await res.json()

      if (res.status === 422 && data.violations) {
        // Show rules violation modal
        setViolationsModal({ violations: data.violations, shiftId, shiftDate, staffId })
        return
      }
      if (!res.ok) {
        alert(data.error ?? 'Failed to assign shift')
        return
      }
      router.refresh()
    },
    [homeId, router]
  )

  const cancelShift = useCallback(
    async (rotaShiftId: string) => {
      const res = await fetch(`/api/rota/shifts/${rotaShiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Failed to cancel shift')
        return
      }
      router.refresh()
    },
    [router]
  )

  // All unique shift templates (rows of the grid)
  const shiftTemplates = days[0]
    ? weekView.days[days[0]].map(c => c.shift)
    : []

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <WeekNavigator homeId={homeId} weekStart={weekStart} />
        {isManager && (
          <div className="flex items-center gap-2">
            <a
              href={`/api/reports/weekly-pdf?homeId=${homeId}&week=${weekStart}`}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Export PDF
            </a>
            <span className="text-gray-300">|</span>
            <a
              href={`/api/reports/hours-csv?homeId=${homeId}&week=${weekStart}`}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Export CSV
            </a>
            <PublishButton
              homeId={homeId}
              weekStart={weekStart}
              draftCount={draftCount}
              onPublished={() => router.refresh()}
            />
          </div>
        )}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                Shift
              </th>
              {days.map(day => (
                <th
                  key={day}
                  className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]"
                >
                  {formatShortDate(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {shiftTemplates.map(shiftTemplate => (
              <tr key={shiftTemplate.id} className="divide-x divide-gray-100">
                {/* Row header */}
                <td className="px-3 py-3 align-top">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: shiftTemplate.color }}
                    />
                    <span className="text-sm font-semibold text-gray-800">{shiftTemplate.name}</span>
                  </div>
                </td>

                {/* Day cells */}
                {days.map(day => {
                  const cell = weekView.days[day]?.find(c => c.shift.id === shiftTemplate.id)
                  if (!cell) return <td key={day} className="px-2 py-2" />

                  return (
                    <td key={day} className="px-2 py-2 align-top">
                      <ShiftCell
                        cell={cell}
                        shiftDate={day}
                        availableStaff={staff}
                        onAssign={assign}
                        onCancel={cancelShift}
                        isManager={isManager}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rules violation override modal */}
      {violationsModal && (
        <Modal
          open
          onClose={() => setViolationsModal(null)}
          title="Working Time Warning"
          footer={
            <>
              <Button variant="secondary" onClick={() => setViolationsModal(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const v = violationsModal
                  setViolationsModal(null)
                  await assign(v.shiftId, v.shiftDate, v.staffId, true)
                }}
              >
                Override & Assign
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-amber-700 font-medium">
              This assignment violates one or more Working Time Regulations:
            </p>
            <ul className="space-y-2">
              {violationsModal.violations.map((v, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-red-500 flex-shrink-0">•</span>
                  <span>{v.message}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              Overriding will be recorded in the audit log.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
