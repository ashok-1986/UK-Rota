import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const { userId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')
  if (role !== 'system_admin') return authError('FORBIDDEN')

  const body = await req.json()
  const { homeName, homeAddress, managerFirstName, managerLastName, managerEmail, kindeUserId } = body

  if (!homeName || !managerEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    // 1. Create home
    const [home] = await sql`
      INSERT INTO homes (name, address, email)
      VALUES (${homeName}, ${homeAddress ?? null}, ${homeName.toLowerCase().replace(/\s/g, '') + '@example.com'})
      RETURNING id, name
    `

    // 2. Create default shift templates
    await sql`
      INSERT INTO shifts (home_id, name, start_time, end_time, duration_hours, color)
      VALUES
        (${home.id}, 'Early', '07:00:00', '15:00:00', 8, '#3B82F6'),
        (${home.id}, 'Late', '14:00:00', '22:00:00', 8, '#8B5CF6'),
        (${home.id}, 'Night', '22:00:00', '07:00:00', 9, '#6366F1')
    `

    // 3. Create default rules
    await sql`
      INSERT INTO rules (home_id, rule_type, value)
      VALUES
        (${home.id}, 'min_rest_hours', 11),
        (${home.id}, 'max_weekly_hours', 48),
        (${home.id}, 'max_consecutive_days', 6)
    `

    // 4. Create staff record linking to Kinde user
    // TODO Phase 3: create Kinde user via Kinde Management API automatically.
    // For now, the Kinde user must be created manually in Kinde Dashboard and kindeUserId provided.
    const managerKindeId = kindeUserId ?? userId ?? null

    const [staff] = await sql`
      INSERT INTO staff (clerk_user_id, home_id, first_name, last_name, email, role, is_active)
      VALUES (${managerKindeId}, ${home.id}, ${managerFirstName ?? 'Manager'}, ${managerLastName ?? 'User'}, ${managerEmail}, 'home_manager', TRUE)
      RETURNING id
    `

    // TODO Phase 3: update Kinde user custom claims via Kinde Management API
    // to set role: 'home_manager' and homeId: home.id so middleware can read them.

    return NextResponse.json({
      success: true,
      homeId: home.id,
      staffId: staff.id,
      message: 'Home created. Set role=home_manager and homeId in Kinde custom claims for this user.',
    })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Failed to create home', details: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to create a home' })
}
