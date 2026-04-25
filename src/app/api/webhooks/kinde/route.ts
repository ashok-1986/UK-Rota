// POST /api/webhooks/kinde — handle Kinde webhook events
// Verify HMAC SHA256 signature, then process user.created events
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import sql from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'

// Disable body parsing — we need the raw body for HMAC verification
export const runtime = 'nodejs'

interface KindeUserCreatedPayload {
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

function verifySignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.KINDE_WEBHOOK_SECRET
    if (!secret) {
        console.error('[kinde-webhook] KINDE_WEBHOOK_SECRET is not set')
        return false
    }
    if (!signature) return false

    const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex')

    return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex')
    )
}

export async function POST(req: NextRequest) {
    // 1. Read raw body for signature verification
    const rawBody = await req.text()
    const signature = req.headers.get('x-kinde-signature')

    if (!verifySignature(rawBody, signature)) {
        console.error('[kinde-webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 2. Parse the event
    let event: KindeUserCreatedPayload
    try {
        event = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const eventType = event.type
    console.log(`[kinde-webhook] Received event: ${eventType}`)

    // 3. Handle user.created
    if (eventType === 'user.created') {
        const { id: kindeUserId, email, first_name, last_name } = event.data.user

        if (!email) {
            console.warn('[kinde-webhook] user.created event missing email, skipping')
            return NextResponse.json({ received: true })
        }

        // Check for a pending invite matching this email
        const invites = await sql`
      SELECT si.*, h.name AS home_name
      FROM staff_invites si
      JOIN homes h ON h.id = si.home_id
      WHERE si.email = ${email}
        AND si.status = 'pending'
        AND si.expires_at > NOW()
      ORDER BY si.created_at DESC
      LIMIT 1
    `

        if (invites.length > 0) {
            const invite = invites[0]
            const homeId = invite.home_id as string
            const role = invite.role as string

            // Create or update staff record
            // Uses clerk_user_id column for Kinde user ID — Phase 3 will rename
            const staffRows = await sql`
        INSERT INTO staff (
          clerk_user_id, home_id, email, first_name, last_name, role,
          employment_type, max_hours_week, is_active
        ) VALUES (
          ${kindeUserId},
          ${homeId},
          ${email},
          ${first_name ?? ''},
          ${last_name ?? ''},
          ${role},
          'full_time',
          48,
          TRUE
        )
        ON CONFLICT (email, home_id)
          WHERE deleted_at IS NULL
        DO UPDATE SET
          clerk_user_id = EXCLUDED.clerk_user_id,
          role = EXCLUDED.role,
          first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), staff.first_name),
          last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), staff.last_name),
          is_active = TRUE,
          updated_at = NOW()
        RETURNING id
      `

            const staffId = staffRows[0]?.id as string

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
                action: 'staff.invite_accepted',
                entityType: 'staff_invite',
                entityId: invite.id as string,
                metadata: {
                    staffId,
                    email,
                    role,
                    source: 'kinde_webhook',
                },
            })

            console.log(
                `[kinde-webhook] Auto-accepted invite for ${email} → staff ${staffId} at home ${homeId}`
            )
        } else {
            // No pending invite — log and move on
            // system_admin users or users who signed up without an invite
            console.log(
                `[kinde-webhook] user.created: ${email} (${kindeUserId}) — no pending invite, skipping staff creation`
            )
        }
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true })
}
