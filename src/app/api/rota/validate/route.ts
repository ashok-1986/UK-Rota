// POST /api/rota/validate — validates a potential shift assignment against WTR rules
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import { checkRules } from '@/lib/rules-engine'

const Schema = z.object({
  staffId: z.string().uuid(),
  shiftId: z.string().uuid(),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'shiftDate must be YYYY-MM-DD'),
})

export async function POST(req: NextRequest) {
  const { homeId } = getSessionFromHeaders(req.headers)
  if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', issues: parsed.error.flatten() }, { status: 400 })
  }
  const { staffId, shiftId, shiftDate } = parsed.data

  const result = await checkRules({ staffId, shiftId, shiftDate, homeId })

  return NextResponse.json(result)
}
