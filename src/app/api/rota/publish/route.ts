// POST /api/rota/publish — bulk-publish draft shifts for a week
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'
import { validateWeekStart } from '@/lib/utils'
import { sendGapAlert } from '@/lib/notify'
import { checkRules } from '@/lib/rules-engine'

const Schema = z.object({
  homeId: z.string().uuid(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(req: NextRequest) {
  const { userId, homeId: headerHomeId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  if (!['home_manager', 'system_admin'].includes(role)) {
    return authError('FORBIDDEN')
  }

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const { homeId, weekStart } = parsed.data
  const override = body.override === true

  try {
    validateWeekStart(weekStart)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return authError('FORBIDDEN')
  }

  const draftShifts = await sql`
    SELECT rs.id, rs.staff_id, rs.shift_id, rs.shift_date::text AS shift_date,
           s.duration_hours::text AS duration_hours
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    WHERE rs.home_id = ${homeId}
      AND rs.week_start = ${weekStart}
      AND rs.status = 'draft'
      AND rs.staff_id IS NOT NULL
  `

  const ruleViolations: { shiftId: string; staffId: string; violations: { rule: string; message: string }[] }[] = []

  for (const shift of draftShifts as { id: string; staff_id: string; shift_id: string; shift_date: string }[]) {
    const validation = await checkRules({
      staffId: shift.staff_id,
      shiftId: shift.shift_id,
      shiftDate: shift.shift_date,
      homeId,
    })
    if (!validation.valid) {
      ruleViolations.push({
        shiftId: shift.id,
        staffId: shift.staff_id,
        violations: validation.violations.map(v => ({ rule: v.rule, message: v.message })),
      })
    }
  }

  if (ruleViolations.length > 0 && !override) {
    return NextResponse.json({
      error: 'Rules validation failed',
      code: 'RULES_VIOLATIONS',
      violations: ruleViolations,
      message: 'Some shift assignments violate working time regulations. Set override=true to publish anyway.',
    }, { status: 409 })
  }

  const result = await sql`
    UPDATE rota_shifts
    SET status = 'published', updated_at = NOW()
    WHERE home_id = ${homeId}
      AND week_start = ${weekStart}
      AND status = 'draft'
    RETURNING id
  `

  const publishedCount = result.length

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId,
    actorId: actor?.id ?? null,
    action: 'rota.published',
    entityType: 'rota_shifts',
    entityId: null,
    metadata: { weekStart, publishedCount, rulesOverride: override, violationsCount: ruleViolations.length },
    ipAddress: getIp(req),
  })

  const unfilledRows = await sql`
    SELECT rs.*, s.name AS shift_name, s.start_time::text AS shift_start_time,
           s.end_time::text AS shift_end_time, s.duration_hours, s.color
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    WHERE rs.home_id = ${homeId}
      AND rs.week_start = ${weekStart}
      AND rs.staff_id IS NULL
      AND rs.status = 'published'
  `

  if (unfilledRows.length > 0) {
    const managers = await sql`
      SELECT email FROM staff
      WHERE home_id = ${homeId}
        AND role = 'home_manager'
        AND is_active = TRUE
        AND deleted_at IS NULL
    `
    for (const manager of managers) {
      try {
        await sendGapAlert(manager.email, homeId, weekStart, unfilledRows.length)
      } catch (err) {
        console.error('[publish] Gap alert failed:', err)
      }
    }
  }

  return NextResponse.json({ published: publishedCount, unfilled: unfilledRows.length })
}
