// PUT /api/staff/[id] — update staff member details / soft-delete
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'
import type { AppRole } from '@/types'

const UpdateSchema = z.object({
  unitId: z.string().uuid().nullable().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).nullable().optional(),
  role: z.enum(['home_manager', 'care_staff', 'bank_staff']).optional(),
  employmentType: z.enum(['full_time', 'part_time', 'bank']).optional(),
  contractedHours: z.number().positive().max(168).nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const homeId = req.headers.get('x-home-id')
  const role = req.headers.get('x-user-role') as AppRole

  // Fetch the target staff member to verify home ownership
  const [target] = await sql`
    SELECT * FROM staff WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
  `
  if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  if (role !== 'system_admin' && target.home_id !== homeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  const [updated] = await sql`
    UPDATE staff SET
      unit_id          = COALESCE(${d.unitId !== undefined ? d.unitId : target.unit_id}, unit_id),
      first_name       = COALESCE(${d.firstName ?? null}, first_name),
      last_name        = COALESCE(${d.lastName ?? null}, last_name),
      email            = COALESCE(${d.email ?? null}, email),
      phone            = ${d.phone !== undefined ? d.phone : target.phone},
      role             = COALESCE(${d.role ?? null}, role),
      employment_type  = COALESCE(${d.employmentType ?? null}, employment_type),
      contracted_hours = ${d.contractedHours !== undefined ? d.contractedHours : target.contracted_hours},
      is_active        = COALESCE(${d.isActive ?? null}, is_active),
      updated_at       = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  // Sync role change to Clerk public metadata
  if (d.role && d.role !== target.role) {
    const clerk = await clerkClient()
    await clerk.users.updateUserMetadata(target.clerk_user_id, {
      publicMetadata: { role: d.role, homeId: target.home_id },
    })
  }

  await writeAuditLog({
    homeId: target.home_id,
    actorId: actor?.id ?? null,
    action: 'staff.updated',
    entityType: 'staff',
    entityId: id,
    metadata: { changes: d },
    ipAddress: getIp(req),
  })

  return NextResponse.json(updated)
}
