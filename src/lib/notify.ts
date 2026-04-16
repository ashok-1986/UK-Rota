// =============================================================
// Notification helpers — Resend (email) + Twilio (SMS)
// Server-side only — never import this in client components
// =============================================================
import { Resend } from 'resend'
import type { Staff, RotaShiftDetailed } from '@/types'
import { formatShortDate, formatTime, fullName } from './utils'

// Lazy-initialise clients so missing env vars don't crash non-notification paths
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set')
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

// Twilio is heavy — require() at runtime to avoid cold-start cost
function getTwilio() {
  const twilio = require('twilio') // eslint-disable-line @typescript-eslint/no-var-requires
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not set')
  }
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
}

// ------------------------------------------------------------------
// Email templates
// ------------------------------------------------------------------

function shiftReminderHtml(staff: Staff, shift: RotaShiftDetailed): string {
  const name = fullName(staff)
  const date = formatShortDate(shift.shift_date)
  const start = formatTime(shift.shift.start_time)
  const end = formatTime(shift.shift.end_time)

  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">
  <h2 style="color:#2563eb">Shift Reminder — CareRota</h2>
  <p>Hi ${name},</p>
  <p>This is a reminder that you have the following shift scheduled:</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0">
    <tr><td style="padding:8px;font-weight:bold;border:1px solid #e5e7eb">Date</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${date}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;border:1px solid #e5e7eb">Shift</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${shift.shift.name}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;border:1px solid #e5e7eb">Time</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${start}–${end}</td></tr>
  </table>
  <p>Please log in to <a href="${process.env.NEXT_PUBLIC_APP_URL}">CareRota</a> to confirm your shift.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:32px">
    This email was sent by CareRota. Your data is processed in accordance with UK GDPR.
  </p>
</body>
</html>`
}

function gapAlertHtml(homeId: string, weekStart: string, unfilledCount: number): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937">
  <h2 style="color:#dc2626">Unfilled Shifts Alert — CareRota</h2>
  <p>There are <strong>${unfilledCount}</strong> unfilled shift(s) in the week starting <strong>${weekStart}</strong>.</p>
  <p>Please log in to <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/rota/${homeId}/${weekStart}">CareRota</a> to assign staff.</p>
  <p style="color:#6b7280;font-size:12px;margin-top:32px">
    This email was sent by CareRota. Your data is processed in accordance with UK GDPR.
  </p>
</body>
</html>`
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

/**
 * Send a shift reminder email (and optional SMS) to a staff member.
 */
export async function sendShiftReminder(
  staff: Staff,
  shift: RotaShiftDetailed
): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@carerota.co.uk'
  const name = fullName(staff)
  const date = formatShortDate(shift.shift_date)

  const errors: unknown[] = []

  // Email
  try {
    await getResend().emails.send({
      from,
      to: staff.email,
      subject: `Shift reminder: ${shift.shift.name} on ${date}`,
      html: shiftReminderHtml(staff, shift),
    })
  } catch (err) {
    errors.push({ channel: 'email', err })
    console.error('[notify] Email send failed:', err)
  }

  // SMS (only if phone number present)
  if (staff.phone) {
    try {
      const client = getTwilio()
      const start = formatTime(shift.shift.start_time)
      await client.messages.create({
        body: `CareRota reminder: ${name}, you have a ${shift.shift.name} shift on ${date} at ${start}. Log in to confirm: ${process.env.NEXT_PUBLIC_APP_URL}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: staff.phone,
      })
    } catch (err) {
      errors.push({ channel: 'sms', err })
      console.error('[notify] SMS send failed:', err)
    }
  }

  if (errors.length > 0) {
    console.error('[notify] Some channels failed for staff', staff.id, errors)
  }
}

/**
 * Alert a manager about unfilled shifts for a given week.
 */
export async function sendGapAlert(
  managerEmail: string,
  homeId: string,
  weekStart: string,
  unfilledCount: number
): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@carerota.co.uk'

  try {
    await getResend().emails.send({
      from,
      to: managerEmail,
      subject: `Action required: ${unfilledCount} unfilled shift(s) — week of ${weekStart}`,
      html: gapAlertHtml(homeId, weekStart, unfilledCount),
    })
  } catch (err) {
    console.error('[notify] Gap alert email failed:', err)
  }
}
