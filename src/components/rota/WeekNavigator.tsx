'use client'
import { useRouter } from 'next/navigation'
import { addDays, format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { formatWeekRange } from '@/lib/utils'

interface WeekNavigatorProps {
  homeId: string
  weekStart: string   // YYYY-MM-DD (Monday)
}

export function WeekNavigator({ homeId, weekStart }: WeekNavigatorProps) {
  const router = useRouter()

  function navigate(offsetDays: number) {
    const next = addDays(parseISO(weekStart), offsetDays)
    const nextStr = format(next, 'yyyy-MM-dd')
    router.push(`/dashboard/rota/${homeId}/${nextStr}`)
  }

  const isCurrentWeek = weekStart === format(
    (() => {
      const d = new Date()
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setDate(d.getDate() + diff)
      return d
    })(),
    'yyyy-MM-dd'
  )

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" size="sm" onClick={() => navigate(-7)}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Prev
      </Button>

      <div className="text-center">
        <p className="text-sm font-semibold text-gray-900">{formatWeekRange(weekStart)}</p>
        {isCurrentWeek && (
          <span className="text-xs text-blue-600 font-medium">Current week</span>
        )}
      </div>

      <Button variant="secondary" size="sm" onClick={() => navigate(7)}>
        Next
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Button>

      {!isCurrentWeek && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const d = new Date()
            const day = d.getDay()
            const diff = day === 0 ? -6 : 1 - day
            d.setDate(d.getDate() + diff)
            router.push(`/dashboard/rota/${homeId}/${format(d, 'yyyy-MM-dd')}`)
          }}
        >
          Today
        </Button>
      )}
    </div>
  )
}
