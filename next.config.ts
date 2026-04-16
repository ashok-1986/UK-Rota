import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @react-pdf/renderer and twilio are Node-only — prevent client bundling
  serverExternalPackages: ['@react-pdf/renderer', 'twilio', 'canvas'],
}

export default nextConfig
