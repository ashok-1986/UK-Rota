// GET /api/gdpr/export?staffId=
// Returns all personal data for a staff member (UK GDPR Article 15 — right of access)
// Accessible by: the staff member themselves, or their home manager / system_admin
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'
import type { StaffDataExport, AppRole } from '@/types'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const targetStaffId = searchParams.get('staffId')
  if (!targetStaffId) return NextResponse.json({ error: 'staffId is required' }, { status: 400 })

  // Get the requesting user's staff record
  const [requester] = await sql`
    SELECT * FROM staff WHERE clerk_user_id = ${userId} AND deleted_at IS NULL LIMIT 1
  `
  if (!requester) return NextResponse.json({ error: 'Requester staff record not found' }, { status: 403 })

  // Get target staff
  const [target] = await sql`
    SELECT * FROM staff WHERE id = ${targetStaffId} LIMIT 1
  `
  if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  const role = requester.role as AppRole

  // Access control: self, or manager/admin of the same home
  const isSelf = requester.id === targetStaffId
  const isManager = ['home_manager', 'system_admin'].includes(role) && target.home_id === requester.home_id

  if (!isSelf && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all personal data
  const rotaShifts = await sql`
    SELECT rs.*, s.name AS shift_name, s.start_time::text AS shift_start_time,
           s.end_time::text AS shift_end_time, s.duration_hours, s.color
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id AND s.home_id = ${target.home_id}
    WHERE rs.staff_id = ${targetStaffId}
    ORDER BY rs.shift_date DESC
  `

  const logs = await sql`
    SELECT * FROM logs
    WHERE actor_id = ${targetStaffId}
    ORDER BY created_at DESC
  `

  const exportData: StaffDataExport = {
    staff: target as never,
    rota_shifts: rotaShifts as never,
    logs: logs as never,
    exported_at: new Date().toISOString(),
  }

  await writeAuditLog({
    homeId: target.home_id,
    actorId: requester.id,
    action: 'gdpr.export_requested',
    entityType: 'staff',
    entityId: targetStaffId,
    metadata: { requestedBy: requester.id },
    ipAddress: getIp(req),
  })

  return NextResponse.json(exportData, {
    headers: {
      'Content-Disposition': `attachment; filename="data-export-${targetStaffId}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
