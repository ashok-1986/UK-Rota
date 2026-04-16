// PUT /api/rules/[id] — update a rule value or toggle active
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const Schema = z.object({
  value: z.number().positive().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [rule] = await sql`SELECT * FROM rules WHERE id = ${id} LIMIT 1`
  if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  const role = req.headers.get('x-user-role')
  const homeId = req.headers.get('x-home-id')
  if (role !== 'system_admin' && rule.home_id !== homeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const { value, isActive } = parsed.data

  const [updated] = await sql`
    UPDATE rules SET
      value      = COALESCE(${value ?? null}, value),
      is_active  = COALESCE(${isActive ?? null}, is_active),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId: rule.home_id,
    actorId: actor?.id ?? null,
    action: 'rules.updated',
    entityType: 'rules',
    entityId: id,
    metadata: { ruleType: rule.rule_type, oldValue: rule.value, newValue: value, isActive },
    ipAddress: getIp(req),
  })

  return NextResponse.json(updated)
}
