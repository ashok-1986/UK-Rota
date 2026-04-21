'use client'

import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AccountLinkedRedirect() {
  const { session } = useClerk()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'done'>('loading')

  useEffect(() => {
    if (!session) return
    session.reload().then(() => {
      setStatus('done')
      router.replace('/dashboard')
    })
  }, [session, router])

  return (
    <p className="text-sm text-gray-500 mt-2">
      {status === 'loading' ? 'Refreshing your session…' : 'Redirecting to dashboard…'}
    </p>
  )
}
