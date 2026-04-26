// GET  /api/rules?homeId= — fetch rules for a home
// POST /api/rules         — upsert a single rule
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { parseRules } from '@/lib/rules'
import { writeAuditLog, getIp } from '@/lib/audit'

const CreateSchema = z.object({
  homeId: z.string().uuid(),
  ruleType: z.enum(['min_rest_hours', 'max_weekly_hours', 'max_consecutive_days']),
  value: z.number().positive(),
})

export async function GET(req: NextRequest) {
  const { homeId: headerHomeId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const { searchParams } = new URL(req.url)
  const homeId = searchParams.get('homeId') ?? headerHomeId
  if (!homeId) return NextResponse.json({ error: 'homeId is required' }, { status: 400 })

  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return authError('FORBIDDEN')
  }

  const rows = await sql`
    SELECT rule_type, value FROM rules
    WHERE home_id = ${homeId} AND is_active = TRUE
    ORDER BY rule_type
  ` as { rule_type: string; value: number }[]

  return NextResponse.json(parseRules(rows))
}

export async function POST(req: NextRequest) {
  const { userId, homeId: headerHomeId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const { homeId, ruleType, value } = parsed.data

  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return authError('FORBIDDEN')
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
