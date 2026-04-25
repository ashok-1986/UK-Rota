// POST /api/staff/invite — send a staff invitation email
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import crypto from 'crypto'
import sql from '@/lib/db'
import { sendStaffInvite } from '@/lib/notify'
import { writeAuditLog, getIp } from '@/lib/audit'
import type { AppRole } from '@/types'

const InviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['home_manager', 'unit_manager', 'care_staff', 'bank_staff']),
    first_name: z.string().min(1).max(100).optional(),
    last_name: z.string().min(1).max(100).optional(),
})

interface KindeTokenPayload {
    sub?: string
    user_properties?: Record<string, { v: string }>
}

function decodeJwtPayload(token: string): KindeTokenPayload | null {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) return null
        const payload = parts[1]
        const padded = payload + '=='.slice(0, (4 - payload.length % 4) % 4)
        return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
    } catch {
        return null
    }
}

export async function POST(req: NextRequest) {
    // 1. Auth — decode raw JWT, check role
    const { getAccessTokenRaw, getUser } = getKindeServerSession()
    const rawToken = await getAccessTokenRaw()

    if (!rawToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = decodeJwtPayload(rawToken)
    const userProps = payload?.user_properties
    const role = userProps?.role?.v as AppRole | undefined
    const homeId = userProps?.homeid?.v

    if (!role || !homeId) {
        return NextResponse.json({ error: 'Unauthorized — missing claims' }, { status: 401 })
    }

    if (role !== 'home_manager' && role !== 'system_admin') {
        return NextResponse.json({ error: 'Forbidden — managers only' }, { status: 403 })
    }

    const user = await getUser()
    const actorId = user?.id ?? null

    // 2. Parse and validate body
    let body: z.infer<typeof InviteSchema>
    try {
        body = InviteSchema.parse(await req.json())
    } catch (err) {
        const zodError = err instanceof z.ZodError ? err.flatten().fieldErrors : 'Invalid body'
        return NextResponse.json({ error: zodError }, { status: 400 })
    }

    // Note: body.role is already validated by Zod to exclude 'system_admin'


    // 3. Check for existing staff with this email + home
    const existingStaff = await sql`
    SELECT id FROM staff
    WHERE email = ${body.email}
      AND home_id = ${homeId}
      AND deleted_at IS NULL
    LIMIT 1
  `
    if (existingStaff.length > 0) {
        return NextResponse.json(
            { error: 'Staff member already exists' },
            { status: 409 }
        )
    }

    // 4. Check for pending invite
    const existingInvite = await sql`
    SELECT id FROM staff_invites
    WHERE email = ${body.email}
      AND home_id = ${homeId}
      AND status = 'pending'
      AND expires_at > NOW()
    LIMIT 1
  `
    if (existingInvite.length > 0) {
        return NextResponse.json(
            { error: 'Invite already sent' },
            { status: 409 }
        )
    }

    // 5. Find the manager's staff record (for invited_by FK)
    const managerStaff = await sql`
    SELECT id FROM staff
    WHERE clerk_user_id = ${actorId}
      AND home_id = ${homeId}
      AND deleted_at IS NULL
    LIMIT 1
  `
    if (managerStaff.length === 0) {
        return NextResponse.json(
            { error: 'Manager staff record not found' },
            { status: 500 }
        )
    }

    // 6. Generate token and insert invite
    const token = crypto.randomBytes(32).toString('hex')
    const invitedById = managerStaff[0].id as string

    const [invite] = await sql`
    INSERT INTO staff_invites (home_id, email, role, invited_by, token, expires_at)
    VALUES (
      ${homeId},
      ${body.email},
      ${body.role},
      ${invitedById},
      ${token},
      NOW() + interval '72 hours'
    )
    RETURNING id
  `

    // 7. Send invitation email
    try {
        await sendStaffInvite(body.email, token, body.role, homeId)
    } catch (err) {
        console.error('[invite] Email send failed:', err)
        // Invite is still created — don't fail the request
    }

    // 8. Audit log
    writeAuditLog({
        homeId,
        actorId,
        action: 'staff.invite_sent',
        entityType: 'staff_invite',
        entityId: invite.id as string,
        metadata: { email: body.email, role: body.role },
        ipAddress: getIp(req),
    })

    return NextResponse.json({
        message: 'Invite sent',
        invite_id: invite.id,
    })
}
