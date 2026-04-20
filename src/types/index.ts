// =============================================================
// CareRota — TypeScript type definitions
// Aligned with PostgreSQL schema and API contracts
// =============================================================

export type AppRole = 'system_admin' | 'home_manager' | 'unit_manager' | 'care_staff' | 'bank_staff';
export type UserRole = AppRole;
export type EmploymentType = 'full_time' | 'part_time' | 'bank';
export type RotaStatus = 'draft' | 'published' | 'confirmed' | 'cancelled';
export type RotaShiftStatus = RotaStatus;
export type RuleType = 'min_rest_hours' | 'max_weekly_hours' | 'max_consecutive_days';

export interface Home {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  timezone: string;
  max_staff: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  clerk_org_id?: string | null;
}

export interface Unit {
  id: string;
  home_id: string;
  name: string;
  max_staff: number;
  created_at: string;
  updated_at: string;
}

export interface Staff {
  id: string;
  clerk_user_id: string;
  home_id: string;
  unit_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: AppRole;
  employment_type: EmploymentType | null;
  contracted_hours: number | null;
  max_hours_week: number;
  night_shifts_ok: boolean;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffMinimal {
  id: string;
  clerk_user_id: string;
  home_id: string;
  unit_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: AppRole;
  employment_type: EmploymentType | null;
  contracted_hours: number | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  home_id: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  color: string;
  is_night: boolean;
  is_weekend: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RotaShift {
  id: string;
  home_id: string;
  shift_id: string;
  staff_id: string | null;
  unit_id: string | null;
  shift_date: string;
  date?: string;
  week_start: string;
  status: RotaStatus;
  notes: string | null;
  confirmed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Rule {
  id: string;
  home_id: string;
  rule_type: RuleType;
  value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HomeRules {
  minRestHours: number;
  maxWeeklyHours: number;
  maxConsecutiveDays: number;
}

export interface Log {
  id: string;
  actor_id: string | null;
  home_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata_json: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface WeekViewCell {
  shift: Shift;
  rota_shift: RotaShift | null;
  staff: Staff | null;
}

export interface WeekView {
  home_id: string;
  week_start: string;
  days: Record<string, WeekViewCell[]>;
}

export interface RotaShiftDetailed extends RotaShift {
  shift: Shift;
  staff: Staff | null;
}

export interface RulesViolation {
  rule: string;
  message: string;
  current: number;
  limit: number;
  severity?: 'block' | 'warn';
}

export interface RulesResult {
  isValid: boolean;
  violations: RulesViolation[];
  warnings: string[];
  gaps: Array<{ shiftId: string; shiftDate: string; required: number; actual: number }>;
}

export interface RulesCheckInput {
  staffId: string;
  shiftId: string;
  shiftDate: string;
  homeId: string;
}

export interface RulesCheckResult {
  valid: boolean;
  violations: RulesViolation[];
}

export interface StaffDataExport {
  staff: Staff;
  rota_shifts: (RotaShift & { shift_name: string })[];
  logs: Log[];
  exported_at: string;
}

// Canonical camelCase facades (for new code)
export interface StaffCanonical {
  id: string;
  clerkUserId: string;
  homeId: string;
  unitId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  employmentType: EmploymentType | null;
  contractedHours: number | null;
  maxHoursWeek: number;
  nightShiftsOk: boolean;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LogCanonical {
  id: string;
  actorId: string | null;
  homeId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadataJson: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface CreateHomePayload {
  homeName: string;
  homeAddress: string;
  homeEmail?: string;
  managerFirstName: string;
  managerLastName: string;
  managerEmail: string;
  managerPassword: string;
}

export interface CreateStaffPayload {
  homeId: string;
  unitId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: AppRole;
  employmentType: EmploymentType;
  contractedHours?: number;
  password: string;
}

export interface UpdateStaffPayload {
  unitId?: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  role?: AppRole;
  employmentType?: EmploymentType;
  contractedHours?: number | null;
  isActive?: boolean;
}

export interface AssignShiftPayload {
  shiftId: string;
  staffId: string | null;
  shiftDate: string;
  unitId?: string;
  notes?: string;
  override?: boolean;
}

export interface CreateRulePayload {
  homeId: string;
  ruleType: string;
  value: number;
}

export interface ShiftReminderData {
  staff: Staff;
  shift: RotaShiftDetailed;
}

export interface GapAlertData {
  homeId: string;
  weekStart: string;
  gapsCount: number;
}
