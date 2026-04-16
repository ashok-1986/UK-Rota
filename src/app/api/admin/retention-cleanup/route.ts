// POST /api/admin/retention-cleanup
// Protected by CRON_SECRET — runs monthly at 02:00 on the 1st
// Enforces UK-GDPR data retention:
//   - rota_shifts:  12 months
//   - logs:          3 years
//   - staff:         anonymise records where deleted_at < 30 days ago
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  const rotaMonths = Number(process.env.RETENTION_ROTA_MONTHS ?? 12)
  const logsYears = Number(process.env.RETENTION_LOGS_YEARS ?? 3)

  // 1. Delete old rota shifts
  const deletedRotaShifts = await sql`
    DELETE FROM rota_shifts
    WHERE shift_date < (CURRENT_DATE - (${rotaMonths} || ' months')::interval)::date
    RETURNING id
  `

  // 2. Delete old audit logs
  const deletedLogs = await sql`
    DELETE FROM logs
    WHERE created_at < NOW() - (${logsYears} || ' years')::interval
    RETURNING id
  `

  // 3. Anonymise staff records marked for deletion > 30 days ago
  const anonymised = await sql`
    UPDATE staff SET
      first_name = 'Deleted',
      last_name  = 'User',
      email      = 'deleted_' || id || '@deleted.invalid',
      phone      = NULL,
      updated_at = NOW()
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
      AND first_name != 'Deleted'
    RETURNING id
  `

  console.log(
    `[retention-cleanup] Deleted ${deletedRotaShifts.length} rota shifts, ` +
    `${deletedLogs.length} logs. Anonymised ${anonymised.length} staff records.`
  )

  return NextResponse.json({
    deletedRotaShifts: deletedRotaShifts.length,
    deletedLogs: deletedLogs.length,
    anonymisedStaff: anonymised.length,
    runAt: new Date().toISOString(),
  })
}
