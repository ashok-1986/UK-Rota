'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { RoleBadge } from '@/components/ui/Badge'
import type { Staff } from '@/types'
import { fullName, titleCase } from '@/lib/utils'

interface StaffTableProps {
  staff: Staff[]
}

export function StaffTable({ staff }: StaffTableProps) {
  const router = useRouter()
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [availability, setAvailability] = useState<Record<string, string[]>>({})
  const [loadingDates, setLoadingDates] = useState<Record<string, boolean>>({})

  async function toggleActive(member: Staff) {
    setDeactivating(member.id)
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !member.is_active }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Failed to update staff member')
        return
      }
      router.refresh()
    } finally {
      setDeactivating(null)
    }
  }

  async function loadAvailability(staffId: string) {
    if (availability[staffId]) return
    setLoadingDates(prev => ({ ...prev, [staffId]: true }))
    try {
      const res = await fetch(`/api/staff/availability?staffId=${staffId}`)
      if (res.ok) {
        const data = await res.json()
        setAvailability(prev => ({ ...prev, [staffId]: data.map((d: any) => d.date) }))
      }
    } catch (err) {
      console.error('Failed to load availability:', err)
    } finally {
      setLoadingDates(prev => ({ ...prev, [staffId]: false }))
    }
  }

  function toggleExpand(staffId: string) {
    if (expandedId === staffId) {
      setExpandedId(null)
    } else {
      setExpandedId(staffId)
      if (!availability[staffId]) {
        loadAvailability(staffId)
      }
    }
  }

  if (staff.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="font-medium">No staff members yet</p>
        <p className="text-sm mt-1">Add your first staff member using the button above.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {staff.map(member => (
        <div key={member.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-medium">
                  {member.first_name[0]}{member.last_name[0]}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{fullName(member)}</p>
                <p className="text-sm text-gray-500">{member.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <RoleBadge role={member.role} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpand(member.id)}
              >
                {expandedId === member.id ? 'Hide' : 'Availability'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={deactivating === member.id}
                onClick={() => toggleActive(member)}
              >
                {member.is_active ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          </div>

          {expandedId === member.id && (
            <div className="border-t border-gray-100 p-4 bg-gray-50">
              <AvailabilityEditor 
                staffId={member.id}
                unavailableDates={availability[member.id] || []}
                onUpdate={() => loadAvailability(member.id)}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function AvailabilityEditor({ 
  staffId, 
  unavailableDates, 
  onUpdate 
}: { 
  staffId: string
  unavailableDates: string[]
  onUpdate: () => void
}) {
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(unavailableDates))
  const [loading, setLoading] = useState(false)

  const dates: Date[] = []
  for (let i = 0; i < 28; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    dates.push(d)
  }

  async function save() {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          staffId, 
          unavailableDates: Array.from(selectedDates) 
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      onUpdate()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function toggleDate(dateStr: string) {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-3">Mark unavailable dates (next 28 days):</p>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {dates.map(date => {
          const dateStr = date.toISOString().slice(0, 10)
          const isSelected = selectedDates.has(dateStr)
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => toggleDate(dateStr)}
              className={`p-2 text-xs rounded transition ${
                isSelected 
                  ? 'bg-red-100 text-red-700 border border-red-300' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <div className="font-medium">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
              <div>{date.getDate()}</div>
            </button>
          )
        })}
      </div>

      {selectedDates.size > 0 && (
        <Button size="sm" variant="primary" loading={loading} onClick={save}>
          Save ({selectedDates.size} dates)
        </Button>
      )}
    </div>
  )
}
