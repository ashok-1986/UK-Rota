import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const { getClaim, isAuthenticated, getUser, getAccessToken } = getKindeServerSession()

    const authenticated = await isAuthenticated()
    if (!authenticated) {
        return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
    }

    const user = await getUser()
    const accessToken = await getAccessToken()
    const roleClaim = await getClaim('role')
    const homeIdClaim = await getClaim('homeid')
    const rolesClaim = await getClaim('roles')

    return NextResponse.json({
        userId: user?.id,
        roleClaim,
        homeIdClaim,
        rolesClaim,
        // accessToken contains the full decoded JWT — shows all claims available
        accessToken,
    })
}
