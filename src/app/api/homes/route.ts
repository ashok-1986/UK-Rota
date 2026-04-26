// GET /api/homes — list homes (system_admin sees all, managers see their own)
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { homeId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  let homes
  if (role === 'system_admin') {
    homes = await sql`SELECT * FROM homes ORDER BY name`
  } else {
    if (!homeId) return NextResponse.json({ error: 'No home context' }, { status: 400 })
    homes = await sql`SELECT * FROM homes WHERE id = ${homeId}`
  }

  return NextResponse.json(homes)
}
