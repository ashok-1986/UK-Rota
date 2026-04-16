import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { RulesList } from '@/components/rules/RulesList'
import type { AppRole, Rule } from '@/types'

interface PageProps {
  params: Promise<{ homeId: string }>
}

async function getRules(homeId: string): Promise<Rule[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/rules?homeId=${homeId}`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return []
  return res.json()
}

export default async function RulesPage({ params }: PageProps) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const { homeId } = await params

  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string } | undefined

  const role = metadata?.role

  if (!['home_manager', 'system_admin'].includes(role ?? '')) {
    redirect('/dashboard')
  }

  const rules = await getRules(homeId)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scheduling Rules</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configure Working Time Regulations limits for your home.
          Changes apply immediately to new shift assignments.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>UK Working Time Regulations:</strong> The legal minimums are 11h rest between shifts
        and 48h maximum per week. Do not set values below these legal thresholds unless staff have
        signed a valid opt-out agreement.
      </div>

      {rules.length === 0 ? (
        <p className="text-gray-500">No rules configured. Default UK WTR values will apply.</p>
      ) : (
        <RulesList rules={rules} homeId={homeId} />
      )}
    </div>
  )
}
