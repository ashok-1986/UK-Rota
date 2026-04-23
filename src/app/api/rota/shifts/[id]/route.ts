// PUT /api/rota/shifts/[id] — update a rota_shift: status, staff assignment, notes
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const Schema = z.object({
  status: z.enum(['draft', 'published', 'confirmed', 'cancelled']).optional(),
  staffId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, homeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const { id } = await params

  const [rotaShift] = await sql`SELECT * FROM rota_shifts WHERE id = ${id} LIMIT 1`
  if (!rotaShift) return NextResponse.json({ error: 'Rota shift not found' }, { status: 404 })

  if (role !== 'system_admin' && rotaShift.home_id !== homeId) {
    return authError('FORBIDDEN')
  }

  // Staff can only confirm/cancel their own shifts
  if (role === 'care_staff' || role === 'bank_staff') {
    const [staffRecord] = await sql`
      SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1
    `
    if (rotaShift.staff_id !== staffRecord?.id) {
      return NextResponse.json({ error: 'Forbidden — you can only update your own shifts' }, { status: 403 })
    }
  }

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const { status, staffId, notes } = parsed.data

  const confirmedAt = status === 'confirmed' ? new Date().toISOString() : rotaShift.confirmed_at

  const [updated] = await sql`
    UPDATE rota_shifts SET
      status       = COALESCE(${status ?? null}, status),
      staff_id     = ${staffId !== undefined ? staffId : rotaShift.staff_id},
      notes        = ${notes !== undefined ? notes : rotaShift.notes},
      confirmed_at = ${confirmedAt},
      updated_at   = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId: rotaShift.home_id,
    actorId: actor?.id ?? null,
    action: `rota_shift.${status ?? 'updated'}`,
    entityType: 'rota_shifts',
    entityId: id,
    metadata: { status, staffId, notes },
    ipAddress: getIp(req),
  })

  return NextResponse.json(updated)
}
