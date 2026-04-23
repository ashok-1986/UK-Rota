// GET /api/dashboard/stats — get home dashboard statistics
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { homeId } = getSessionFromHeaders(req.headers)
  if (!homeId) return authError('UNAUTHORIZED')

  try {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + diff)
    const weekStartStr = weekStart.toISOString().slice(0, 10)

    const staffCounts = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_active = TRUE AND deleted_at IS NULL) as active_staff,
        COUNT(*) FILTER (WHERE role = 'home_manager' AND is_active = TRUE AND deleted_at IS NULL) as managers,
        COUNT(*) FILTER (WHERE role = 'care_staff' AND is_active = TRUE AND deleted_at IS NULL) as care_staff,
        COUNT(*) FILTER (WHERE role = 'bank_staff' AND is_active = TRUE AND deleted_at IS NULL) as bank_staff
      FROM staff
      WHERE home_id = ${homeId}
    `

    const shiftsThisWeek = await sql`
      SELECT
        COUNT(*) as total_shifts,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_shifts,
        COUNT(*) FILTER (WHERE status = 'published') as published_shifts,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_shifts,
        COUNT(*) FILTER (WHERE staff_id IS NULL) as unfilled_shifts
      FROM rota_shifts
      WHERE home_id = ${homeId} AND week_start = ${weekStartStr}
    `

    const today = new Date().toISOString().slice(0, 10)
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeekStr = nextWeek.toISOString().slice(0, 10)

    const upcomingShifts = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE staff_id IS NULL) as unfilled
      FROM rota_shifts
      WHERE home_id = ${homeId}
        AND shift_date BETWEEN ${today} AND ${nextWeekStr}
        AND status != 'cancelled'
    `

    const gaps = await sql`
      SELECT rs.shift_date::text as date, s.name as shift_name, s.start_time::text as start_time
      FROM rota_shifts rs
      JOIN shifts s ON s.id = rs.shift_id
      WHERE rs.home_id = ${homeId}
        AND rs.week_start = ${weekStartStr}
        AND rs.staff_id IS NULL
        AND rs.status != 'cancelled'
      ORDER BY rs.shift_date, s.start_time
      LIMIT 5
    `

    const rules = await sql`
      SELECT rule_type, value::text as value
      FROM rules
      WHERE home_id = ${homeId} AND is_active = TRUE
    `

    const stats = {
      staff: {
        active: Number(staffCounts[0]?.active_staff ?? 0),
        managers: Number(staffCounts[0]?.managers ?? 0),
        careStaff: Number(staffCounts[0]?.care_staff ?? 0),
        bankStaff: Number(staffCounts[0]?.bank_staff ?? 0),
      },
      shifts: {
        total: Number(shiftsThisWeek[0]?.total_shifts ?? 0),
        draft: Number(shiftsThisWeek[0]?.draft_shifts ?? 0),
        published: Number(shiftsThisWeek[0]?.published_shifts ?? 0),
        confirmed: Number(shiftsThisWeek[0]?.confirmed_shifts ?? 0),
        unfilled: Number(shiftsThisWeek[0]?.unfilled_shifts ?? 0),
      },
      upcoming: {
        total: Number(upcomingShifts[0]?.total ?? 0),
        unfilled: Number(upcomingShifts[0]?.unfilled ?? 0),
      },
      gaps,
      rules: rules.reduce((acc, r) => ({ ...acc, [r.rule_type]: r.value }), {}),
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('[dashboard/stats] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
