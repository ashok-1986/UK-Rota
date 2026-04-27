// =============================================================
// CareRota — Kinde Management API (M2M)
// Server-only: uses client_credentials grant, never exposed to browser.
// =============================================================
import 'server-only'

const KINDE_DOMAIN = 'https://alchemetryx.kinde.com'

// ------------------------------------------------------------------
// M2M Token Cache — module-level, reused across requests
// ------------------------------------------------------------------

let cachedToken: string | null = null
let tokenExpiresAt = 0

export async function getM2MToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken
    }

    const clientId = process.env.KINDE_MGMT_CLIENT_ID
    const clientSecret = process.env.KINDE_MGMT_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        throw new Error('[kinde-mgmt] KINDE_MGMT_CLIENT_ID or KINDE_MGMT_CLIENT_SECRET not set')
    }

    const res = await fetch(`${KINDE_DOMAIN}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            audience: `${KINDE_DOMAIN}/api`,
        }),
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`[kinde-mgmt] Token fetch failed (${res.status}): ${text}`)
    }

    const json = await res.json() as { access_token: string; expires_in: number }

    cachedToken = json.access_token
    // Buffer 60 seconds before actual expiry
    tokenExpiresAt = Date.now() + (json.expires_in - 60) * 1000

    return cachedToken
}

// ------------------------------------------------------------------
// Helper: authenticated fetch against Kinde Management API
// ------------------------------------------------------------------

async function kindeApi(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = await getM2MToken()
    return fetch(`${KINDE_DOMAIN}/api/v1${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers ?? {}),
        },
    })
}

// ------------------------------------------------------------------
// 1. createKindeOrg
// ------------------------------------------------------------------

export async function createKindeOrg(name: string): Promise<{ orgCode: string }> {
    const res = await kindeApi('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name }),
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`[kinde-mgmt] createKindeOrg failed: ${res.status} ${text}`)
    }

    const json = await res.json() as { organization: { code: string } }
    return { orgCode: json.organization.code }
}

// ------------------------------------------------------------------
// 2. addUserToOrg
// ------------------------------------------------------------------

export async function addUserToOrg(
    kindeUserId: string,
    orgCode: string,
    role: 'admin' | 'member'
): Promise<void> {
    // Step 1: Add user to org
    const addRes = await kindeApi(`/organizations/${orgCode}/users`, {
        method: 'POST',
        body: JSON.stringify({ users: [{ id: kindeUserId }] }),
    })

    if (!addRes.ok) {
        const text = await addRes.text()
        throw new Error(`[kinde-mgmt] addUserToOrg (add) failed: ${addRes.status} ${text}`)
    }

    // Step 2: Assign role within org
    const roleRes = await kindeApi(
        `/organizations/${orgCode}/users/${kindeUserId}/roles`,
        {
            method: 'POST',
            body: JSON.stringify({ role_keys: [role] }),
        }
    )

    if (!roleRes.ok) {
        const text = await roleRes.text()
        throw new Error(`[kinde-mgmt] addUserToOrg (role) failed: ${roleRes.status} ${text}`)
    }
}

// ------------------------------------------------------------------
// 3. removeUserFromOrg
// ------------------------------------------------------------------

export async function removeUserFromOrg(
    kindeUserId: string,
    orgCode: string
): Promise<void> {
    const res = await kindeApi(`/organizations/${orgCode}/users/${kindeUserId}`, {
        method: 'DELETE',
    })

    if (!res.ok && res.status !== 404) {
        const text = await res.text()
        throw new Error(`[kinde-mgmt] removeUserFromOrg failed: ${res.status} ${text}`)
    }
}

// ------------------------------------------------------------------
// 4. getKindeUser
// ------------------------------------------------------------------

export async function getKindeUser(
    kindeUserId: string
): Promise<{ email: string; firstName: string; lastName: string } | null> {
    const res = await kindeApi(`/users/${kindeUserId}`)

    if (res.status === 404) return null

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`[kinde-mgmt] getKindeUser failed: ${res.status} ${text}`)
    }

    const json = await res.json() as {
        email: string
        first_name: string
        last_name: string
    }

    return {
        email: json.email,
        firstName: json.first_name,
        lastName: json.last_name,
    }
}
