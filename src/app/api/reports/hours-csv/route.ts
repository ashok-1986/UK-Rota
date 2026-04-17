// GET /api/reports/hours-csv?homeId=&week=YYYY-MM-DD
// Returns a CSV of weekly hours per staff member
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { buildHoursCsv } from '@/lib/csv'
import { validateWeekStart } from '@/lib/utils'
import type { Staff, RotaShiftDetailed } from '@/types'

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

  const role = req.headers.get('x-user-role')
  const headerHomeId = req.headers.get('x-home-id')
  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all assigned shifts for the week
  const rows = await sql`
    SELECT
      st.id, st.home_id, st.unit_id, st.clerk_user_id, st.first_name, st.last_name,
      st.email, st.phone, st.role, st.employment_type, st.contracted_hours,
      st.is_active, st.deleted_at, st.created_at, st.updated_at,
      rs.id AS rota_shift_id, rs.shift_date, rs.week_start, rs.status,
      rs.notes, rs.confirmed_at, rs.created_by,
      s.id AS shift_id, s.name AS shift_name,
      s.start_time::text AS shift_start_time, s.end_time::text AS shift_end_time,
      s.duration_hours, s.color AS shift_color
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    JOIN staff st ON st.id = rs.staff_id
    WHERE rs.home_id = ${homeId}
      AND rs.week_start = ${week}
      AND rs.status != 'cancelled'
      AND rs.staff_id IS NOT NULL
    ORDER BY st.last_name, st.first_name, rs.shift_date
  `

  // Group by staff member
  const staffMap = new Map<string, { staff: Staff; shifts: RotaShiftDetailed[]; totalHours: number }>()

  for (const row of rows) {
    const staffId = row.id
    if (!staffMap.has(staffId)) {
      const staff: Staff = {
        id: row.id, home_id: row.home_id, unit_id: row.unit_id,
        clerk_user_id: row.clerk_user_id, first_name: row.first_name, last_name: row.last_name,
        email: row.email, phone: row.phone, role: row.role, employment_type: row.employment_type,
        contracted_hours: row.contracted_hours ? Number(row.contracted_hours) : null,
        max_hours_week: row.max_hours_week ?? 48,
        night_shifts_ok: row.night_shifts_ok ?? false,
        is_active: row.is_active, deleted_at: row.deleted_at,
        created_at: row.created_at, updated_at: row.updated_at,
      }
      staffMap.set(staffId, { staff, shifts: [], totalHours: 0 })
    }
    const entry = staffMap.get(staffId)!
    const duration = Number(row.duration_hours)

    const shiftDetailed: RotaShiftDetailed = {
      id: row.rota_shift_id, home_id: homeId, shift_id: row.shift_id,
      staff_id: staffId, unit_id: row.unit_id, shift_date: row.shift_date,
      week_start: row.week_start, status: row.status, notes: row.notes,
      confirmed_at: row.confirmed_at, created_by: row.created_by,
      created_at: row.created_at, updated_at: row.updated_at,
      shift: {
        id: row.shift_id, home_id: homeId, name: row.shift_name,
        start_time: row.shift_start_time, end_time: row.shift_end_time,
        duration_hours: duration, color: row.shift_color,
        is_night: row.is_night ?? false, is_weekend: row.is_weekend ?? false,
        is_active: true, created_at: '', updated_at: '',
      },
      staff: entry.staff,
    }
    entry.shifts.push(shiftDetailed)
    entry.totalHours += duration
  }

  const csvData = Array.from(staffMap.values())
  const csv = buildHoursCsv(week, csvData)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="hours-${week}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
