import type { Shift, RotaShift } from '@/types';

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

interface HomeRules {
  min_hours_between_shifts: number;
  max_hours_week: number;
  max_night_shifts_week: number;
  rest_break_hours: number;
}

interface ExtendedRotaShift extends RotaShift {
  shift: Shift;
}

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

  const rules = homeRules || {
    min_hours_between_shifts: 11,
    max_hours_week: 48,
    max_night_shifts_week: 3,
    rest_break_hours: 11,
  };

  const { start: newStart, end: newEnd } = getShiftDates(candidateDate, candidateShift.start_time, candidateShift.end_time);
  const newDuration = getShiftDurationHours(candidateShift.start_time, candidateShift.end_time);

  let currentWeeklyHours = 0;
  let currentNightShifts = 0;

  let minRestViolation = false;

  for (const existing of staffExistingShiftsThisWeek) {
    if (existing.status === 'cancelled') continue;

    const existingDuration = getShiftDurationHours(existing.shift.start_time, existing.shift.end_time);
    currentWeeklyHours += existingDuration;

    if (existing.shift.is_night) {
      currentNightShifts += 1;
    }

    const existingDate = existing.date || existing.shift_date;
    const { start: existingStart, end: existingEnd } = getShiftDates(existingDate, existing.shift.start_time, existing.shift.end_time);
    
    // Check if overlaps
    if (newStart < existingEnd && newEnd > existingStart) {
      result.isValid = false;
      result.violations.push('Shift overlaps with an existing shift.');
    }

    // Check rest before
    if (existingEnd <= newStart) {
      const restHours = (newStart.getTime() - existingEnd.getTime()) / (1000 * 60 * 60);
      if (restHours < rules.min_hours_between_shifts) {
        minRestViolation = true;
      }
    }
    // Check rest after
    if (newEnd <= existingStart) {
      const restHours = (existingStart.getTime() - newEnd.getTime()) / (1000 * 60 * 60);
      if (restHours < rules.min_hours_between_shifts) {
        minRestViolation = true;
      }
    }
  }

  if (minRestViolation) {
    result.isValid = false;
    result.violations.push(`Minimum rest of ${rules.min_hours_between_shifts} hours between shifts is not met.`);
  }

  if (currentWeeklyHours + newDuration > rules.max_hours_week) {
    result.isValid = false;
    result.violations.push(`Exceeds maximum weekly hours of ${rules.max_hours_week}.`);
  } else if (currentWeeklyHours + newDuration > rules.max_hours_week - 8) {
    result.warnings.push(`Staff is approaching maximum weekly hours (${currentWeeklyHours + newDuration} / ${rules.max_hours_week}).`);
  }

  if (candidateShift.is_night) {
    if (!staffData.night_shifts_ok) {
      result.isValid = false;
      result.violations.push('Staff member is not eligible for night shifts.');
    }
    if (currentNightShifts + 1 > rules.max_night_shifts_week) {
      result.isValid = false;
      result.violations.push(`Exceeds maximum night shifts per week of ${rules.max_night_shifts_week}.`);
    }
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
          required
        });
      }
    }
  }
  
  return gaps;
}
