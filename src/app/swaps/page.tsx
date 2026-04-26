import { redirect } from 'next/navigation'
import { getKindeAuth } from '@/lib/auth'
import { SwapsList } from '@/components/swaps/SwapsList'

export default async function SwapsPage() {
  const kindeAuth = await getKindeAuth()
  if (!kindeAuth) redirect('/api/auth/kinde/login')

  const { role } = kindeAuth

  if (role === 'system_admin') redirect('/dashboard')

  return <SwapsList role={role} />
}
