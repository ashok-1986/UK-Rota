// GET /api/staff/invites — list pending invites for the current user's home
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
    const { homeId, role } = await getSessionFromHeaders(req.headers)
    if (!homeId || !role) return authError('UNAUTHORIZED')

    if (role !== 'home_manager' && role !== 'system_admin') {
        return authError('FORBIDDEN')
    }

    const invites = await sql`
    SELECT
      si.id,
      si.email,
      si.role,
      si.status,
      si.created_at,
      si.expires_at,
      si.accepted_at,
      s.first_name AS invited_by_first_name,
      s.last_name  AS invited_by_last_name
    FROM staff_invites si
    JOIN staff s ON s.id = si.invited_by
    WHERE si.home_id = ${homeId}
      AND si.status = 'pending'
      AND si.expires_at > NOW()
    ORDER BY si.created_at DESC
  `

    return NextResponse.json(invites)
}
