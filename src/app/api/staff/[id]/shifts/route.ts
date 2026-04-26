// GET /api/staff/[id]/shifts — all upcoming shifts for a specific staff member
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, homeId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const { id } = await params

  // Staff can only view their own shifts
  if (role === 'care_staff' || role === 'bank_staff') {
    const [staffRecord] = await sql`
      SELECT id FROM staff WHERE clerk_user_id = ${userId} AND deleted_at IS NULL LIMIT 1
    `
    if (staffRecord?.id !== id) {
      return authError('FORBIDDEN')
    }
  }

  const [staff] = await sql`
    SELECT id, home_id FROM staff WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `
  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

  if (role !== 'system_admin' && staff.home_id !== homeId) {
    return authError('FORBIDDEN')
  }

  const today = new Date().toISOString().slice(0, 10)

  const shifts = await sql`
    SELECT
      rs.id, rs.home_id, rs.shift_id, rs.staff_id, rs.unit_id,
      rs.shift_date::text AS shift_date, rs.week_start::text AS week_start,
      rs.status, rs.notes, rs.confirmed_at, rs.created_by,
      rs.created_at, rs.updated_at,
      s.id AS s_id, s.name AS s_name,
      s.start_time::text AS s_start_time, s.end_time::text AS s_end_time,
      s.duration_hours, s.color AS s_color
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    WHERE rs.staff_id = ${id}
      AND rs.shift_date >= ${today}
    ORDER BY rs.shift_date, s.start_time
    LIMIT 30
  `

  return NextResponse.json(shifts)
}
