// GET /api/rota/gaps?homeId=&week=YYYY-MM-DD — unfilled shifts for a week
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { validateWeekStart, getWeekDays } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { homeId: headerHomeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const { searchParams } = new URL(req.url)
  const homeId = searchParams.get('homeId') ?? headerHomeId
  const week = searchParams.get('week')

  if (!homeId || !week) {
    return NextResponse.json({ error: 'homeId and week are required' }, { status: 400 })
  }

  try {
    validateWeekStart(week)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return authError('FORBIDDEN')
  }

  const days = getWeekDays(week)

  const rotaShifts = await sql`
    SELECT
      rs.shift_date::text AS shift_date,
      rs.shift_id,
      s.name AS shift_name,
      rs.staff_id
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    WHERE rs.home_id = ${homeId}
      AND rs.week_start = ${week}
      AND rs.status != 'cancelled'
    ORDER BY rs.shift_date, s.start_time
  `

  const shifts = await sql`
    SELECT * FROM shifts WHERE home_id = ${homeId} AND is_active = TRUE ORDER BY start_time
  `

  const gaps: Array<{
    date: string;
    shift_id: string;
    shift_name: string;
    assigned: number;
    required: number;
  }> = []

  for (const day of days) {
    for (const shift of shifts as Array<{ id: string; name: string }>) {
      const assigned = (rotaShifts as Array<{ shift_date: string; shift_id: string; staff_id: string | null }>)
        .filter(rs => rs.shift_date === day && rs.shift_id === shift.id && rs.staff_id !== null).length

      const required = 1

      if (assigned < required) {
        gaps.push({ date: day, shift_id: shift.id, shift_name: shift.name, assigned, required })
      }
    }
  }

  return NextResponse.json({ week, totalGaps: gaps.length, gaps })
}
