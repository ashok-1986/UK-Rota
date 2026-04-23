// PUT /api/units/{id} — update a unit
// DELETE /api/units/{id} — delete a unit
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const UpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  maxStaff: z.number().int().min(0).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { homeId } = getSessionFromHeaders(req.headers)
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const { id } = await params

  const [unit] = await sql`
    SELECT id, home_id, name, max_staff, created_at, updated_at
    FROM units
    WHERE id = ${id} AND home_id = ${homeId}
    LIMIT 1
  `

  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

  return NextResponse.json(unit)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, homeId: headerHomeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  if (!['home_manager', 'system_admin'].includes(role)) {
    return authError('FORBIDDEN')
  }

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  const [unit] = await sql`
    UPDATE units SET
      name = COALESCE(${d.name ?? null}, name),
      max_staff = COALESCE(${d.maxStaff ?? null}, max_staff),
      updated_at = NOW()
    WHERE id = ${id} AND home_id = ${headerHomeId}
    RETURNING *
  `

  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId: headerHomeId!,
    actorId: actor?.id ?? null,
    action: 'unit.updated',
    entityType: 'units',
    entityId: unit.id,
    metadata: d,
    ipAddress: getIp(req),
  })

  return NextResponse.json(unit)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, homeId: headerHomeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  if (!['home_manager', 'system_admin'].includes(role)) {
    return authError('FORBIDDEN')
  }

  const { id } = await params

  const [staffCount] = await sql`
    SELECT COUNT(*) as count FROM staff WHERE unit_id = ${id} AND deleted_at IS NULL
  `
  if (staffCount && Number(staffCount.count) > 0) {
    return NextResponse.json({ error: 'Cannot delete unit with staff assigned. Reassign staff first.' }, { status: 400 })
  }

  const [unit] = await sql`
    DELETE FROM units WHERE id = ${id} AND home_id = ${headerHomeId} RETURNING id
  `

  if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 })

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId: headerHomeId!,
    actorId: actor?.id ?? null,
    action: 'unit.deleted',
    entityType: 'units',
    entityId: unit.id,
    ipAddress: getIp(req),
  })

  return NextResponse.json({ message: 'Unit deleted' })
}
