import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'

export default async function RootPage() {
  const { isAuthenticated } = getKindeServerSession()
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    return <LandingPage />
  }

  // TODO Phase 2: restore role-based routing
  // system_admin → /dashboard
  // home_manager → /dashboard/rota/[homeId]/[week]
  // care_staff / bank_staff → /staff/rota
  redirect('/dashboard')
}
