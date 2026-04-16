// POST /api/notify/shift-reminders
// Protected by CRON_SECRET (checked in middleware)
// Sends reminders for all published/unconfirmed shifts for the next calendar day
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { sendShiftReminder } from '@/lib/notify'
import type { Staff, RotaShiftDetailed } from '@/types'

export async function POST(req: NextRequest) {
  // Cron protection is handled by middleware; if we reach here, it's authorised

  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const rows = await sql`
    SELECT
      rs.*, st.*,
      s.id AS shift_id, s.name AS shift_name,
      s.start_time::text AS shift_start_time, s.end_time::text AS shift_end_time,
      s.duration_hours, s.color AS shift_color
    FROM rota_shifts rs
    JOIN staff st ON st.id = rs.staff_id
    JOIN shifts s ON s.id = rs.shift_id
    WHERE rs.shift_date = ${tomorrowStr}
      AND rs.status = 'published'
      AND rs.staff_id IS NOT NULL
      AND st.deleted_at IS NULL
      AND st.is_active = TRUE
  `

  let sent = 0
  let failed = 0

  for (const row of rows) {
    const staff: Staff = {
      id: row.id, home_id: row.home_id, unit_id: row.unit_id,
      clerk_user_id: row.clerk_user_id, first_name: row.first_name, last_name: row.last_name,
      email: row.email, phone: row.phone, role: row.role, employment_type: row.employment_type,
      contracted_hours: row.contracted_hours ? Number(row.contracted_hours) : null,
      max_hours_week: row.max_hours_week ?? 48,
      night_shifts_ok: row.night_shifts_ok ?? false,
      is_active: row.is_active, deleted_at: row.deleted_at,
      created_at: row.created_at, updated_at: row.updated_at,
    }

    const shiftDetailed: RotaShiftDetailed = {
      id: row.id, home_id: row.home_id, shift_id: row.shift_id,
      staff_id: row.staff_id, unit_id: row.unit_id, shift_date: row.shift_date,
      week_start: row.week_start, status: row.status, notes: row.notes,
      confirmed_at: row.confirmed_at, created_by: row.created_by,
      created_at: row.created_at, updated_at: row.updated_at,
      shift: {
        id: row.shift_id, home_id: row.home_id, name: row.shift_name,
        start_time: row.shift_start_time, end_time: row.shift_end_time,
        duration_hours: Number(row.duration_hours), color: row.shift_color,
        is_night: false, is_weekend: false, is_active: true, created_at: '', updated_at: '',
      },
      staff,
    }

    try {
      await sendShiftReminder(staff, shiftDetailed)
      sent++
    } catch (err) {
      console.error('[shift-reminders] Failed for staff', staff.id, err)
      failed++
    }
  }

  return NextResponse.json({ date: tomorrowStr, sent, failed })
}
