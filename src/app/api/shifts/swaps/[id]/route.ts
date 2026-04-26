// GET /api/shifts/swaps/[id] - Get single swap request
// PUT /api/shifts/swaps/[id] - Approve/reject/cancel swap request
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const UpdateSwapSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
  responseNote: z.string().max(500).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { role, homeId } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const { id } = await params

  const [swap] = await sql`
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
    WHERE ss.id = ${id}
    LIMIT 1
  `

  if (!swap) {
    return NextResponse.json({ error: 'Swap request not found' }, { status: 404 })
  }

  return NextResponse.json(swap)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, homeId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const { id } = await params

  const body = await req.json()
  const parsed = UpdateSwapSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }

  const { status, responseNote } = parsed.data

  try {
    const [swap] = await sql`
      SELECT id, requester_id, target_id, requester_shift_id, target_shift_id, status
      FROM shift_swaps ss
      JOIN staff s ON s.id = ss.requester_id
      WHERE ss.id = ${id} AND s.home_id = ${homeId}
      LIMIT 1
    `
    if (!swap) {
      return NextResponse.json({ error: 'Swap request not found' }, { status: 404 })
    }

    const [reviewer] = await sql`SELECT id FROM staff WHERE clerk_user_id = ${userId ?? ''} AND home_id = ${homeId} LIMIT 1`

    if (status === 'approved') {
      if (swap.target_shift_id) {
        await sql`
          UPDATE rota_shifts SET staff_id = ${swap.target_id}, updated_at = NOW()
          WHERE id = ${swap.requester_shift_id}
        `
        await sql`
          UPDATE rota_shifts SET staff_id = ${swap.requester_id}, updated_at = NOW()
          WHERE id = ${swap.target_shift_id}
        `
      } else {
        await sql`
          UPDATE rota_shifts SET staff_id = ${null}, updated_at = NOW()
          WHERE id = ${swap.requester_shift_id}
        `
      }
    }

    const [updated] = await sql`
      UPDATE shift_swaps 
      SET status = ${status}, response_note = ${responseNote ?? null}, 
          reviewed_by = ${reviewer?.id ?? null}, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    await writeAuditLog({
      homeId,
      actorId: reviewer?.id ?? null,
      action: `shift.swap.${status}`,
      entityType: 'shift_swaps',
      entityId: id,
      metadata: { responseNote },
      ipAddress: getIp(req),
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[shifts/swaps/[id]] Error:', err)
    return NextResponse.json({ error: 'Failed to update swap request' }, { status: 500 })
  }
}