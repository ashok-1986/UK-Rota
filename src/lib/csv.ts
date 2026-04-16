// =============================================================
// CSV export — weekly hours report
// =============================================================
import type { Staff, RotaShiftDetailed } from '@/types'
import { fullName, formatTime } from './utils'

interface HoursRow {
  staff: Staff
  shifts: RotaShiftDetailed[]
  totalHours: number
}

/**
 * Build a CSV string for weekly hours.
 * Columns: Name, Role, Mon, Tue, Wed, Thu, Fri, Sat, Sun, Total Hours
 */
export function buildHoursCsv(
  weekStart: string,
  rows: HoursRow[]
): string {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const header = ['Name', 'Role', 'Employment Type', ...days, 'Total Hours']

  // Build date keys for Mon–Sun
  const monday = new Date(weekStart + 'T00:00:00Z')
  const dateKeys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const csvRows = rows.map(({ staff, shifts, totalHours }) => {
    const shiftsByDate = new Map<string, string>()
    for (const s of shifts) {
      const cell = `${s.shift.name} ${formatTime(s.shift.start_time)}-${formatTime(s.shift.end_time)}`
      shiftsByDate.set(s.shift_date, cell)
    }

    return [
      csvEscape(fullName(staff)),
      csvEscape(staff.role),
      csvEscape(staff.employment_type ?? ''),
      ...dateKeys.map(d => csvEscape(shiftsByDate.get(d) ?? '')),
      totalHours.toFixed(2),
    ]
  })

  const allRows = [header, ...csvRows]
  return allRows.map(row => row.join(',')).join('\r\n')
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
