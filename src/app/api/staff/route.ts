// POST /api/staff         — create a staff member (DB record only; Kinde user linked via invite flow)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const CreateSchema = z.object({
  homeId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  role: z.enum(['home_manager', 'care_staff', 'bank_staff']),
  employmentType: z.enum(['full_time', 'part_time', 'bank']),
  contractedHours: z.number().positive().max(168).optional(),
})

export async function GET(req: NextRequest) {
  const { homeId: headerHomeId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const { searchParams } = new URL(req.url)
  const homeId = searchParams.get('homeId') ?? headerHomeId
  const unitId = searchParams.get('unitId')
  if (!homeId) return NextResponse.json({ error: 'homeId is required' }, { status: 400 })

  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return authError('FORBIDDEN')
  }

  let staff
  if (unitId) {
    staff = await sql`
      SELECT s.*, u.name AS unit_name
      FROM staff s
      LEFT JOIN units u ON u.id = s.unit_id
      WHERE s.home_id = ${homeId}
        AND s.unit_id = ${unitId}
        AND s.deleted_at IS NULL
      ORDER BY s.last_name, s.first_name
    `
  } else {
    staff = await sql`
      SELECT s.*, u.name AS unit_name
      FROM staff s
      LEFT JOIN units u ON u.id = s.unit_id
      WHERE s.home_id = ${homeId}
        AND s.deleted_at IS NULL
      ORDER BY s.last_name, s.first_name
    `
  }

  return NextResponse.json(staff)
}

export async function POST(req: NextRequest) {
  const { userId, homeId: headerHomeId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  if (role !== 'system_admin' && d.homeId !== headerHomeId) {
    return authError('FORBIDDEN')
  }

  const [actor] = await sql`SELECT id FROM staff WHERE kinde_user_id = ${userId} LIMIT 1`

  // Placeholder until Kinde webhook fires and updates with the real Kinde user ID
  const pendingKindeId = `pending_kinde_${crypto.randomUUID()}`

  const [staffRow] = await sql`
    INSERT INTO staff
      (home_id, unit_id, kinde_user_id, first_name, last_name, email, phone,
       role, employment_type, contracted_hours)
    VALUES
      (${d.homeId}, ${d.unitId ?? null}, ${pendingKindeId},
       ${d.firstName}, ${d.lastName}, ${d.email}, ${d.phone ?? null},
       ${d.role}, ${d.employmentType}, ${d.contractedHours ?? null})
    RETURNING *
  `

  await writeAuditLog({
    homeId: d.homeId,
    actorId: actor?.id ?? null,
    action: 'staff.created',
    entityType: 'staff',
    entityId: staffRow.id,
    metadata: { email: d.email, role: d.role },
    ipAddress: getIp(req),
  })

  return NextResponse.json(staffRow, { status: 201 })
}
