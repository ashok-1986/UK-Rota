// PUT /api/shifts/{id} — update a shift template
// DELETE /api/shifts/{id} — soft-delete a shift template
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  startTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  isNight: z.boolean().optional(),
  isWeekend: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

function calculateDuration(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)
  let duration = (endH + endM / 60) - (startH + startM / 60)
  if (duration <= 0) duration += 24
  return duration
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { homeId } = getSessionFromHeaders(req.headers)
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const { id } = await params

  const [shift] = await sql`
    SELECT id, home_id, name, start_time::text AS start_time, end_time::text AS end_time,
           duration_hours, color, is_night, is_weekend, is_active, created_at, updated_at
    FROM shifts
    WHERE id = ${id} AND home_id = ${homeId}
    LIMIT 1
  `

  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  return NextResponse.json(shift)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, homeId: headerHomeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  if (!['home_manager', 'system_admin'].includes(role)) {
    return authError('FORBIDDEN')
  }

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  const [current] = await sql`
    SELECT start_time, end_time FROM shifts WHERE id = ${id} AND home_id = ${headerHomeId} LIMIT 1
  `
  if (!current) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  let duration: number | null = null
  if (d.startTime || d.endTime) {
    const newStart = d.startTime ?? current.start_time
    const newEnd = d.endTime ?? current.end_time
    duration = calculateDuration(String(newStart), String(newEnd))
  }

  const [shift] = await sql`
    UPDATE shifts SET
      name = COALESCE(${d.name ?? null}, name),
      start_time = COALESCE(${d.startTime ?? null}, start_time),
      end_time = COALESCE(${d.endTime ?? null}, end_time),
      duration_hours = COALESCE(${duration}, duration_hours),
      color = COALESCE(${d.color ?? null}, color),
      is_night = COALESCE(${d.isNight ?? null}, is_night),
      is_weekend = COALESCE(${d.isWeekend ?? null}, is_weekend),
      is_active = COALESCE(${d.isActive ?? null}, is_active),
      updated_at = NOW()
    WHERE id = ${id} AND home_id = ${headerHomeId}
    RETURNING *
  `

  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId: headerHomeId!,
    actorId: actor?.id ?? null,
    action: 'shift.updated',
    entityType: 'shifts',
    entityId: shift.id,
    metadata: d,
    ipAddress: getIp(req),
  })

  return NextResponse.json(shift)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, homeId: headerHomeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  if (!['home_manager', 'system_admin'].includes(role)) {
    return authError('FORBIDDEN')
  }

  const { id } = await params

  const [shift] = await sql`
    UPDATE shifts SET is_active = FALSE, updated_at = NOW()
    WHERE id = ${id} AND home_id = ${headerHomeId}
    RETURNING id
  `

  if (!shift) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  const [actor] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId} LIMIT 1`

  await writeAuditLog({
    homeId: headerHomeId!,
    actorId: actor?.id ?? null,
    action: 'shift.deleted',
    entityType: 'shifts',
    entityId: shift.id,
    ipAddress: getIp(req),
  })

  return NextResponse.json({ message: 'Shift deleted' })
}
