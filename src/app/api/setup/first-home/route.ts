import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'
import sql from '@/lib/db'

// POST /api/setup/first-home - Create first home and link current user as manager
export async function POST(req: NextRequest) {
  const { userId, role } = await getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  // Check if any homes exist
  const [existingHome] = await sql`SELECT id FROM homes LIMIT 1`
  if (existingHome) {
    return NextResponse.json({ error: 'Home already exists. Use /api/staff to add users.' }, { status: 400 })
  }

  const body = await req.json()
  const { homeName, homeAddress, firstName, lastName, email } = body

  try {
    // 1. Create home
    const [home] = await sql`
      INSERT INTO homes (name, address, email)
      VALUES (${homeName ?? 'My Care Home'}, ${homeAddress ?? null}, 'admin@carehome.co.uk')
      RETURNING id, name
    `

    // 2. Create default shift templates
    await sql`
      INSERT INTO shifts (home_id, name, start_time, end_time, duration_hours, color, is_night, is_weekend)
      VALUES
        (${home.id}, 'Early', '07:00:00', '15:00:00', 8, '#3B82F6', FALSE, FALSE),
        (${home.id}, 'Late', '14:00:00', '22:00:00', 8, '#8B5CF6', FALSE, FALSE),
        (${home.id}, 'Night', '22:00:00', '07:00:00', 9, '#6366F1', TRUE, FALSE)
    `

    // 3. Create default rules
    await sql`
      INSERT INTO rules (home_id, rule_type, value)
      VALUES
        (${home.id}, 'min_rest_hours', 11),
        (${home.id}, 'max_weekly_hours', 48),
        (${home.id}, 'max_consecutive_days', 6)
    `

    // 4. Create staff record linked to current Kinde user
    // firstName/lastName/email can be passed in body; caller should provide these
    // since we no longer call Kinde Management API to fetch user details here.
    const [staff] = await sql`
      INSERT INTO staff (kinde_user_id, home_id, first_name, last_name, email, role, is_active)
      VALUES (${userId ?? null}, ${home.id}, ${firstName ?? 'Manager'}, ${lastName ?? ''}, ${email ?? 'admin@carehome.co.uk'}, 'home_manager', TRUE)
      RETURNING id
    `

    // TODO Phase 3: update Kinde user custom claims via Kinde Management API
    // to set role: 'home_manager' and homeId: home.id so middleware can read them.

    return NextResponse.json({
      success: true,
      homeId: home.id,
      homeName: home.name,
      staffId: staff.id,
      message: 'Home created. Set role=home_manager and homeId in Kinde custom claims for this user, then refresh.',
    })
  } catch (err) {
    console.error('Setup error:', err)
    return NextResponse.json({ error: 'Setup failed', details: String(err) }, { status: 500 })
  }
}

// GET - Check if setup is needed
export async function GET() {
  const [home] = await sql`SELECT id FROM homes LIMIT 1`
  return NextResponse.json({ needsSetup: !home })
}
