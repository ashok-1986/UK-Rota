import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @react-pdf/renderer and twilio are Node-only — prevent client bundling
  serverExternalPackages: ['@react-pdf/renderer', 'twilio', 'canvas'],

  // Kinde auth requires KINDE_SITE_URL to match the actual deployment domain.
  // On Vercel, VERCEL_URL is auto-set to the deployment's domain (no protocol).
  // These env overrides ensure the SDK uses the correct domain for state cookies
  // and post-login/logout redirects, preventing "State not found" errors.
  env: {
    KINDE_SITE_URL:
      process.env.KINDE_SITE_URL ?? `https://${process.env.VERCEL_URL}`,
    KINDE_POST_LOGOUT_REDIRECT_URL:
      process.env.KINDE_POST_LOGOUT_REDIRECT_URL ??
      `https://${process.env.VERCEL_URL}`,
    KINDE_POST_LOGIN_REDIRECT_URL:
      process.env.KINDE_POST_LOGIN_REDIRECT_URL ??
      `https://${process.env.VERCEL_URL}/dashboard`,
  },
}

export default nextConfig

