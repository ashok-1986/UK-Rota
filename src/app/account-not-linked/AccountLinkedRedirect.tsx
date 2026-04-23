'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AccountLinkedRedirect() {
  const router = useRouter()

  useEffect(() => {
    const t = setTimeout(() => router.replace('/dashboard'), 2000)
    return () => clearTimeout(t)
  }, [router])

  return (
    <p className="text-sm text-gray-500 mt-2">Redirecting to dashboard…</p>
  )
}
