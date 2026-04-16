'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { AppRole } from '@/types'

interface SwapRequest {
  id: string
  status: string
  reason: string | null
  response_note: string | null
  created_at: string
  requester_staff_id: string
  requester_first_name: string
  requester_last_name: string
  requester_shift_date: string
  requester_shift_name: string
  target_staff_id: string | null
  target_first_name: string | null
  target_last_name: string | null
  target_shift_date: string | null
  target_shift_name: string | null
}

export function SwapsList({ role }: { role: AppRole }) {
  const router = useRouter()
  const [swaps, setSwaps] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [processing, setProcessing] = useState<string | null>(null)

  const isManager = role === 'home_manager' || role === 'unit_manager'

  useEffect(() => {
    loadSwaps()
  }, [filter])

  async function loadSwaps() {
    setLoading(true)
    try {
      const res = await fetch(`/api/shifts/swaps?status=${filter}`)
      if (res.ok) {
        const data = await res.json()
        setSwaps(data)
      }
    } catch (err) {
      console.error('Failed to load swaps:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleResponse(id: string, status: 'approved' | 'rejected', note?: string) {
    setProcessing(id)
    try {
      const res = await fetch(`/api/shifts/swaps/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, responseNote: note }),
      })
      if (res.ok) {
        loadSwaps()
      } else {
        const data = await res.json()
        alert(data.error ?? 'Failed to process request')
      }
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setProcessing(null)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Shift Swaps</h1>
          <Button variant="ghost" onClick={() => router.back()}>← Back</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isManager && (
          <div className="flex gap-2 mb-6">
            {['pending', 'approved', 'rejected'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filter === f 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : swaps.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="font-medium">No swap requests</p>
            <p className="text-sm mt-1">Shift swap requests will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {swaps.map(swap => (
              <div key={swap.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        swap.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        swap.status === 'approved' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {swap.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(swap.created_at)}
                      </span>
                    </div>
                    
                    <p className="font-medium text-gray-900">
                      {swap.requester_first_name} {swap.requester_last_name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {swap.requester_shift_name} on {formatDate(swap.requester_shift_date)}
                    </p>

                    {swap.target_staff_id && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-sm text-gray-600">
                          ↔ {swap.target_first_name} {swap.target_last_name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {swap.target_shift_name} on {formatDate(swap.target_shift_date!)}
                        </p>
                      </div>
                    )}

                    {swap.reason && (
                      <p className="mt-2 text-sm text-gray-500 italic">"{swap.reason}"</p>
                    )}

                    {swap.response_note && (
                      <p className="mt-2 text-sm text-gray-500">
                        Response: {swap.response_note}
                      </p>
                    )}
                  </div>

                  {isManager && swap.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="primary"
                        loading={processing === swap.id}
                        onClick={() => handleResponse(swap.id, 'approved')}
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          const note = prompt('Reason for rejection (optional):')
                          handleResponse(swap.id, 'rejected', note ?? undefined)
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

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