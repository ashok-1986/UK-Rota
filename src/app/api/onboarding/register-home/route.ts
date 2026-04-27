// POST /api/onboarding/register-home
// Creates a new care home with Kinde org, default shifts, WTR rules, manager staff record.
// Auth: ONBOARDING_SECRET header OR system_admin session.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getKindeAuth } from '@/lib/auth'
import { createKindeOrg, addUserToOrg } from '@/lib/kinde-mgmt'
import sql from '@/lib/db'
import { writeAuditLog, getIp } from '@/lib/audit'

const RegisterSchema = z.object({
    homeName: z.string().min(2).max(255),
    homeAddress: z.string().optional(),
    homeEmail: z.string().email(),
    managerFirstName: z.string().min(1),
    managerLastName: z.string().min(1),
    managerEmail: z.string().email(),
    managerKindeUserId: z.string().min(1),
})

export async function POST(req: NextRequest) {
    // --- Auth ---
    const onboardingSecret = process.env.ONBOARDING_SECRET
    const headerSecret = req.headers.get('x-onboarding-secret')

    const hasSecretAuth = onboardingSecret && headerSecret === onboardingSecret

    if (!hasSecretAuth) {
        // Fall back to system_admin session
        const auth = await getKindeAuth()
        if (!auth || auth.role !== 'system_admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    // --- Parse body ---
    let d: z.infer<typeof RegisterSchema>
    try {
        d = RegisterSchema.parse(await req.json())
    } catch (err) {
        const detail = err instanceof z.ZodError ? err.flatten().fieldErrors : 'Invalid body'
        return NextResponse.json({ error: detail }, { status: 400 })
    }

    // Step 1: Duplicate check
    const [existing] = await sql`
    SELECT id FROM homes WHERE email = ${d.homeEmail} LIMIT 1
  `
    if (existing) {
        return NextResponse.json(
            { error: 'A home with this email already exists' },
            { status: 409 }
        )
    }

    // Step 2: Create Kinde org
    let orgCode: string
    try {
        const org = await createKindeOrg(d.homeName)
        orgCode = org.orgCode
    } catch (err) {
        console.error('[register-home] createKindeOrg failed:', err)
        return NextResponse.json({ error: 'Failed to create Kinde organisation' }, { status: 500 })
    }

    // Step 3: Insert home
    let homeId: string
    try {
        const [home] = await sql`
      INSERT INTO homes (name, address, email, kinde_org_code)
      VALUES (${d.homeName}, ${d.homeAddress ?? null}, ${d.homeEmail}, ${orgCode})
      RETURNING id
    `
        homeId = home.id as string
    } catch (err) {
        console.error('[register-home] homes insert failed:', err)
        return NextResponse.json({ error: 'Failed to create home record' }, { status: 500 })
    }

    // Steps 4–7: Seed data — rollback home on any failure
    try {
        // Step 4: Default shifts
        await sql`
      INSERT INTO shifts (home_id, name, start_time, end_time, duration_hours, color, is_night)
      VALUES
        (${homeId}, 'Early', '07:00', '15:00', 8.0, '#3B82F6', false),
        (${homeId}, 'Late',  '14:00', '22:00', 8.0, '#10B981', false),
        (${homeId}, 'Night', '22:00', '07:00', 9.0, '#6366F1', true)
    `

        // Step 5: Default WTR rules
        await sql`
      INSERT INTO rules (home_id, rule_type, value)
      VALUES
        (${homeId}, 'min_rest_hours',      11),
        (${homeId}, 'max_hours_week',       48),
        (${homeId}, 'max_consecutive_days', 6)
      ON CONFLICT (home_id, rule_type) DO NOTHING
    `

        // Step 6: Manager staff record
        await sql`
      INSERT INTO staff (kinde_user_id, home_id, email, first_name, last_name, role, employment_type)
      VALUES (
        ${d.managerKindeUserId}, ${homeId},
        ${d.managerEmail}, ${d.managerFirstName}, ${d.managerLastName},
        'home_manager', 'full_time'
      )
      ON CONFLICT (email) DO UPDATE SET
        kinde_user_id  = EXCLUDED.kinde_user_id,
        home_id        = EXCLUDED.home_id,
        role           = EXCLUDED.role,
        updated_at     = NOW()
    `

        // Step 7: Add manager to Kinde org as admin
        await addUserToOrg(d.managerKindeUserId, orgCode, 'admin')

    } catch (err) {
        console.error('[register-home] seeding failed, rolling back home:', err)
        // Rollback: delete the home (cascades shifts, rules)
        try {
            await sql`DELETE FROM homes WHERE id = ${homeId}`
        } catch (rbErr) {
            console.error('[register-home] rollback failed:', rbErr)
        }
        return NextResponse.json(
            { error: 'Registration failed during setup. Please try again.' },
            { status: 500 }
        )
    }

    // Step 8: Audit log
    writeAuditLog({
        homeId,
        actorId: null,
        action: 'tenant.registered',
        entityType: 'home',
        entityId: homeId,
        metadata: { homeName: d.homeName, orgCode, managerEmail: d.managerEmail },
        ipAddress: getIp(req),
    })

    return NextResponse.json(
        { homeId, orgCode, message: 'Home registered successfully' },
        { status: 201 }
    )
}
