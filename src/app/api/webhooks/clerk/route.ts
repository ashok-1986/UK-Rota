// =============================================================
// CareRota — Clerk Webhook Handler
// Handles: user.created, user.updated, user.deleted
// =============================================================
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
if (!WEBHOOK_SECRET) {
  throw new Error('CLERK_WEBHOOK_SECRET is not set')
}

type ClerkEvent = {
  type: 'user.created' | 'user.updated' | 'user.deleted'
  data: {
    id: string
    email_addresses?: { email_address: string }[]
    first_name?: string
    last_name?: string
    public_metadata?: Record<string, unknown>
    deleted_at?: string
  }
}

async function verifySignature(req: NextRequest): Promise<string | null> {
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return 'Missing Svix headers'
  }

  const body = await req.text()
  const payload = `${svixId}.${svixTimestamp}.${body}`

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const expectedSignature = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const actual = svixSignature.split(',')[0]?.split('=')[1]
  if (actual !== expectedSignature) {
    return 'Invalid signature'
  }

  return null
}

export async function POST(req: NextRequest) {
  const verifyError = await verifySignature(req)
  if (verifyError) {
    console.error('Webhook verification failed:', verifyError)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const event = body as ClerkEvent

  const { type, data } = event

  if (!type || !data?.id) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const clerkUserId = data.id
  const email = data.email_addresses?.[0]?.email_address ?? ''
  const firstName = data.first_name ?? ''
  const lastName = data.last_name ?? ''
  const metadata = data.public_metadata ?? {}
  const homeId = metadata.homeId as string | undefined
  const role = (metadata.role as string) ?? 'care_staff'

  try {
    switch (type) {
      case 'user.created': {
        if (!homeId) {
          console.warn('User created without homeId, skipping:', clerkUserId)
          return NextResponse.json({ message: 'Skipped - no homeId' })
        }

        await sql`
          INSERT INTO staff (clerk_user_id, home_id, email, first_name, last_name, role)
          VALUES (${clerkUserId}, ${homeId}, ${email}, ${firstName}, ${lastName}, ${role})
          ON CONFLICT (email) DO UPDATE SET
            clerk_user_id = EXCLUDED.clerk_user_id,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            updated_at = NOW()
        `
        await writeAuditLog({
          homeId,
          actorId: null,
          action: 'staff.created_from_webhook',
          entityType: 'staff',
          entityId: clerkUserId,
          metadata: { clerkUserId, email, firstName, lastName, role },
        })
        return NextResponse.json({ message: 'User created' })
      }

      case 'user.updated': {
        if (!homeId) {
          console.warn('User updated without homeId, skipping:', clerkUserId)
          return NextResponse.json({ message: 'Skipped - no homeId' })
        }

        const [existing] = await sql`
          SELECT id FROM staff WHERE clerk_user_id = ${clerkUserId}
        `
        if (existing) {
          await sql`
            UPDATE staff SET
              first_name = ${firstName},
              last_name = ${lastName},
              email = ${email},
              role = ${role},
              updated_at = NOW()
            WHERE clerk_user_id = ${clerkUserId}
          `
        }
        return NextResponse.json({ message: 'User updated' })
      }

      case 'user.deleted': {
        const [existing] = await sql`
          SELECT id, home_id FROM staff WHERE clerk_user_id = ${clerkUserId}
        `
        if (existing) {
          await sql`
            UPDATE staff SET deleted_at = NOW(), is_active = FALSE
            WHERE clerk_user_id = ${clerkUserId}
          `
          await writeAuditLog({
            homeId: existing.home_id,
            actorId: null,
            action: 'staff.soft_deleted_from_webhook',
            entityType: 'staff',
            entityId: clerkUserId,
          })
        }
        return NextResponse.json({ message: 'User deleted' })
      }

      default:
        return NextResponse.json({ error: 'Unknown event type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}