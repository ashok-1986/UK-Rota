// GET  /api/rules?homeId=  — fetch rules for a home (returns HomeRules object)
// POST /api/rules           — upsert default 3 rules for a home
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { parseRules } from '@/lib/rules'
import { writeAuditLog, getIp } from '@/lib/audit'

const CreateSchema = z.object({
  homeId: z.string().uuid(),
  minRestHours: z.number().positive().optional(),
  maxWeeklyHours: z.number().positive().optional(),
  maxConsecutiveDays: z.number().positive().optional(),
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

  const rows = await sql`
    SELECT rule_type, value FROM rules
    WHERE home_id = ${homeId} AND is_active = TRUE
    ORDER BY rule_type
  ` as { rule_type: string; value: number }[]

  return NextResponse.json(parseRules(rows))
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const {
    homeId,
    minRestHours = 11,
    maxWeeklyHours = 48,
    maxConsecutiveDays = 6,
  } = parsed.data

  const role = req.headers.get('x-user-role')
  const headerHomeId = req.headers.get('x-home-id')
  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await sql`
    INSERT INTO rules (home_id, rule_type, value)
    VALUES
      (${homeId}, 'min_rest_hours', ${minRestHours}),
      (${homeId}, 'max_weekly_hours', ${maxWeeklyHours}),
      (${homeId}, 'max_consecutive_days', ${maxConsecutiveDays})
    ON CONFLICT (home_id, rule_type)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `

  const rows = await sql`
    SELECT rule_type, value
    FROM rules
    WHERE home_id = ${homeId}
      AND is_active = TRUE
    ORDER BY rule_type
  ` as { rule_type: string; value: number }[]

  await writeAuditLog({
    homeId,
    actorId: actor?.id ?? null,
    action: 'rules.updated',
    entityType: 'rules',
    entityId: null,
    metadata: { minRestHours, maxWeeklyHours, maxConsecutiveDays },
    ipAddress: getIp(req),
  })

  return NextResponse.json(parseRules(rows), { status: 201 })
}
