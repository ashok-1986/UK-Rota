// GET /api/shifts/swaps - List shift swap requests
// POST /api/shifts/swaps - Create a new swap request
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import sql from '@/lib/db'
import type { AppRole } from '@/types'

const CreateSwapSchema = z.object({
  requesterShiftId: z.string().uuid(),
  targetStaffId: z.string().uuid().optional(),
  targetShiftId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
})

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const homeId = req.headers.get('x-home-id')
  const role = req.headers.get('x-user-role') as AppRole
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'pending'

  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  try {
    let swaps
    if (role === 'home_manager' || role === 'unit_manager' || role === 'system_admin') {
      swaps = await sql`
        SELECT 
          ss.id, ss.status, ss.reason, ss.response_note,
          ss.created_at, ss.updated_at,
          s1.id AS requester_staff_id,
          s1.first_name AS requester_first_name,
          s1.last_name AS requester_last_name,
          rs1.shift_date AS requester_shift_date,
          sh1.name AS requester_shift_name,
          s2.id AS target_staff_id,
          s2.first_name AS target_first_name,
          s2.last_name AS target_last_name,
          rs2.shift_date AS target_shift_date,
          sh2.name AS target_shift_name
        FROM shift_swaps ss
        JOIN staff s1 ON s1.id = ss.requester_id
        JOIN rota_shifts rs1 ON rs1.id = ss.requester_shift_id
        JOIN shifts sh1 ON sh1.id = rs1.shift_id
        LEFT JOIN staff s2 ON s2.id = ss.target_id
        LEFT JOIN rota_shifts rs2 ON rs2.id = ss.target_shift_id
        LEFT JOIN shifts sh2 ON sh2.id = rs2.shift_id
        WHERE s1.home_id = ${homeId}
          ${status ? sql`AND ss.status = ${status}` : sql``}
        ORDER BY ss.created_at DESC
      `
    } else {
      swaps = await sql`
        SELECT 
          ss.id, ss.status, ss.reason, ss.response_note,
          ss.created_at, ss.updated_at,
          s1.id AS requester_staff_id,
          s1.first_name AS requester_first_name,
          s1.last_name AS requester_last_name,
          rs1.shift_date AS requester_shift_date,
          sh1.name AS requester_shift_name,
          s2.id AS target_staff_id,
          s2.first_name AS target_first_name,
          s2.last_name AS target_last_name,
          rs2.shift_date AS target_shift_date,
          sh2.name AS target_shift_name
        FROM shift_swaps ss
        JOIN staff s1 ON s1.id = ss.requester_id
        JOIN rota_shifts rs1 ON rs1.id = ss.requester_shift_id
        JOIN shifts sh1 ON sh1.id = rs1.shift_id
        LEFT JOIN staff s2 ON s2.id = ss.target_id
        LEFT JOIN rota_shifts rs2 ON rs2.id = ss.target_shift_id
        LEFT JOIN shifts sh2 ON sh2.id = rs2.shift_id
        WHERE s1.clerk_user_id = ${userId}
          ${status ? sql`AND ss.status = ${status}` : sql``}
        ORDER BY ss.created_at DESC
      `
    }

    return NextResponse.json(swaps)
  } catch (err) {
    console.error('[shifts/swaps] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch swap requests' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const homeId = req.headers.get('x-home-id')
  const role = req.headers.get('x-user-role') as AppRole

  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const body = await req.json()
  const parsed = CreateSwapSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }

  const { requesterShiftId, targetStaffId, targetShiftId, reason } = parsed.data

  try {
    const [requester] = await sql`
      SELECT id, first_name, last_name FROM staff 
      WHERE clerk_user_id = ${userId} AND home_id = ${homeId} AND is_active = TRUE
      LIMIT 1
    `
    if (!requester) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const [shift] = await sql`
      SELECT id, staff_id, shift_date FROM rota_shifts 
      WHERE id = ${requesterShiftId} AND home_id = ${homeId}
      LIMIT 1
    `
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }
    if (shift.staff_id !== requester.id) {
      return NextResponse.json({ error: 'Not your shift' }, { status: 403 })
    }

    const [swap] = await sql`
      INSERT INTO shift_swaps (requester_id, target_id, requester_shift_id, target_shift_id, reason)
      VALUES (${requester.id}, ${targetStaffId ?? null}, ${requesterShiftId}, ${targetShiftId ?? null}, ${reason ?? null})
      RETURNING *
    `

    return NextResponse.json(swap, { status: 201 })
  } catch (err) {
    console.error('[shifts/swaps] Error:', err)
    return NextResponse.json({ error: 'Failed to create swap request' }, { status: 500 })
  }
}