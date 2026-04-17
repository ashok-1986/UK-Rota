import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { AppRole } from '@/types'
import { SwapsList } from '@/components/swaps/SwapsList'

export default async function SwapsPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string } | undefined

  const role = metadata?.role

  if (!role) {
    redirect('/')
  }

  if (role === 'system_admin') {
    redirect('/dashboard')
  }

  return <SwapsList role={role} />
}
