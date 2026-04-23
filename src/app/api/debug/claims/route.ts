// TEMPORARY — delete before final production deploy
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const { getClaim, getAccessToken, isAuthenticated, getUser } = getKindeServerSession()

    const authenticated = await isAuthenticated()
    if (!authenticated) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
    }

    const user = await getUser()
    const accessToken = await getAccessToken()
    const roleClaim = await getClaim('role')
    const homeIdClaim = await getClaim('homeId')

    return NextResponse.json({
        user: { id: user?.id, email: user?.email },
        accessToken,
        roleClaim,
        homeIdClaim,
        timestamp: new Date().toISOString(),
    })
}
