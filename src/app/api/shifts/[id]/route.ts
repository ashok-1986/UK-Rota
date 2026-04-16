// PUT /api/shifts/{id} - Update a shift template
// DELETE /api/shifts/{id} - Soft-delete a shift template
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'
import type { AppRole } from '@/types'

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
  if (duration <= 0) duration += 24 // overnight
  return duration
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const homeId = req.headers.get('x-home-id')
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

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
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = req.headers.get('x-user-role') as AppRole
  const headerHomeId = req.headers.get('x-home-id')

  if (!['home_manager', 'system_admin'].includes(role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  // Get current shift
  const [current] = await sql`
    SELECT start_time, end_time FROM shifts WHERE id = ${id} AND home_id = ${headerHomeId} LIMIT 1
  `
  if (!current) return NextResponse.json({ error: 'Shift not found' }, { status: 404 })

  // Use COALESCE pattern like rules API
  const name = d.name ?? null
  const startTime = d.startTime ?? null
  const endTime = d.endTime ?? null
  const color = d.color ?? null
  const isNight = d.isNight ?? null
  const isWeekend = d.isWeekend ?? null
  const isActive = d.isActive ?? null

  // Calculate duration if times are being updated
  let duration: number | null = null
  if (startTime || endTime) {
    const newStart = startTime ?? current.start_time
    const newEnd = endTime ?? current.end_time
    duration = calculateDuration(String(newStart), String(newEnd))
  }

  const [shift] = await sql`
    UPDATE shifts SET
      name = COALESCE(${name}, name),
      start_time = COALESCE(${startTime}, start_time),
      end_time = COALESCE(${endTime}, end_time),
      duration_hours = COALESCE(${duration}, duration_hours),
      color = COALESCE(${color}, color),
      is_night = COALESCE(${isNight}, is_night),
      is_weekend = COALESCE(${isWeekend}, is_weekend),
      is_active = COALESCE(${isActive}, is_active),
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
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = req.headers.get('x-user-role') as AppRole
  const headerHomeId = req.headers.get('x-home-id')

  if (!['home_manager', 'system_admin'].includes(role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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