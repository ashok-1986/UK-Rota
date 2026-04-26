// DELETE /api/staff/invite/[id] — cancel a pending invite
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import { writeAuditLog, getIp } from '@/lib/audit'
import sql from '@/lib/db'

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { homeId, role, userId } = await getSessionFromHeaders(req.headers)
    if (!homeId || !role) return authError('UNAUTHORIZED')

    if (role !== 'home_manager' && role !== 'system_admin') {
        return authError('FORBIDDEN')
    }

    const { id } = await params

    const updated = await sql`
    UPDATE staff_invites
    SET status = 'cancelled'
    WHERE id = ${id}
      AND home_id = ${homeId}
      AND status = 'pending'
    RETURNING id, email
  `

    if (updated.length === 0) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    writeAuditLog({
        homeId,
        actorId: userId,
        action: 'staff.invite_cancelled',
        entityType: 'staff_invite',
        entityId: id,
        metadata: { email: updated[0].email },
        ipAddress: getIp(req),
    })

    return NextResponse.json({ message: 'Invite cancelled' })
}
