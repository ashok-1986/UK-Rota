// POST /api/gdpr/delete-request
// UK GDPR Article 17 — right to erasure
// Soft-deletes the staff account; anonymisation happens after 30 days via retention cleanup
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'
import type { AppRole } from '@/types'

const Schema = z.object({
  staffId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const { staffId, reason } = parsed.data

  // Get requester
  const [requester] = await sql`
    SELECT * FROM staff WHERE clerk_user_id = ${userId} AND deleted_at IS NULL LIMIT 1
  `
  if (!requester) return NextResponse.json({ error: 'Requester not found' }, { status: 403 })

  const [target] = await sql`
    SELECT * FROM staff WHERE id = ${staffId} AND deleted_at IS NULL LIMIT 1
  `
  if (!target) return NextResponse.json({ error: 'Staff member not found or already deleted' }, { status: 404 })

  const role = requester.role as AppRole
  const isSelf = requester.id === staffId
  const isManager = ['home_manager', 'system_admin'].includes(role) && target.home_id === requester.home_id

  if (!isSelf && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft-delete: set deleted_at and is_active = false
  await sql`
    UPDATE staff
    SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
    WHERE id = ${staffId}
  `

  // Disable the Clerk account
  const clerk = await clerkClient()
  try {
    await clerk.users.banUser(target.clerk_user_id)
  } catch (err) {
    console.error('[gdpr] Failed to disable Clerk account:', err)
  }

  await writeAuditLog({
    homeId: target.home_id,
    actorId: requester.id,
    action: 'gdpr.delete_requested',
    entityType: 'staff',
    entityId: staffId,
    metadata: {
      requestedBy: requester.id,
      reason,
      scheduledAnonymisationAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    },
    ipAddress: getIp(req),
  })

  return NextResponse.json({
    message: 'Account marked for deletion. Personal data will be anonymised within 30 days.',
    scheduledAnonymisationAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  })
}
