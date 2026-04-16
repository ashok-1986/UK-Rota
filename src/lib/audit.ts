// =============================================================
// Audit log writer
// All writes go to the `logs` table; retained for 3 years
// =============================================================
import sql from './db'

export interface AuditParams {
  homeId: string | null
  actorId: string | null
  action: string           // dot-notation: 'rota_shift.created', 'staff.deleted'
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}

/**
 * Writes a single audit log entry.
 * Non-blocking: uses fire-and-forget pattern (errors are swallowed but logged
 * to console so they appear in Vercel function logs without breaking the request).
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await sql`
      INSERT INTO logs
        (home_id, actor_id, action, entity_type, entity_id, metadata, ip_address)
      VALUES (
        ${params.homeId ?? null},
        ${params.actorId ?? null},
        ${params.action},
        ${params.entityType},
        ${params.entityId ?? null},
        ${JSON.stringify(params.metadata ?? {})}::jsonb,
        ${params.ipAddress ?? null}::inet
      )
    `
  } catch (err) {
    // Do not surface audit failures to the user — log to Vercel function logs
    console.error('[audit] Failed to write log entry:', err, params)
  }
}

/**
 * Extracts the best-effort IP address from a request.
 */
export function getIp(request: Request): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    null
  )
}
