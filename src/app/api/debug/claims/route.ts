import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { isAuthenticated, getUser, getIdToken } = getKindeServerSession()

  const authenticated = await isAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }

  const user = await getUser()
  const idToken = await getIdToken() as Record<string, unknown> | null

  const userProps = idToken?.user_properties as
    Record<string, { v: string }> | undefined

  return NextResponse.json({
    userId: user?.id,
    role: userProps?.role?.v ?? null,
    homeId: userProps?.homeid?.v ?? null,
    rawUserProperties: userProps,
    fullIdToken: idToken,
  })
}
