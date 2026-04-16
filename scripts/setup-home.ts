// One-time setup script to create home and link user
// Run: npx tsx scripts/setup-home.ts
import { clerkClient } from '@clerk/nextjs/server'
import sql from '../src/lib/db'

async function setup() {
  console.log('🔧 Setting up CareRota home...\n')

  // Get your Clerk user ID (you need to provide this or get it from the error)
  // For now, let's create the home first
  
  const homeName = 'Alchemetryx Care Home'
  const homeAddress = 'UK'

  // 1. Create home
  console.log('1️⃣ Creating home...')
  const [home] = await sql`
    INSERT INTO homes (name, address, email)
    VALUES (${homeName}, ${homeAddress}, 'admin@alchemetryx.com')
    RETURNING id, name
  `
  console.log(`   ✅ Home created: ${home.name} (ID: ${home.id})`)

  // 2. Create default shift templates
  console.log('2️⃣ Creating shift templates...')
  await sql`
    INSERT INTO shifts (home_id, name, start_time, end_time, duration_hours, color)
    VALUES 
      (${home.id}, 'Early', '07:00:00', '15:00:00', 8, '#3B82F6'),
      (${home.id}, 'Late', '14:00:00', '22:00:00', 8, '#8B5CF6'),
      (${home.id}, 'Night', '22:00:00', '07:00:00', 9, '#6366F1')
  `
  console.log('   ✅ Shifts created: Early, Late, Night')

  // 3. Create default rules
  console.log('3️⃣ Creating rules...')
  await sql`
    INSERT INTO rules (home_id, rule_type, value)
    VALUES 
      (${home.id}, 'min_rest_hours', 11),
      (${home.id}, 'max_weekly_hours', 48),
      (${home.id}, 'max_consecutive_days', 6)
  `
  console.log('   ✅ Rules created: WTR compliant')

  // 4. Create staff record (we'll link it later after we get your Clerk ID)
  console.log('4️⃣ Setup complete!')

  console.log('\n📋 Next steps:')
  console.log('   1. Go to Clerk Dashboard → Users')
  console.log('   2. Find your user and edit public_metadata')
  console.log('   3. Set: { "role": "home_manager", "homeId": "' + home.id + '" }')
  console.log('   4. Or call /api/auth/signup-home with your user credentials')

  console.log('\n📝 Home ID to use:', home.id)
}

setup().catch(console.error)