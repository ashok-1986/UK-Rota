// TEMPORARY — delete before final production deploy
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    return NextResponse.json({
        'x-user-id': request.headers.get('x-user-id'),
        'x-home-id': request.headers.get('x-home-id'),
        'x-user-role': request.headers.get('x-user-role'),
        'x-kinde-role': request.headers.get('x-kinde-role'),
        'x-kinde-org-code': request.headers.get('x-kinde-org-code'),
        timestamp: new Date().toISOString(),
    })
}
