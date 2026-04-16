'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { Home } from '@/types'

interface HomeSettingsFormProps {
  home: Home
}

export function HomeSettingsForm({ home }: HomeSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [name, setName] = useState(home.name)
  const [address, setAddress] = useState(home.address ?? '')
  const [email, setEmail] = useState(home.email ?? '')
  const [timezone, setTimezone] = useState(home.timezone)
  const [maxStaff, setMaxStaff] = useState(String(home.max_staff))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/homes/${home.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          address: address || null,
          email: email || null,
          timezone,
          maxStaff: maxStaff ? parseInt(maxStaff) : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update home')
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Home Name</label>
        <input
          type="text"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <textarea
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Street, city, postcode..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
          <input
            type="email"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="manager@carehome.co.uk"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
          >
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="Europe/Manchester">Europe/Manchester</option>
            <option value="Europe/Edinburgh">Europe/Edinburgh</option>
            <option value="Europe/Cardiff">Europe/Cardiff</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Max Staff Capacity</label>
        <input
          type="number"
          min="0"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={maxStaff}
          onChange={e => setMaxStaff(e.target.value)}
          placeholder="0 for no limit"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Settings updated successfully.</p>}

      <Button type="submit" variant="primary" loading={loading}>
        Save Settings
      </Button>
    </form>
  )
}