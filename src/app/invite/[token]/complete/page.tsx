import { redirect } from 'next/navigation'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import sql from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'

interface PageProps {
    params: Promise<{ token: string }>
}

export default async function InviteCompletePage({ params }: PageProps) {
    const { token } = await params

    // 1. Get the logged-in Kinde user
    const { getUser, isAuthenticated } = getKindeServerSession()
    const authenticated = await isAuthenticated()

    if (!authenticated) {
        // Not logged in — send them back to the invite page to start the flow
        redirect(`/invite/${token}`)
    }

    const user = await getUser()
    const kindeUserId = user?.id
    const kindeEmail = user?.email

    if (!kindeUserId || !kindeEmail) {
        return (
            <ErrorPage
                title="Account Error"
                message="Could not read your account details. Please try signing in again."
            />
        )
    }

    // 2. Look up the invite
    const invites = await sql`
    SELECT si.*, h.name AS home_name
    FROM staff_invites si
    JOIN homes h ON h.id = si.home_id
    WHERE si.token = ${token}
      AND si.status = 'pending'
    LIMIT 1
  `

    if (invites.length === 0) {
        return (
            <ErrorPage
                title="Invalid Invite"
                message="This invite link is invalid or has already been used."
            />
        )
    }

    const invite = invites[0]
    const inviteEmail = invite.email as string

    // 3. Check email match
    if (kindeEmail.toLowerCase() !== inviteEmail.toLowerCase()) {
        return (
            <ErrorPage
                title="Email Mismatch"
                message={`This invite was sent to a different email address. Please sign in with ${inviteEmail}.`}
            />
        )
    }

    // 4. Check expiry
    const expiresAt = new Date(invite.expires_at as string)
    if (expiresAt < new Date()) {
        return (
            <ErrorPage
                title="Invite Expired"
                message="This invite link has expired. Please ask your manager to send a new invite."
            />
        )
    }

    // 5. Create or update staff record
    // Uses kinde_user_id column for the Kinde user ID — Phase 3 will rename the column
    const homeId = invite.home_id as string
    const role = invite.role as string

    const staffRows = await sql`
    INSERT INTO staff (
      kinde_user_id, home_id, email, first_name, last_name, role,
      employment_type, max_hours_week, is_active
    ) VALUES (
      ${kindeUserId},
      ${homeId},
      ${kindeEmail},
      ${user?.given_name ?? ''},
      ${user?.family_name ?? ''},
      ${role},
      'full_time',
      48,
      TRUE
    )
    ON CONFLICT (email, home_id)
      WHERE deleted_at IS NULL
    DO UPDATE SET
      kinde_user_id = EXCLUDED.kinde_user_id,
      role = EXCLUDED.role,
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), staff.first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), staff.last_name),
      is_active = TRUE,
      updated_at = NOW()
    RETURNING id
  `

    const staffId = staffRows[0]?.id as string

    // 6. Mark invite as accepted
    await sql`
    UPDATE staff_invites
    SET status = 'accepted', accepted_at = NOW()
    WHERE token = ${token}
  `

    // 7. Audit log
    writeAuditLog({
        homeId,
        actorId: kindeUserId,
        action: 'staff.invite_accepted',
        entityType: 'staff_invite',
        entityId: invite.id as string,
        metadata: { staffId, email: kindeEmail, role },
    })

    // 8. Redirect to staff rota
    redirect('/staff/rota')
}

function ErrorPage({ title, message }: { title: string; message: string }) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-red-600 text-xl">✕</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
                <p className="text-gray-600">{message}</p>
            </div>
        </div>
    )
}
