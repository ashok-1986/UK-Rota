// GET  /api/staff?homeId=  — list active staff for a home
// POST /api/staff          — create a staff member (creates Clerk user + DB row)
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'
import type { AppRole } from '@/types'

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
  password: z.string().min(8).max(100),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const homeId = searchParams.get('homeId') ?? req.headers.get('x-home-id')
  const unitId = searchParams.get('unitId')
  if (!homeId) return NextResponse.json({ error: 'homeId is required' }, { status: 400 })

  // Managers can only see staff for their own home
  const headerHomeId = req.headers.get('x-home-id')
  const role = req.headers.get('x-user-role') as AppRole
  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let staff
  if (unitId) {
    // Filter by unit (for unit managers)
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
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  // Managers can only add staff to their own home
  const headerHomeId = req.headers.get('x-home-id')
  const role = req.headers.get('x-user-role') as AppRole
  if (role !== 'system_admin' && d.homeId !== headerHomeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get actor staff record for audit
  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  // Create Clerk user
  const clerk = await clerkClient()
  let clerkUser
  try {
    clerkUser = await clerk.users.createUser({
      emailAddress: [d.email],
      password: d.password,
      firstName: d.firstName,
      lastName: d.lastName,
      publicMetadata: {
        role: d.role,
        homeId: d.homeId,
      },
    })
  } catch (err) {
    console.error('[staff] Clerk user creation failed:', err)
    return NextResponse.json({ error: 'Failed to create Clerk account' }, { status: 500 })
  }

  const [staffRow] = await sql`
    INSERT INTO staff
      (home_id, unit_id, clerk_user_id, first_name, last_name, email, phone,
       role, employment_type, contracted_hours)
    VALUES
      (${d.homeId}, ${d.unitId ?? null}, ${clerkUser.id},
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
