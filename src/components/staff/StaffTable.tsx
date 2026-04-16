'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { RoleBadge } from '@/components/ui/Badge'
import type { Staff } from '@/types'
import { fullName, titleCase } from '@/lib/utils'

interface StaffTableProps {
  staff: Staff[]
}

export function StaffTable({ staff }: StaffTableProps) {
  const router = useRouter()
  const [deactivating, setDeactivating] = useState<string | null>(null)

  async function toggleActive(member: Staff) {
    setDeactivating(member.id)
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !member.is_active }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Failed to update staff member')
        return
      }
      router.refresh()
    } finally {
      setDeactivating(null)
    }
  }

  if (staff.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="font-medium">No staff members yet</p>
        <p className="text-sm mt-1">Add your first staff member using the button above.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {['Name', 'Email', 'Role', 'Type', 'Hours/wk', 'Status', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {staff.map(member => (
            <tr key={member.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                {fullName(member)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{member.email ?? '-'}</td>
              <td className="px-4 py-3"><RoleBadge role={member.role} /></td>
              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                {titleCase(member.employment_type ?? '')}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {member.contracted_hours ?? '—'}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                  member.is_active ? 'text-green-700' : 'text-red-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${member.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                  {member.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={deactivating === member.id}
                  onClick={() => toggleActive(member)}
                >
                  {member.is_active ? 'Deactivate' : 'Reactivate'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
