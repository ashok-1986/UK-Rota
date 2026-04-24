// TEMPORARY — delete before final production deploy
// Tests each auth component individually to identify what's failing
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const results: Record<string, unknown> = { timestamp: new Date().toISOString() }

  // 1. Test isAuthenticated
  try {
    const { isAuthenticated } = getKindeServerSession()
    results.isAuthenticated = await isAuthenticated()
  } catch (e) {
    results.isAuthenticated = { error: String(e) }
  }

  // 2. Test getUser
  try {
    const { getUser } = getKindeServerSession()
    const user = await getUser()
    results.user = { id: user?.id, email: user?.email }
  } catch (e) {
    results.user = { error: String(e) }
  }

  // 3. Test getAccessTokenRaw
  try {
    const { getAccessTokenRaw } = getKindeServerSession()
    const raw = await getAccessTokenRaw()
    results.rawTokenLength = raw?.length ?? 0
    results.rawTokenExists = !!raw

    // 4. Decode JWT
    if (raw) {
      const parts = raw.split('.')
      const padded = parts[1] + '=='.slice(0, (4 - parts[1].length % 4) % 4)
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
      results.tokenSub = payload.sub
      results.userProperties = payload.user_properties
      results.role = payload.user_properties?.role?.v ?? null
      results.homeId = payload.user_properties?.homeid?.v ?? null
    }
  } catch (e) {
    results.rawToken = { error: String(e) }
  }

  return NextResponse.json(results)
}
