import type { NextConfig } from 'next'

// Resolve the deployment origin once — used by Kinde SDK for state cookies.
// Vercel auto-sets VERCEL_URL (no protocol) on every deployment.
// Falls back to localhost:3000 for local dev where neither var is set.
const siteUrl =
  process.env.KINDE_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000')

const nextConfig: NextConfig = {
  // @react-pdf/renderer and twilio are Node-only — prevent client bundling
  serverExternalPackages: ['@react-pdf/renderer', 'twilio', 'canvas'],

  // Kinde auth requires KINDE_SITE_URL to match the actual deployment domain.
  // These env overrides ensure the SDK uses the correct domain for state cookies
  // and post-login/logout redirects, preventing "State not found" errors.
  env: {
    KINDE_SITE_URL: siteUrl,
    KINDE_POST_LOGOUT_REDIRECT_URL:
      process.env.KINDE_POST_LOGOUT_REDIRECT_URL ?? siteUrl,
    KINDE_POST_LOGIN_REDIRECT_URL:
      process.env.KINDE_POST_LOGIN_REDIRECT_URL ?? siteUrl,
    KINDE_AUTH_API_PATH: '/api/auth/kinde',
  },
}

export default nextConfig
