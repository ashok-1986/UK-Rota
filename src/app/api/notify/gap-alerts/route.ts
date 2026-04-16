// POST /api/notify/gap-alerts
// Protected by CRON_SECRET (checked in middleware)
// Sends gap alerts for all published weeks with unfilled shifts (current + next week)
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { sendGapAlert } from '@/lib/notify'

function getWeekStart(date: Date): string {
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() + diff)
  return monday.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  const now = new Date()
  const thisWeek = getWeekStart(now)
  const nextWeek = (() => {
    const d = new Date(thisWeek)
    d.setUTCDate(d.getUTCDate() + 7)
    return d.toISOString().slice(0, 10)
  })()

  // Find all active homes
  const homes = await sql`
    SELECT id FROM homes WHERE is_active = TRUE
  `

  const results = []

  for (const home of homes) {
    for (const weekStart of [thisWeek, nextWeek]) {
      const unfilledRows = await sql`
        SELECT COUNT(*) AS count
        FROM rota_shifts
        WHERE home_id = ${home.id}
          AND week_start = ${weekStart}
          AND staff_id IS NULL
          AND status = 'published'
      `
      const count = Number(unfilledRows[0]?.count ?? 0)
      if (count === 0) continue

      const managers = await sql`
        SELECT email FROM staff
        WHERE home_id = ${home.id}
          AND role = 'home_manager'
          AND is_active = TRUE
          AND deleted_at IS NULL
      `
      for (const manager of managers) {
        try {
          await sendGapAlert(manager.email, home.id, weekStart, count)
        } catch (err) {
          console.error('[gap-alerts] Failed:', err)
        }
      }
      results.push({ homeId: home.id, weekStart, count })
    }
  }

  return NextResponse.json({ alerts: results })
}
