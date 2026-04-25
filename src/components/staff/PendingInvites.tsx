'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { RoleBadge } from '@/components/ui/Badge'
import type { AppRole } from '@/types'

interface PendingInvite {
    id: string
    email: string
    role: AppRole
    status: string
    created_at: string
    expires_at: string
    invited_by_first_name: string
    invited_by_last_name: string
}

export function PendingInvites() {
    const router = useRouter()
    const [invites, setInvites] = useState<PendingInvite[]>([])
    const [loading, setLoading] = useState(true)
    const [cancelling, setCancelling] = useState<string | null>(null)

    const fetchInvites = useCallback(async () => {
        try {
            const res = await fetch('/api/staff/invites')
            if (res.ok) {
                setInvites(await res.json())
            }
        } catch {
            // silent fail
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchInvites()
    }, [fetchInvites])

    async function cancelInvite(id: string) {
        setCancelling(id)
        try {
            const res = await fetch(`/api/staff/invite/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setInvites(prev => prev.filter(i => i.id !== id))
                router.refresh()
            }
        } catch {
            // silent fail
        } finally {
            setCancelling(null)
        }
    }

    function timeAgo(dateStr: string): string {
        const diff = Date.now() - new Date(dateStr).getTime()
        const hours = Math.floor(diff / 3600000)
        if (hours < 1) return 'Just now'
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        return `${days}d ago`
    }

    function expiresIn(dateStr: string): string {
        const diff = new Date(dateStr).getTime() - Date.now()
        if (diff <= 0) return 'Expired'
        const hours = Math.floor(diff / 3600000)
        if (hours < 24) return `${hours}h left`
        const days = Math.floor(hours / 24)
        return `${days}d left`
    }

    if (loading) {
        return (
            <div className="text-center py-6 text-gray-400 text-sm">
                Loading invites…
            </div>
        )
    }

    if (invites.length === 0) return null

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Pending Invites ({invites.length})
            </h3>
            {invites.map(invite => (
                <div
                    key={invite.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                                <span className="text-yellow-600 text-lg">✉</span>
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">{invite.email}</p>
                                <p className="text-xs text-gray-500">
                                    Invited {timeAgo(invite.created_at)} · {expiresIn(invite.expires_at)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <RoleBadge role={invite.role} />
                            <Button
                                variant="ghost"
                                size="sm"
                                loading={cancelling === invite.id}
                                onClick={() => cancelInvite(invite.id)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
