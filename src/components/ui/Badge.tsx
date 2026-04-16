import { clsx } from 'clsx'
import type { RotaStatus, AppRole } from '@/types'

type BadgeColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo'

interface BadgeProps {
  label: string
  color?: BadgeColor
}

const colorClasses: Record<BadgeColor, string> = {
  gray:   'bg-gray-100 text-gray-700',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  indigo: 'bg-indigo-100 text-indigo-700',
}

export function Badge({ label, color = 'gray' }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      colorClasses[color]
    )}>
      {label}
    </span>
  )
}

export function StatusBadge({ status }: { status: RotaStatus }) {
  const map: Record<RotaStatus, { label: string; color: BadgeColor }> = {
    draft:     { label: 'Draft',     color: 'gray'   },
    published: { label: 'Published', color: 'blue'   },
    confirmed: { label: 'Confirmed', color: 'green'  },
    cancelled: { label: 'Cancelled', color: 'red'    },
  }
  const { label, color } = map[status]
  return <Badge label={label} color={color} />
}

export function RoleBadge({ role }: { role: AppRole }) {
  const map: Record<AppRole, { label: string; color: BadgeColor }> = {
    system_admin: { label: 'System Admin', color: 'purple' },
    home_manager: { label: 'Manager',      color: 'indigo' },
    unit_manager: { label: 'Unit Manager', color: 'indigo' },
    care_staff:   { label: 'Care Staff',   color: 'blue'   },
    bank_staff:   { label: 'Bank Staff',   color: 'yellow' },
  }
  const { label, color } = map[role]
  return <Badge label={label} color={color} />
}
