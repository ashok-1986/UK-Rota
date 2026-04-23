import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { SwapsList } from '@/components/swaps/SwapsList'

export default async function SwapsPage() {
  const session = await getSession()
  if (!session.isAuthenticated) redirect('/sign-in')

  const { role } = session

  if (!role) redirect('/')
  if (role === 'system_admin') redirect('/dashboard')

  return <SwapsList role={role} />
}
