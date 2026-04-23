// GET /api/rota/[homeId]/[week] — full week view with assignments
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { getWeekDays, validateWeekStart } from '@/lib/utils'
import type { WeekView, WeekViewCell } from '@/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ homeId: string; week: string }> }
) {
  const { homeId: headerHomeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const { homeId, week } = await params

  try {
    validateWeekStart(week)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return authError('FORBIDDEN')
  }

  const shifts = await sql`
    SELECT * FROM shifts
    WHERE home_id = ${homeId} AND is_active = TRUE
    ORDER BY start_time
  `

  const rotaShifts = await sql`
    SELECT
      rs.*,
      s.name         AS shift_name,
      s.start_time::text AS shift_start_time,
      s.end_time::text   AS shift_end_time,
      s.duration_hours   AS shift_duration_hours,
      s.color            AS shift_color,
      st.id              AS staff_id,
      st.first_name      AS staff_first_name,
      st.last_name       AS staff_last_name,
      st.email           AS staff_email,
      st.phone           AS staff_phone,
      st.role            AS staff_role
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    LEFT JOIN staff st ON st.id = rs.staff_id
    WHERE rs.home_id = ${homeId}
      AND rs.week_start = ${week}
    ORDER BY rs.shift_date, s.start_time
  `

  const days = getWeekDays(week)

  const grid: Record<string, WeekViewCell[]> = {}
  for (const day of days) {
    const dayShifts: WeekViewCell[] = shifts.map((shift: Record<string, unknown>) => {
      const assignment = rotaShifts.find(
        (rs: Record<string, unknown>) =>
          rs.shift_date === day && rs.shift_id === shift.id
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
          is_night: shift.is_night as boolean,
          is_weekend: shift.is_weekend as boolean,
          is_active: shift.is_active as boolean,
          created_at: shift.created_at as string,
          updated_at: shift.updated_at as string,
        },
        rota_shift: assignment
          ? {
              id: assignment.id as string,
              home_id: assignment.home_id as string,
              shift_id: assignment.shift_id as string,
              staff_id: assignment.staff_id as string | null,
              unit_id: assignment.unit_id as string | null,
              shift_date: assignment.shift_date as string,
              week_start: assignment.week_start as string,
              status: assignment.status as 'draft' | 'published' | 'confirmed' | 'cancelled',
              notes: assignment.notes as string | null,
              confirmed_at: assignment.confirmed_at as string | null,
              created_by: assignment.created_by as string,
              created_at: assignment.created_at as string,
              updated_at: assignment.updated_at as string,
            }
          : null,
        staff: assignment?.staff_id
          ? {
              id: assignment.staff_id as string,
              home_id: homeId,
              unit_id: null,
              clerk_user_id: '',
              first_name: assignment.staff_first_name as string,
              last_name: assignment.staff_last_name as string,
              email: assignment.staff_email as string,
              phone: assignment.staff_phone as string | null,
              role: assignment.staff_role as 'care_staff',
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
    grid[day] = dayShifts
  }

  const weekView: WeekView = { home_id: homeId, week_start: week, days: grid }

  return NextResponse.json(weekView)
}
