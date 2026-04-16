'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface StaffAvailabilityProps {
  staffId: string
  staffName: string
}

export function StaffAvailability({ staffId, staffName }: StaffAvailabilityProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedDates, setSelectedDates] = useState<string[]>([])

  // Generate next 28 days for selection
  const dates: Date[] = []
  for (let i = 0; i < 28; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i + 1) // Start from tomorrow
    dates.push(d)
  }

  async function saveAvailability() {
    setLoading(true)
    try {
      const res = await fetch('/api/staff/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, unavailableDates: selectedDates }),
      })
      if (!res.ok) throw new Error('Failed to save')
      router.refresh()
      setSelectedDates([])
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function toggleDate(dateStr: string) {
    setSelectedDates(prev => 
      prev.includes(dateStr) 
        ? prev.filter(d => d !== dateStr)
        : [...prev, dateStr]
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h4 className="font-medium text-gray-900 mb-3">Mark Unavailable Dates</h4>
      <p className="text-sm text-gray-500 mb-3">Select dates when {staffName} is not available to work.</p>
      
      <div className="grid grid-cols-7 gap-1 mb-4">
        {dates.map(date => {
          const dateStr = date.toISOString().slice(0, 10)
          const isSelected = selectedDates.includes(dateStr)
          const day = date.toLocaleDateString('en-GB', { weekday: 'short' })
          const dayNum = date.getDate()
          
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => toggleDate(dateStr)}
              className={`p-2 text-xs rounded transition ${
                isSelected 
                  ? 'bg-red-100 text-red-700 border border-red-300' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium">{day}</div>
              <div>{dayNum}</div>
            </button>
          )
        })}
      </div>

      {selectedDates.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{selectedDates.length} dates selected</span>
          <Button size="sm" variant="primary" loading={loading} onClick={saveAvailability}>
            Save Availability
          </Button>
        </div>
      )}
    </div>
  )
}