// GET /api/reports/weekly-pdf?homeId=&week=YYYY-MM-DD
// Streams a PDF of the weekly rota
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { generateWeeklyPDF } from '@/lib/pdf'
import { getWeekDays, validateWeekStart } from '@/lib/utils'
import type { WeekView, WeekViewCell } from '@/types'

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

  // Fetch home name
  const [home] = await sql`SELECT name FROM homes WHERE id = ${homeId} LIMIT 1`
  if (!home) return NextResponse.json({ error: 'Home not found' }, { status: 404 })

  // Fetch shifts and assignments (same as rota GET route)
  const shifts = await sql`
    SELECT * FROM shifts WHERE home_id = ${homeId} AND is_active = TRUE ORDER BY start_time
  `
  const rotaShifts = await sql`
    SELECT rs.*, st.first_name AS staff_first_name, st.last_name AS staff_last_name,
           st.role AS staff_role, st.email AS staff_email, st.phone AS staff_phone,
           s.name AS shift_name, s.start_time::text AS shift_start_time,
           s.end_time::text AS shift_end_time, s.duration_hours, s.color AS shift_color
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    LEFT JOIN staff st ON st.id = rs.staff_id
    WHERE rs.home_id = ${homeId} AND rs.week_start = ${week}
    ORDER BY rs.shift_date, s.start_time
  `

  const days = getWeekDays(week)
  const grid: Record<string, WeekViewCell[]> = {}

  for (const day of days) {
    grid[day] = shifts.map((shift: Record<string, unknown>) => {
      const rs = rotaShifts.find(
        (r: Record<string, unknown>) => r.shift_date === day && r.shift_id === shift.id
      )
      return {
        shift: {
          id: shift.id as string,
          home_id: shift.home_id as string,
          name: shift.name as string,
          start_time: shift.start_time as string,
          end_time: shift.end_time as string,
          duration_hours: Number(shift.duration_hours),
          color: shift.color as string,
          is_active: true,
          created_at: '',
          updated_at: '',
        },
        rota_shift: rs
          ? {
              id: rs.id as string, home_id: rs.home_id as string,
              shift_id: rs.shift_id as string, staff_id: rs.staff_id as string | null,
              unit_id: rs.unit_id as string | null, shift_date: rs.shift_date as string,
              week_start: rs.week_start as string,
              status: rs.status as 'draft' | 'published' | 'confirmed' | 'cancelled',
              notes: rs.notes as string | null, confirmed_at: rs.confirmed_at as string | null,
              created_by: rs.created_by as string,
              created_at: rs.created_at as string, updated_at: rs.updated_at as string,
            }
          : null,
        staff: rs?.staff_id
          ? {
              id: rs.staff_id as string,
              home_id: homeId,
              unit_id: null,
              clerk_user_id: '',
              first_name: rs.staff_first_name as string,
              last_name: rs.staff_last_name as string,
              email: rs.staff_email as string,
              phone: rs.staff_phone as string | null,
              role: rs.staff_role as 'care_staff',
              employment_type: 'full_time',
              contracted_hours: null,
              max_hours_week: 48,
              night_shifts_ok: false,
              is_active: true,
              deleted_at: null,
              created_at: '',
              updated_at: '',
            }
          : null,
      }
    })
  }

  const weekView: WeekView = { home_id: homeId, week_start: week, days: grid }

  const buffer = await generateWeeklyPDF(weekView, home.name)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rota-${week}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
