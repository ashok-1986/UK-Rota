// GET /api/shifts?homeId= — list shift templates for a home
// POST /api/shifts — create a new shift template
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const CreateSchema = z.object({
  homeId: z.string().uuid(),
  name: z.string().min(1).max(100),
  startTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'HH:mm format'),
  endTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'HH:mm format'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isNight: z.boolean().optional(),
  isWeekend: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const { homeId } = await getSessionFromHeaders(req.headers)
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const shifts = await sql`
    SELECT id, home_id, name, start_time::text AS start_time, end_time::text AS end_time,
           duration_hours, color, is_night, is_weekend, is_active, created_at, updated_at
    FROM shifts
    WHERE home_id = ${homeId} AND is_active = TRUE
    ORDER BY start_time
  `

  return NextResponse.json(shifts)
}

export async function POST(req: NextRequest) {
  const { userId, homeId: headerHomeId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  if (!['home_manager', 'system_admin'].includes(role)) {
    return authError('FORBIDDEN')
  }

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }

  const { homeId, name, startTime, endTime, color, isNight, isWeekend } = parsed.data

  if (role !== 'system_admin' && homeId !== headerHomeId) {
    return authError('FORBIDDEN')
  }

  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  let duration = (endH + endM / 60) - (startH + startM / 60)
  if (duration <= 0) duration += 24

  const [shift] = await sql`
    INSERT INTO shifts (home_id, name, start_time, end_time, duration_hours, color, is_night, is_weekend)
    VALUES (${homeId}, ${name}, ${startTime}, ${endTime}, ${duration}, ${color ?? '#3B82F6'}, ${isNight ?? false}, ${isWeekend ?? false})
    RETURNING *
  `

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId,
    actorId: actor?.id ?? null,
    action: 'shift.created',
    entityType: 'shifts',
    entityId: shift.id,
    metadata: { name, startTime, endTime, duration },
    ipAddress: getIp(req),
  })

  return NextResponse.json(shift, { status: 201 })
}
