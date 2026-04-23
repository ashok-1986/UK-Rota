// POST /api/auth/2fa-enable
// Redirects the user to Kinde's account settings to manage 2FA.
// 2FA enforcement for home_manager accounts is configured in Kinde Dashboard:
//   Security → Multi-factor authentication → Required for specific roles
//
// This endpoint provides a JSON response that the frontend uses to redirect.
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromHeaders, authError } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { role } = getSessionFromHeaders(req.headers)
  if (!role) return authError('UNAUTHORIZED')

  // 2FA management is handled through Kinde's hosted account settings.
  const kindeIssuerUrl = process.env.KINDE_ISSUER_URL ?? ''

  return NextResponse.json({
    message: '2FA management is handled through your account settings.',
    redirectUrl: `${kindeIssuerUrl}/account-settings`,
  })
}
