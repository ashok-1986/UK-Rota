import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { HomeSettingsForm } from '@/components/home/HomeSettingsForm'
import type { AppRole, Home } from '@/types'

interface PageProps {
  params: Promise<{ homeId: string }>
}

async function getHome(homeId: string): Promise<Home | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/homes/${homeId}`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return null
  return res.json()
}

export default async function HomeSettingsPage({ params }: PageProps) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const { homeId } = await params

  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string } | undefined

  const role = metadata?.role

  if (!['home_manager', 'system_admin'].includes(role ?? '')) {
    redirect('/dashboard')
  }

  const home = await getHome(homeId)

  if (!home) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Home Settings</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your care home's basic information and preferences.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <HomeSettingsForm home={home} />
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
        <p><strong>Data Storage:</strong> All data is stored in the UK/EU in compliance with UK-GDPR.</p>
        <p className="mt-1"><strong>Retention:</strong> Rota and staff data is retained for 12 months, logs for 3 years.</p>
        <p className="mt-1"><strong>Notifications:</strong> Email notifications sent via Resend. Configure RESEND_FROM_EMAIL in environment.</p>
      </div>
    </div>
  )
}