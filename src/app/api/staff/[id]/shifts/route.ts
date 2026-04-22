// GET /api/staff/[id]/shifts
// Returns all shifts for a specific staff member (for staff portal view)
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import type { AppRole } from '@/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const role = req.headers.get('x-user-role') as AppRole
  const homeId = req.headers.get('x-home-id')

  // Staff can only view their own shifts
  if (role === 'care_staff' || role === 'bank_staff') {
    const [staffRecord] = await sql`
      SELECT id FROM staff WHERE clerk_user_id = ${userId} AND deleted_at IS NULL LIMIT 1
    `
    if (staffRecord?.id !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Verify staff exists and belongs to accessible home
  const [staff] = await sql`
    SELECT id, home_id FROM staff WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `
  if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

  if (role !== 'system_admin' && staff.home_id !== homeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    JOIN shifts s ON s.id = rs.shift_id AND s.home_id = ${staff.home_id}
    WHERE rs.staff_id = ${id}
      AND rs.shift_date >= ${today}
    ORDER BY rs.shift_date, s.start_time
    LIMIT 30
  `

  return NextResponse.json(shifts)
}
