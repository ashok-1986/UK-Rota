// GET /api/homes  — list homes (system_admin sees all, managers see their own)
// POST /api/homes — system_admin only (use signup-home for full onboarding)
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import type { AppRole } from '@/types'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = req.headers.get('x-user-role') as AppRole
  const homeId = req.headers.get('x-home-id')

  let homes
  if (role === 'system_admin') {
    homes = await sql`SELECT * FROM homes ORDER BY name`
  } else {
    if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })
    homes = await sql`SELECT * FROM homes WHERE id = ${homeId}`
  }

  return NextResponse.json(homes)
}
