// =============================================================
// Neon serverless PostgreSQL client
// Uses HTTP transport — no persistent connections, Vercel-compatible
// =============================================================
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

/**
 * Tagged-template SQL client.
 * Parameters are automatically escaped — safe from SQL injection.
 *
 * Usage:
 *   const rows = await sql`SELECT * FROM staff WHERE home_id = ${homeId}`
 */
const sql = neon(process.env.DATABASE_URL)

export default sql
