import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'

// POST /api/setup/first-home - Create first home and link current user as manager
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized - must be signed in' }, { status: 401 })
  }

  // Check if any homes exist
  const [existingHome] = await sql`SELECT id FROM homes LIMIT 1`
  if (existingHome) {
    return NextResponse.json({ error: 'Home already exists. Use /api/staff to add users.' }, { status: 400 })
  }

  const body = await req.json()
  const { homeName, homeAddress } = body

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

    // 4. Get user info from Clerk
    const clerk = await clerkClient()
    let userEmail = 'admin@carehome.co.uk'
    let userFirstName = 'Manager'
    let userLastName = ''

    try {
      const user = await clerk.users.getUser(userId)
      userEmail = user.emailAddresses[0]?.emailAddress ?? userEmail
      userFirstName = user.firstName ?? userFirstName
      userLastName = user.lastName ?? ''
    } catch (e) {
      console.warn('Could not fetch Clerk user details')
    }

    // 5. Create staff record
    const [staff] = await sql`
      INSERT INTO staff (clerk_user_id, home_id, first_name, last_name, email, role, is_active)
      VALUES (${userId}, ${home.id}, ${userFirstName}, ${userLastName}, ${userEmail}, 'home_manager', TRUE)
      RETURNING id
    `

    // 6. Update Clerk user metadata
    try {
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          role: 'home_manager',
          home_id: home.id,
          homeId: home.id,
        },
      })
    } catch (e) {
      console.error('Failed to update Clerk metadata:', e)
    }

    return NextResponse.json({
      success: true,
      homeId: home.id,
      homeName: home.name,
      staffId: staff.id,
      message: 'Home created and linked to your account. Please refresh.',
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
