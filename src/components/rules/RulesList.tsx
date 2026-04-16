'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { Rule } from '@/types'
import { titleCase } from '@/lib/utils'

interface RulesListProps {
  rules: Rule[]
  homeId: string
}

const ruleDescriptions: Record<string, { label: string; unit: string; description: string }> = {
  min_rest_hours: {
    label: 'Minimum rest between shifts',
    unit: 'hours',
    description: 'UK Working Time Regulations require at least 11h rest between shifts. Minimum allowed: 11.',
  },
  max_weekly_hours: {
    label: 'Maximum weekly hours',
    unit: 'hours',
    description: 'UK Working Time Regulations limit working time to 48h per week (averaged over 17 weeks). Maximum allowed: 48 (unless staff opts out).',
  },
  max_consecutive_days: {
    label: 'Maximum consecutive working days',
    unit: 'days',
    description: 'The maximum number of consecutive days a staff member can work before a day off is required.',
  },
}

export function RulesList({ rules, homeId }: RulesListProps) {
  return (
    <div className="space-y-4">
      {rules.map(rule => (
        <RuleCard key={rule.id} rule={rule} homeId={homeId} />
      ))}
    </div>
  )
}

function RuleCard({ rule, homeId }: { rule: Rule; homeId: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(rule.value))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = ruleDescriptions[rule.rule_type] ?? {
    label: titleCase(rule.rule_type),
    unit: '',
    description: '',
  }

  async function save() {
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) {
      setError('Enter a positive number')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: num }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update rule')
      router.refresh()
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{meta.label}</h3>
          <p className="text-sm text-gray-500 mt-1">{meta.description}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {editing ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  autoFocus
                />
                <span className="text-sm text-gray-500">{meta.unit}</span>
              </div>
              <Button size="sm" variant="primary" loading={loading} onClick={save}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(String(rule.value)); setError(null) }}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{rule.value}</p>
                <p className="text-xs text-gray-400">{meta.unit}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                Edit
              </Button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}
