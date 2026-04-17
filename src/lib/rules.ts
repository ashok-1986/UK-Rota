import type { Shift, RotaShift, HomeRules } from '@/types';

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  warnings: string[];
}

export interface GapResult {
  date: string;
  shift_id: string;
  shift_name: string;
  assigned: number;
  required: number;
}

/** Converts 3 rule rows from the DB into a typed HomeRules object. */
export function parseRules(rows: { rule_type: string; value: number }[]): HomeRules {
  const get = (type: string, def: number) =>
    Number(rows.find(r => r.rule_type === type)?.value ?? def);
  return {
    minRestHours:       get('min_rest_hours', 11),
    maxWeeklyHours:     get('max_weekly_hours', 48),
    maxConsecutiveDays: get('max_consecutive_days', 6),
  };
}

function getShiftDates(date: string, startTime: string, endTime: string): { start: Date; end: Date } {
  const start = new Date(`${date}T${startTime}Z`);
  let end = new Date(`${date}T${endTime}Z`);
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function getShiftDurationHours(startTime: string, endTime: string): number {
  const start = new Date(`1970-01-01T${startTime}Z`);
  let end = new Date(`1970-01-01T${endTime}Z`);
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

interface StaffData {
  night_shifts_ok: boolean;
}

interface ExtendedRotaShift extends RotaShift {
  shift: Shift;
}

const UK_WTR_DEFAULTS: HomeRules = {
  minRestHours: 11,
  maxWeeklyHours: 48,
  maxConsecutiveDays: 6,
};

export function validateAssignment(
  candidateDate: string,
  candidateShift: Shift,
  staffData: StaffData,
  staffExistingShiftsThisWeek: ExtendedRotaShift[],
  homeRules: HomeRules | null
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    violations: [],
    warnings: [],
  };

  const rules = homeRules ?? UK_WTR_DEFAULTS;

  const { start: newStart, end: newEnd } = getShiftDates(candidateDate, candidateShift.start_time, candidateShift.end_time);
  const newDuration = getShiftDurationHours(candidateShift.start_time, candidateShift.end_time);

  let currentWeeklyHours = 0;
  let minRestViolation = false;

  for (const existing of staffExistingShiftsThisWeek) {
    if (existing.status === 'cancelled') continue;

    const existingDuration = getShiftDurationHours(existing.shift.start_time, existing.shift.end_time);
    currentWeeklyHours += existingDuration;

    const existingDate = existing.date || existing.shift_date;
    const { start: existingStart, end: existingEnd } = getShiftDates(existingDate, existing.shift.start_time, existing.shift.end_time);

    if (newStart < existingEnd && newEnd > existingStart) {
      result.isValid = false;
      result.violations.push('Shift overlaps with an existing shift.');
    }

    if (existingEnd <= newStart) {
      const restHours = (newStart.getTime() - existingEnd.getTime()) / (1000 * 60 * 60);
      if (restHours < rules.minRestHours) minRestViolation = true;
    }
    if (newEnd <= existingStart) {
      const restHours = (existingStart.getTime() - newEnd.getTime()) / (1000 * 60 * 60);
      if (restHours < rules.minRestHours) minRestViolation = true;
    }
  }

  if (minRestViolation) {
    result.isValid = false;
    result.violations.push(`Minimum rest of ${rules.minRestHours} hours between shifts is not met.`);
  }

  if (currentWeeklyHours + newDuration > rules.maxWeeklyHours) {
    result.isValid = false;
    result.violations.push(`Exceeds maximum weekly hours of ${rules.maxWeeklyHours}.`);
  } else if (currentWeeklyHours + newDuration > rules.maxWeeklyHours - 8) {
    result.warnings.push(`Staff is approaching maximum weekly hours (${currentWeeklyHours + newDuration} / ${rules.maxWeeklyHours}).`);
  }

  if (candidateShift.is_night && !staffData.night_shifts_ok) {
    result.isValid = false;
    result.violations.push('Staff member is not eligible for night shifts.');
  }

  return result;
}

export function calculateGaps(
  shifts: Shift[],
  rotaShifts: RotaShift[],
  weekDates: string[]
): GapResult[] {
  const gaps: GapResult[] = [];

  for (const date of weekDates) {
    for (const shift of shifts) {
      const assigned = rotaShifts.filter(rs => {
        const shiftDate = rs.date || rs.shift_date;
        return shiftDate === date && rs.shift_id === shift.id && rs.status !== 'cancelled';
      }).length;
      const required = 1;

      if (assigned < required) {
        gaps.push({
          date,
          shift_id: shift.id,
          shift_name: shift.name,
          assigned,
          required,
        });
      }
    }
  }

  return gaps;
}
