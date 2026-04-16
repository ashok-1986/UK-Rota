import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { clerkClient } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { homeName, homeAddress, managerFirstName, managerLastName, managerEmail, managerPassword } = body

  if (!homeName || !managerEmail || !managerPassword) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const clerk = await clerkClient()

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

    // 4. Create Clerk user for manager
    let clerkUserId = userId
    try {
      const user = await clerk.users.getUser(userId)
      clerkUserId = user.id
    } catch {
      // Use current user
    }

    // 5. Create staff record linking to Clerk user
    const [staff] = await sql`
      INSERT INTO staff (clerk_user_id, home_id, first_name, last_name, email, role, is_active)
      VALUES (${clerkUserId}, ${home.id}, ${managerFirstName ?? 'Manager'}, ${managerLastName ?? 'User'}, ${managerEmail}, 'home_manager', TRUE)
      RETURNING id
    `

    // 6. Update Clerk metadata with homeId
    try {
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          role: 'home_manager',
          homeId: home.id,
        },
      })
    } catch (err) {
      console.error('Failed to update Clerk metadata:', err)
    }

    return NextResponse.json({
      success: true,
      homeId: home.id,
      staffId: staff.id,
      message: 'Home created successfully',
    })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ error: 'Failed to create home', details: String(err) }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to create a home' })
}