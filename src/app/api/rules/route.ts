// GET  /api/rules?homeId=  — fetch rules for a home
// POST /api/rules           — create a rule
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const CreateSchema = z.object({
  homeId: z.string().uuid(),
  ruleType: z.enum(['min_rest_hours', 'max_weekly_hours', 'max_consecutive_days']),
  value: z.number().positive(),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const homeId = searchParams.get('homeId') ?? req.headers.get('x-home-id')
  if (!homeId) return NextResponse.json({ error: 'homeId is required' }, { status: 400 })

  const role = req.headers.get('x-user-role')
  const headerHomeId = req.headers.get('x-home-id')
  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rules = await sql`
    SELECT * FROM rules WHERE home_id = ${homeId} ORDER BY rule_type
  `
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const { homeId, ruleType, value } = parsed.data

  const role = req.headers.get('x-user-role')
  const headerHomeId = req.headers.get('x-home-id')
  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  const [rule] = await sql`
    INSERT INTO rules (home_id, rule_type, value)
    VALUES (${homeId}, ${ruleType}, ${value})
    ON CONFLICT (home_id, rule_type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    RETURNING *
  `

  await writeAuditLog({
    homeId,
    actorId: actor?.id ?? null,
    action: 'rules.updated',
    entityType: 'rules',
    entityId: rule.id,
    metadata: { ruleType, value },
    ipAddress: getIp(req),
  })

  return NextResponse.json(rule, { status: 201 })
}
