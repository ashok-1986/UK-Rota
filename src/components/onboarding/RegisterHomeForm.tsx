'use client'

import { useState } from 'react'

interface Props {
    kindeUserId: string
    kindeEmail: string
    kindeFirstName?: string
    kindeLastName?: string
}

export default function RegisterHomeForm({
    kindeUserId,
    kindeEmail,
    kindeFirstName,
    kindeLastName,
}: Props) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [form, setForm] = useState({
        homeName: '',
        homeAddress: '',
        homeEmail: '',
        managerFirstName: kindeFirstName ?? '',
        managerLastName: kindeLastName ?? '',
    })

    function set(field: keyof typeof form, value: string) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const res = await fetch('/api/onboarding/register-home', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeName: form.homeName,
                    homeAddress: form.homeAddress || undefined,
                    homeEmail: form.homeEmail,
                    managerFirstName: form.managerFirstName,
                    managerLastName: form.managerLastName,
                    managerEmail: kindeEmail,
                    managerKindeUserId: kindeUserId,
                }),
            })

            if (res.status === 409) {
                setError('A home with this email is already registered.')
                return
            }

            if (!res.ok) {
                setError('Something went wrong. Please try again or contact support.')
                return
            }

            window.location.href = '/dashboard'
        } catch {
            setError('Something went wrong. Please try again or contact support.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Care Home Name */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Care Home Name <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    required
                    placeholder="Sunrise Care Home"
                    value={form.homeName}
                    onChange={e => set('homeName', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Home Address */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Address <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                    rows={2}
                    placeholder="123 High Street, London, SW1A 1AA"
                    value={form.homeAddress}
                    onChange={e => set('homeAddress', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
            </div>

            {/* Home Email */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Home Email <span className="text-red-500">*</span>
                </label>
                <input
                    type="email"
                    required
                    placeholder="manager@sunrisecare.co.uk"
                    value={form.homeEmail}
                    onChange={e => set('homeEmail', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Manager Name */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        value={form.managerFirstName}
                        onChange={e => set('managerFirstName', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        value={form.managerLastName}
                        onChange={e => set('managerLastName', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Manager email (read-only from Kinde) */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
                <input
                    type="email"
                    readOnly
                    value={kindeEmail}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">This is your Kinde account email and cannot be changed here.</p>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
                {loading ? 'Setting up your home…' : 'Register Care Home'}
            </button>
        </form>
    )
}
