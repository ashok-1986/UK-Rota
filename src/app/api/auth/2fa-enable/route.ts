// POST /api/auth/2fa-enable
// Redirects the user to Clerk's user profile to enable 2FA.
// 2FA enforcement for home_manager accounts is configured in the Clerk Dashboard:
//   Organisations → Settings → Multi-factor authentication → Required
//
// This endpoint provides a JSON response that the frontend uses to redirect.
import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // The actual 2FA setup happens in the Clerk-hosted UI.
  // Return the URL for the client to redirect to.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const clerkUserProfileUrl = `${appUrl}/user-profile`  // Clerk's <UserProfile /> page

  return NextResponse.json({
    message: '2FA management is handled through your account settings.',
    redirectUrl: clerkUserProfileUrl,
  })
}
