// POST /api/webhooks/kinde — handle Kinde webhook events
// Kinde sends webhooks as JWTs signed with RS256.
// Verification uses Kinde's public JWKS endpoint.
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import sql from '@/lib/db'
import { addUserToOrg } from '@/lib/kinde-mgmt'
import { writeAuditLog } from '@/lib/audit'

export const runtime = 'nodejs'

// Module-scope: jose caches the JWKS keys automatically
const JWKS = createRemoteJWKSet(
    new URL('https://alchemetryx.kinde.com/.well-known/jwks')
)

interface KindeWebhookPayload {
    type: string
    data: {
        user: {
            id: string
            email: string
            first_name?: string
            last_name?: string
        }
    }
}

export async function POST(request: NextRequest) {
    // 1. Read raw body — Kinde sends content-type: application/jwt
    const token = await request.text()

    // 2. Verify JWT using Kinde's JWKS
    let payload: KindeWebhookPayload
    try {
        const result = await jwtVerify(token, JWKS)
        payload = result.payload as unknown as KindeWebhookPayload
    } catch (err) {
        console.error('[kinde-webhook] JWT verification failed:', err)
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }

    // 3. DEBUG — log full decoded payload to confirm exact Kinde field structure
    // TODO: Remove this after first successful test
    console.log('[kinde-webhook] === RAW DECODED PAYLOAD ===')
    console.log(JSON.stringify(payload, null, 2))
    console.log('[kinde-webhook] === END PAYLOAD ===')

    // 4. Extract event type
    const eventType = payload.type ?? (payload as unknown as Record<string, unknown>).event_type as string ?? 'unknown'
    console.log(`[kinde-webhook] Resolved event type: ${eventType}`)

    // 4. Handle user.created
    if (eventType === 'user.created') {
        const user = payload.data?.user
        if (!user?.email) {
            console.warn('[kinde-webhook] user.created event missing email, skipping')
            return NextResponse.json({ received: true })
        }

        const kindeUserId = user.id
        const email = user.email.toLowerCase()
        const firstName = user.first_name ?? ''
        const lastName = user.last_name ?? ''

        // Check for a pending invite matching this email
        const invites = await sql`
      SELECT *
      FROM staff_invites
      WHERE LOWER(email) = ${email}
        AND status = 'pending'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `

        if (invites.length > 0) {
            const invite = invites[0]
            const homeId = invite.home_id as string
            const role = invite.role as string

            // Create or update staff record
            const staffRows = await sql`
        INSERT INTO staff (
          kinde_user_id, home_id, email, first_name, last_name, role,
          employment_type, max_hours_week, is_active
        ) VALUES (
          ${kindeUserId},
          ${homeId},
          ${email},
          ${firstName},
          ${lastName},
          ${role},
          'full_time',
          48,
          TRUE
        )
        ON CONFLICT (email, home_id)
          WHERE deleted_at IS NULL
        DO UPDATE SET
          kinde_user_id = EXCLUDED.kinde_user_id,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          updated_at = NOW()
        RETURNING id
      `

            const staffId = staffRows[0]?.id as string

            // Add user to their Kinde org
            const kindeRoleMap: Record<string, 'admin' | 'member'> = {
                home_manager: 'admin',
                unit_manager: 'member',
                care_staff: 'member',
                bank_staff: 'member',
            }
            const [home] = await sql`
              SELECT kinde_org_code FROM homes WHERE id = ${homeId} LIMIT 1
            `
            if (home?.kinde_org_code) {
                try {
                    await addUserToOrg(
                        kindeUserId,
                        home.kinde_org_code as string,
                        kindeRoleMap[role] ?? 'member'
                    )
                } catch (err) {
                    console.error('[kinde-webhook] addUserToOrg failed (non-fatal):', err)
                }
            }

            // Mark invite as accepted
            await sql`
        UPDATE staff_invites
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = ${invite.id}
      `

            // Audit log
            writeAuditLog({
                homeId,
                actorId: kindeUserId,
                action: 'staff.created_via_kinde_webhook',
                entityType: 'staff_invite',
                entityId: invite.id as string,
                metadata: { staffId, email, role },
            })

            console.log(
                `[kinde-webhook] Auto-accepted invite for ${email} → staff ${staffId} at home ${homeId}`
            )
        } else {
            console.log(
                `[kinde-webhook] No pending invite for: ${email} (${kindeUserId})`
            )
        }

        return NextResponse.json({ received: true })
    }

    // Unknown event type — acknowledge but don't process
    console.log(`[kinde-webhook] Unhandled event type: ${eventType}`)
    return NextResponse.json({ received: true, unhandled: eventType }, { status: 200 })
}
