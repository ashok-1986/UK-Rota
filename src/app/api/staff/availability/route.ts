// GET /api/staff/availability?staffId= — get staff availability
// POST /api/staff/availability — set availability
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'

const SetAvailabilitySchema = z.object({
  staffId: z.string().uuid(),
  unavailableDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
})

export async function GET(req: NextRequest) {
  const { userId, homeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  const { searchParams } = new URL(req.url)
  const staffId = searchParams.get('staffId')

  if (!staffId || !homeId) {
    return NextResponse.json({ error: 'staffId and homeId required' }, { status: 400 })
  }

  // Staff can only view their own availability
  if (role === 'care_staff' || role === 'bank_staff') {
    const [staff] = await sql`SELECT clerk_user_id FROM staff WHERE id = ${staffId} AND home_id = ${homeId} LIMIT 1`
    if (!staff || staff.clerk_user_id !== userId) {
      return authError('FORBIDDEN')
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const future = new Date()
  future.setDate(future.getDate() + 90)
  const futureStr = future.toISOString().slice(0, 10)

  const availability = await sql`
    SELECT date::text as date, reason
    FROM staff_availability
    WHERE staff_id = ${staffId}
      AND date >= ${today}
      AND date <= ${futureStr}
    ORDER BY date
  `

  return NextResponse.json(availability)
}

export async function POST(req: NextRequest) {
  const { userId, homeId, role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const body = await req.json()
  const parsed = SetAvailabilitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }

  const { staffId, unavailableDates } = parsed.data

  const [staff] = await sql`
    SELECT id, clerk_user_id FROM staff
    WHERE id = ${staffId} AND home_id = ${homeId} AND is_active = TRUE AND deleted_at IS NULL
    LIMIT 1
  `
  if (!staff) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
  }

  if ((role === 'care_staff' || role === 'bank_staff') && staff.clerk_user_id !== userId) {
    return authError('FORBIDDEN')
  }

  const today = new Date().toISOString().slice(0, 10)

  await sql`
    DELETE FROM staff_availability
    WHERE staff_id = ${staffId} AND date >= ${today}
  `

  if (unavailableDates.length > 0) {
    for (const date of unavailableDates) {
      await sql`
        INSERT INTO staff_availability (staff_id, date, reason)
        VALUES (${staffId}, ${date}, 'unavailable')
      `
    }
  }

  return NextResponse.json({
    success: true,
    staffId,
    unavailableDates,
    message: `Availability updated for ${unavailableDates.length} dates`,
  })
}
