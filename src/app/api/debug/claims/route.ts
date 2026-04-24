import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { isAuthenticated, getUser, getAccessTokenRaw } = getKindeServerSession()

  const authenticated = await isAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }

  const user = await getUser()
  const rawToken = await getAccessTokenRaw()

  // Decode without network call
  let payload = null
  if (rawToken) {
    try {
      const parts = rawToken.split('.')
      const padded = parts[1] + '=='.slice(0, (4 - parts[1].length % 4) % 4)
      payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
    } catch {
      payload = { error: 'decode failed' }
    }
  }

  return NextResponse.json({
    userId: user?.id,
    rawTokenExists: !!rawToken,
    decodedPayload: payload,
    userProperties: payload?.user_properties,
    role: payload?.user_properties?.role?.v ?? null,
    homeId: payload?.user_properties?.homeid?.v ?? null,
  })
}
