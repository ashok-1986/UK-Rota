// =============================================================
// Date utilities — UK ISO week conventions
// Week always starts on Monday (ISO 8601)
// =============================================================
import { startOfISOWeek, format, addDays, parseISO, isValid } from 'date-fns'

/**
 * Given any date string (YYYY-MM-DD), returns the Monday of that ISO week.
 */
export function getWeekStart(dateStr: string): string {
  const date = parseISO(dateStr)
  if (!isValid(date)) throw new Error(`Invalid date: ${dateStr}`)
  return format(startOfISOWeek(date), 'yyyy-MM-dd')
}

/**
 * Returns an array of 7 date strings (Mon–Sun) for the ISO week
 * containing the given date.
 */
export function getWeekDays(weekStart: string): string[] {
  const monday = parseISO(weekStart)
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(monday, i), 'yyyy-MM-dd')
  )
}

/**
 * Format a TIME string (HH:MM:SS from Postgres) to HH:MM.
 */
export function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

/**
 * Format a DATE string (YYYY-MM-DD) to a human-readable form.
 * e.g. '2026-04-14' → 'Mon 14 Apr'
 */
export function formatShortDate(dateStr: string): string {
  const date = parseISO(dateStr)
  return format(date, 'EEE d MMM')
}

/**
 * Format a DATE string to a long form.
 * e.g. '2026-04-14' → '14 April 2026'
 */
export function formatLongDate(dateStr: string): string {
  const date = parseISO(dateStr)
  return format(date, 'd MMMM yyyy')
}

/**
 * Returns a display label for a week, e.g. '14–20 Apr 2026'.
 */
export function formatWeekRange(weekStart: string): string {
  const monday = parseISO(weekStart)
  const sunday = addDays(monday, 6)
  if (format(monday, 'MMM yyyy') === format(sunday, 'MMM yyyy')) {
    return `${format(monday, 'd')}–${format(sunday, 'd MMM yyyy')}`
  }
  if (format(monday, 'yyyy') === format(sunday, 'yyyy')) {
    return `${format(monday, 'd MMM')}–${format(sunday, 'd MMM yyyy')}`
  }
  return `${format(monday, 'd MMM yyyy')}–${format(sunday, 'd MMM yyyy')}`
}

/**
 * Validates that a string is a Monday in YYYY-MM-DD format.
 * Returns the validated string or throws.
 */
export function validateWeekStart(weekStart: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    throw new Error('week_start must be YYYY-MM-DD')
  }
  const date = parseISO(weekStart)
  if (!isValid(date)) throw new Error('week_start is not a valid date')
  // ISO day 1 = Monday
  if (date.getDay() !== 1) {
    throw new Error('week_start must be a Monday')
  }
  return weekStart
}

/**
 * Returns the staff member's full name.
 */
export function fullName(staff: { first_name: string; last_name: string }): string {
  return `${staff.first_name} ${staff.last_name}`
}

/**
 * Capitalise the first letter of each word.
 */
export function titleCase(str: string): string {
  return str
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
