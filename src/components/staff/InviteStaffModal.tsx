'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

interface InviteStaffModalProps {
    homeId: string
    onClose: () => void
}

export function InviteStaffModal({ homeId, onClose }: InviteStaffModalProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    const [email, setEmail] = useState('')
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [role, setRole] = useState('care_staff')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const res = await fetch('/api/staff/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    role,
                    first_name: firstName || undefined,
                    last_name: lastName || undefined,
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                if (res.status === 409) {
                    setError('An invite has already been sent to this email.')
                } else {
                    setError(
                        typeof data.error === 'string'
                            ? data.error
                            : 'Failed to send invite. Please try again.'
                    )
                }
                return
            }

            setSuccess(`Invite sent to ${email}. Link expires in 72 hours.`)
            setTimeout(() => {
                onClose()
                router.refresh()
            }, 2000)
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900">Invite Staff</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {success ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                        ✓ {success}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="invite-email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="staff@example.com"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="invite-first-name" className="block text-sm font-medium text-gray-700 mb-1">
                                    First name
                                </label>
                                <input
                                    id="invite-first-name"
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Jane"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label htmlFor="invite-last-name" className="block text-sm font-medium text-gray-700 mb-1">
                                    Last name
                                </label>
                                <input
                                    id="invite-last-name"
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Doe"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700 mb-1">
                                Role <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="invite-role"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            >
                                <option value="care_staff">Care Staff</option>
                                <option value="bank_staff">Bank Staff</option>
                                <option value="unit_manager">Unit Manager</option>
                                <option value="home_manager">Home Manager</option>
                            </select>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" loading={loading} className="flex-1">
                                Send Invite
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
