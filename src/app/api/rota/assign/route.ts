// POST /api/rota/assign
// Creates a rota_shift entry after validating WTR rules
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { checkRules } from '@/lib/rules-engine'
import { writeAuditLog, getIp } from '@/lib/audit'
import { getWeekStart } from '@/lib/utils'

const Schema = z.object({
  shiftId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'shiftDate must be YYYY-MM-DD'),
  unitId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
  override: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const homeId = req.headers.get('x-home-id')
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const { shiftId, staffId, shiftDate, unitId, notes, override } = parsed.data

  const [shift] = await sql`
    SELECT id
    FROM shifts
    WHERE id = ${shiftId}
      AND home_id = ${homeId}
      AND is_active = TRUE
    LIMIT 1
  `
  if (!shift) {
    return NextResponse.json({ error: 'Shift not found for this home' }, { status: 404 })
  }

  // Rules check (only when assigning a specific staff member)
  let violations: import('@/types').RulesViolation[] = []
  if (staffId) {
    const result = await checkRules({ staffId, shiftId, shiftDate, homeId })
    if (!result.valid && !override) {
      return NextResponse.json(
        { error: 'Working time rules violation', violations: result.violations },
        { status: 422 }
      )
    }
    violations = result.violations
  }

  const weekStart = getWeekStart(shiftDate)

  // Get actor staff record
  const [actor] = await sql`
    SELECT id FROM staff WHERE clerk_user_id = ${userId} AND deleted_at IS NULL LIMIT 1
  `
  if (!actor) return NextResponse.json({ error: 'Actor staff record not found' }, { status: 404 })

  // Check for existing non-cancelled assignment on same date+shift
  const [existing] = await sql`
    SELECT id FROM rota_shifts
    WHERE home_id = ${homeId}
      AND shift_id = ${shiftId}
      AND shift_date = ${shiftDate}
      AND status != 'cancelled'
    LIMIT 1
  `
  if (existing) {
    return NextResponse.json(
      { error: 'A shift assignment already exists for this date and shift. Cancel it first.' },
      { status: 409 }
    )
  }

  const [inserted] = await sql`
    INSERT INTO rota_shifts
      (home_id, shift_id, staff_id, unit_id, shift_date, week_start, created_by, notes)
    VALUES
      (${homeId}, ${shiftId}, ${staffId ?? null}, ${unitId ?? null},
       ${shiftDate}, ${weekStart}, ${actor.id}, ${notes ?? null})
    RETURNING *
  `

  await writeAuditLog({
    homeId,
    actorId: actor.id,
    action: 'rota_shift.created',
    entityType: 'rota_shifts',
    entityId: inserted.id,
    metadata: {
      shiftDate,
      staffId,
      override: override && violations.length > 0,
      violations: override ? violations : [],
    },
    ipAddress: getIp(req),
  })

  return NextResponse.json(inserted, { status: 201 })
}
