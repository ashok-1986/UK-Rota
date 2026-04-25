import sql from '@/lib/db'
import Link from 'next/link'
import type { AppRole } from '@/types'

interface PageProps {
    params: Promise<{ token: string }>
}

const ROLE_LABELS: Record<string, string> = {
    home_manager: 'Home Manager',
    unit_manager: 'Unit Manager',
    care_staff: 'Care Staff',
    bank_staff: 'Bank Staff',
}

export default async function InviteAcceptPage({ params }: PageProps) {
    const { token } = await params

    // Look up the invite
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-red-600 text-xl">✕</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite</h1>
                    <p className="text-gray-600">
                        This invite link is invalid or has already been used.
                    </p>
                </div>
            </div>
        )
    }

    const invite = invites[0]
    const expiresAt = new Date(invite.expires_at as string)

    if (expiresAt < new Date()) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-yellow-600 text-xl">⏰</span>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Invite Expired</h1>
                    <p className="text-gray-600">
                        This invite link has expired. Please ask your manager to send a new invite.
                    </p>
                </div>
            </div>
        )
    }

    const homeName = invite.home_name as string
    const role = invite.role as AppRole
    const roleLabel = ROLE_LABELS[role] ?? role

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm text-center">
                {/* Brand */}
                <h2 className="text-2xl font-bold text-blue-900 mb-6">CareRota</h2>

                {/* Welcome */}
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-blue-600 text-2xl">✉</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">
                    Welcome to {homeName}
                </h1>
                <p className="text-gray-600 mb-8">
                    You&apos;ve been invited as a <strong>{roleLabel}</strong>.
                    <br />
                    Create your account to get started.
                </p>

                {/* CTA — redirects to Kinde signup, then returns to /invite/[token]/complete */}
                <Link
                    href={`/api/auth/kinde/login?post_login_redirect_url=/invite/${token}/complete`}
                    className="inline-block w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                    Create your account →
                </Link>

                <p className="text-xs text-gray-400 mt-6">
                    This invite expires {expiresAt.toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </p>
            </div>
        </div>
    )
}
