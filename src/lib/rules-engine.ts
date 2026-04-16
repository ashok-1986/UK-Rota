// =============================================================
// Rules Engine — UK Working Time Regulations validation
//
// Three checks before any rota_shift insert:
//   1. Minimum rest between shifts      (default 11h — WTR)
//   2. Maximum weekly hours             (default 48h — WTR)
//   3. Maximum consecutive working days (default 7)
//
// Returns { valid, violations[] } — caller decides whether to block or override.
// =============================================================
import sql from './db'
import type { RulesCheckInput, RulesCheckResult, RulesViolation } from '@/types'

/** Fetch active rules for a home (with UK WTR defaults if not configured) */
async function loadRules(homeId: string): Promise<Record<string, number>> {
  const rows = (await sql`
    SELECT rule_type, value
    FROM rules
    WHERE home_id = ${homeId}
      AND is_active = TRUE
  `) as { rule_type: string; value: number }[]

  // UK WTR defaults
  const defaults: Record<string, number> = {
    min_rest_hours: 11,
    max_weekly_hours: 48,
    max_consecutive_days: 7,
  }

  for (const row of rows) {
    defaults[row.rule_type] = Number(row.value)
  }
  return defaults
}

/** Returns the scheduled week start (Monday) from a shift date */
function weekStartFromDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z')
  const day = date.getUTCDay()               // 0 = Sun, 1 = Mon …
  const diff = day === 0 ? -6 : 1 - day      // shift to Monday
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() + diff)
  return monday.toISOString().slice(0, 10)
}

// ------------------------------------------------------------------
// Individual rule checks
// ------------------------------------------------------------------

/** Check 1: 11h minimum rest between adjacent shifts */
async function checkMinRest(
  staffId: string,
  shiftDate: string,
  newStartTime: string,
  newEndTime: string,
  newDurationHours: number,
  minRestHours: number
): Promise<RulesViolation | null> {
  void newDurationHours // used by caller only

  // Determine start/end timestamps for the NEW shift (handles overnight)
  const newStart = new Date(`${shiftDate}T${newStartTime}Z`)
  let newEnd = new Date(`${shiftDate}T${newEndTime}Z`)
  if (newEnd <= newStart) newEnd = new Date(newEnd.getTime() + 24 * 3600 * 1000) // overnight

  // Get recent adjacent shifts (2 days either side)
  const rows = (await sql`
    SELECT rs.shift_date::text AS shift_date, s.start_time::text AS start_time, s.end_time::text AS end_time
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    WHERE rs.staff_id = ${staffId}
      AND rs.status != 'cancelled'
      AND rs.shift_date BETWEEN (${shiftDate}::date - INTERVAL '2 days')::date
                            AND (${shiftDate}::date + INTERVAL '2 days')::date
    ORDER BY rs.shift_date, s.start_time
  `) as { shift_date: string; start_time: string; end_time: string }[]

  let minGap = Infinity

  for (const row of rows) {
    const rowStart = new Date(`${row.shift_date}T${row.start_time}Z`)
    let rowEnd = new Date(`${row.shift_date}T${row.end_time}Z`)
    if (rowEnd <= rowStart) rowEnd = new Date(rowEnd.getTime() + 24 * 3600 * 1000)

    // Gap BEFORE the new shift (existing shift ends before new starts)
    if (rowEnd <= newStart) {
      const gap = (newStart.getTime() - rowEnd.getTime()) / 3600000
      minGap = Math.min(minGap, gap)
    }
    // Gap AFTER the new shift (existing shift starts after new ends)
    if (rowStart >= newEnd) {
      const gap = (rowStart.getTime() - newEnd.getTime()) / 3600000
      minGap = Math.min(minGap, gap)
    }
  }

  if (minGap === Infinity) return null // no adjacent shifts — always OK

  if (minGap < minRestHours) {
    return {
      rule: 'min_rest_hours',
      message: `Only ${minGap.toFixed(1)}h rest between shifts. Minimum is ${minRestHours}h (UK Working Time Regulations).`,
      current: Math.round(minGap * 10) / 10,
      limit: minRestHours,
    }
  }
  return null
}

/** Check 2: 48h max weekly hours */
async function checkWeeklyHours(
  staffId: string,
  weekStart: string,
  newDurationHours: number,
  maxWeeklyHours: number
): Promise<RulesViolation | null> {
  const rows = (await sql`
    SELECT COALESCE(SUM(s.duration_hours), 0)::text AS total
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    WHERE rs.staff_id = ${staffId}
      AND rs.week_start = ${weekStart}
      AND rs.status != 'cancelled'
  `) as { total: string }[]

  const current = parseFloat(rows[0]?.total ?? '0')
  const projected = current + newDurationHours

  if (projected > maxWeeklyHours) {
    return {
      rule: 'max_weekly_hours',
      message: `This shift would bring weekly hours to ${projected.toFixed(1)}h. Maximum is ${maxWeeklyHours}h (UK Working Time Regulations).`,
      current: Math.round(projected * 10) / 10,
      limit: maxWeeklyHours,
    }
  }
  return null
}

/** Check 3: max consecutive working days */
async function checkConsecutiveDays(
  staffId: string,
  shiftDate: string,
  maxConsecutiveDays: number
): Promise<RulesViolation | null> {
  // Fetch shifts for a 14-day window around the target date
  const rows = (await sql`
    SELECT DISTINCT rs.shift_date::text AS shift_date
    FROM rota_shifts rs
    WHERE rs.staff_id = ${staffId}
      AND rs.status != 'cancelled'
      AND rs.shift_date BETWEEN (${shiftDate}::date - INTERVAL '13 days')::date
                            AND (${shiftDate}::date + INTERVAL '13 days')::date
    ORDER BY shift_date
  `) as { shift_date: string }[]

  // Build set of existing dates including the target
  const dates = new Set(rows.map(r => r.shift_date))
  dates.add(shiftDate)

  // Count consecutive run containing target date
  const sorted = Array.from(dates).sort()
  let maxRun = 0
  let run = 1

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00Z')
    const curr = new Date(sorted[i] + 'T00:00:00Z')
    const diff = (curr.getTime() - prev.getTime()) / 86400000

    if (diff === 1) {
      run++
      maxRun = Math.max(maxRun, run)
    } else {
      run = 1
    }
  }
  maxRun = Math.max(maxRun, run)

  if (maxRun > maxConsecutiveDays) {
    return {
      rule: 'max_consecutive_days',
      message: `This shift creates a run of ${maxRun} consecutive working days. Maximum is ${maxConsecutiveDays}.`,
      current: maxRun,
      limit: maxConsecutiveDays,
    }
  }
  return null
}

// ------------------------------------------------------------------
// Main exported function
// ------------------------------------------------------------------

export async function checkRules(input: RulesCheckInput): Promise<RulesCheckResult> {
  const { staffId, shiftId, shiftDate, homeId } = input

  // Fetch shift template and rules in parallel
  const [shiftRows, rules] = await Promise.all([
    sql`
      SELECT start_time::text AS start_time, end_time::text AS end_time, duration_hours::text AS duration_hours
      FROM shifts
      WHERE id = ${shiftId}
        AND home_id = ${homeId}
        AND is_active = TRUE
      LIMIT 1
    `.then(r => r as { start_time: string; end_time: string; duration_hours: string }[]),
    loadRules(homeId),
  ])

  if (shiftRows.length === 0) {
    return {
      valid: false,
      violations: [
        {
          rule: 'min_rest_hours',
          message: 'Shift template not found or inactive.',
          current: 0,
          limit: 0,
        },
      ],
    }
  }

  const shift = shiftRows[0]
  const duration = parseFloat(shift.duration_hours)
  const weekStart = weekStartFromDate(shiftDate)

  // Run all three checks in parallel
  const [restViolation, hoursViolation, consecutiveViolation] = await Promise.all([
    checkMinRest(staffId, shiftDate, shift.start_time, shift.end_time, duration, rules.min_rest_hours),
    checkWeeklyHours(staffId, weekStart, duration, rules.max_weekly_hours),
    checkConsecutiveDays(staffId, shiftDate, rules.max_consecutive_days),
  ])

  const violations: RulesViolation[] = [
    restViolation,
    hoursViolation,
    consecutiveViolation,
  ].filter((v): v is RulesViolation => v !== null)

  return { valid: violations.length === 0, violations }
}
