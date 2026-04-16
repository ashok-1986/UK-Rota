import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { StaffShiftList } from '@/components/shifts/StaffShiftList'
import type { AppRole, RotaShiftDetailed } from '@/types'
import Link from 'next/link'

async function getMyShifts(staffId: string): Promise<RotaShiftDetailed[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Fetch via the rota shifts API (filter by staff in DB)
  // This hits the DB directly — we call the internal API here for consistency
  // In production you'd call an internal server function instead
  const res = await fetch(
    `${baseUrl}/api/staff/${staffId}/shifts`,
    { cache: 'no-store', credentials: 'include' }
  )
  if (!res.ok) return []
  return res.json()
}

export default async function StaffRotaPage() {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const metadata = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { role?: AppRole; homeId?: string } | undefined

  const role = metadata?.role
  const homeId = metadata?.homeId

  // Managers should use the dashboard rota view
  if (role === 'home_manager' || role === 'system_admin') {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    now.setDate(now.getDate() + diff)
    redirect(`/dashboard/rota/${homeId}/${now.toISOString().slice(0, 10)}`)
  }

  // Fetch shifts directly from DB via server action
  // Import sql directly since this is a server component
  const { default: sql } = await import('@/lib/db')

  const staffRows = await sql`
    SELECT id FROM staff WHERE clerk_user_id = ${userId} AND deleted_at IS NULL LIMIT 1
  `
  if (staffRows.length === 0) redirect('/sign-in')

  const staffId = staffRows[0].id
  const today = new Date().toISOString().slice(0, 10)

  const shifts = await sql`
    SELECT
      rs.id, rs.home_id, rs.shift_id, rs.staff_id, rs.unit_id,
      rs.shift_date::text AS shift_date, rs.week_start::text AS week_start,
      rs.status, rs.notes, rs.confirmed_at, rs.created_by,
      rs.created_at, rs.updated_at,
      s.id AS s_id, s.name AS s_name,
      s.start_time::text AS s_start_time, s.end_time::text AS s_end_time,
      s.duration_hours AS s_duration_hours, s.color AS s_color
    FROM rota_shifts rs
    JOIN shifts s ON s.id = rs.shift_id
    WHERE rs.staff_id = ${staffId}
      AND rs.status IN ('published', 'confirmed')
      AND rs.shift_date >= ${today}
    ORDER BY rs.shift_date, s.start_time
    LIMIT 30
  `

  const staffRecord = await sql`SELECT * FROM staff WHERE id = ${staffId} LIMIT 1`

  const shiftDetails: RotaShiftDetailed[] = shifts.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    home_id: r.home_id as string,
    shift_id: r.shift_id as string,
    staff_id: r.staff_id as string,
    unit_id: r.unit_id as string | null,
    shift_date: r.shift_date as string,
    week_start: r.week_start as string,
    status: r.status as 'published' | 'confirmed',
    notes: r.notes as string | null,
    confirmed_at: r.confirmed_at as string | null,
    created_by: r.created_by as string,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    shift: {
      id: r.s_id as string,
      home_id: r.home_id as string,
      name: r.s_name as string,
      start_time: r.s_start_time as string,
      end_time: r.s_end_time as string,
      duration_hours: Number(r.s_duration_hours),
      color: r.s_color as string,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
    staff: (staffRecord[0] as unknown as import('@/types').Staff) ?? null,
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/staff/rota" className="text-lg font-bold text-blue-900">CareRota</Link>
          <div className="flex items-center gap-3">
            <a href="/privacy" className="text-xs text-gray-400 hover:text-gray-600">Privacy</a>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Upcoming Shifts</h1>
          <p className="text-gray-500 text-sm mt-1">
            Tap <strong>Confirm</strong> to acknowledge your published shifts.
          </p>
        </div>

        <StaffShiftList shifts={shiftDetails} />

        <div className="pt-4 border-t border-gray-200 text-xs text-center text-gray-400 space-y-1">
          <p>Data stored in UK/EU · UK GDPR compliant</p>
          <div className="flex justify-center gap-4">
            <a href="/privacy" className="underline hover:text-gray-600">Privacy Policy</a>
            <a href={`/api/gdpr/export?staffId=${staffId}`} className="underline hover:text-gray-600">
              Download My Data
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
