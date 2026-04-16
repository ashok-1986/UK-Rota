// GET /api/units?homeId= - List units for a home
// POST /api/units - Create a new unit
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'
import type { AppRole } from '@/types'

const CreateSchema = z.object({
  homeId: z.string().uuid(),
  name: z.string().min(1).max(255),
  maxStaff: z.number().int().min(0).optional(),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const homeId = req.headers.get('x-home-id')
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const units = await sql`
    SELECT id, home_id, name, max_staff, created_at, updated_at
    FROM units
    WHERE home_id = ${homeId}
    ORDER BY name
  `

  return NextResponse.json(units)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const headerHomeId = req.headers.get('x-home-id')
  const role = req.headers.get('x-user-role') as AppRole

  if (!['home_manager', 'system_admin'].includes(role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }

  const { homeId, name, maxStaff } = parsed.data

  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [unit] = await sql`
    INSERT INTO units (home_id, name, max_staff)
    VALUES (${homeId}, ${name}, ${maxStaff ?? 0})
    RETURNING *
  `

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId,
    actorId: actor?.id ?? null,
    action: 'unit.created',
    entityType: 'units',
    entityId: unit.id,
    metadata: { name, maxStaff },
    ipAddress: getIp(req),
  })

  return NextResponse.json(unit, { status: 201 })
}