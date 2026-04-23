// GET /api/homes/{id} — get home details
// PUT /api/homes/{id} — update home details
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const UpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).optional(),
  email: z.string().email().optional(),
  timezone: z.string().optional(),
  maxStaff: z.number().int().min(0).optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { homeId: headerHomeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const { id } = await params

  if (role !== 'system_admin' && id !== headerHomeId) {
    return authError('FORBIDDEN')
  }

  const [home] = await sql`
    SELECT id, name, address, email, timezone, max_staff, is_active, created_at, updated_at
    FROM homes WHERE id = ${id} LIMIT 1
  `

  if (!home) return NextResponse.json({ error: 'Home not found' }, { status: 404 })

  return NextResponse.json(home)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, homeId: headerHomeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const { id } = await params

  if (!['home_manager', 'system_admin'].includes(role)) {
    return authError('FORBIDDEN')
  }

  if (role !== 'system_admin' && id !== headerHomeId) {
    return authError('FORBIDDEN')
  }

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  const [home] = await sql`
    UPDATE homes SET
      name = COALESCE(${d.name ?? null}, name),
      address = COALESCE(${d.address ?? null}, address),
      email = COALESCE(${d.email ?? null}, email),
      timezone = COALESCE(${d.timezone ?? null}, timezone),
      max_staff = COALESCE(${d.maxStaff ?? null}, max_staff),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  if (!home) return NextResponse.json({ error: 'Home not found' }, { status: 404 })

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId: id,
    actorId: actor?.id ?? null,
    action: 'home.updated',
    entityType: 'homes',
    entityId: home.id,
    metadata: d,
    ipAddress: getIp(req),
  })

  return NextResponse.json(home)
}
