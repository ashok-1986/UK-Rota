// GET /api/rota/gaps?homeId=&week=YYYY-MM-DD
// Returns unfilled shifts for a given week
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { validateWeekStart, getWeekDays } from '@/lib/utils'
import type { AppRole } from '@/types'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const homeId = searchParams.get('homeId') ?? req.headers.get('x-home-id')
  const week = searchParams.get('week')

  if (!homeId || !week) {
    return NextResponse.json({ error: 'homeId and week are required' }, { status: 400 })
  }

  try {
    validateWeekStart(week)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const role = req.headers.get('x-user-role') as AppRole
  const headerHomeId = req.headers.get('x-home-id')
  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const days = getWeekDays(week)

  // Get all shifts for this week
  const rotaShifts = await sql`
    SELECT
      rs.shift_date::text AS shift_date,
      rs.shift_id,
      s.name AS shift_name,
      rs.staff_id
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id AND s.home_id = ${homeId}
    WHERE rs.home_id = ${homeId}
      AND rs.week_start = ${week}
      AND rs.status != 'cancelled'
    ORDER BY rs.shift_date, s.start_time
  `

  const shifts = await sql`
    SELECT * FROM shifts WHERE home_id = ${homeId} AND is_active = TRUE ORDER BY start_time
  `

  // Calculate gaps
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
      
      const required = 1 // Assuming 1 staff per shift for MVP
      
      if (assigned < required) {
        gaps.push({
          date: day,
          shift_id: shift.id,
          shift_name: shift.name,
          assigned,
          required,
        })
      }
    }
  }

  return NextResponse.json({
    week,
    totalGaps: gaps.length,
    gaps,
  })
}
