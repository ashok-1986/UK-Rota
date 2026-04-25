// =============================================================
// CareRota — TypeScript type definitions
// Aligned with PostgreSQL schema and API contracts
// =============================================================

// ------------------------------------------------------------------
// Roles and status enums
// ------------------------------------------------------------------

export type AppRole = 'system_admin' | 'home_manager' | 'unit_manager' | 'care_staff' | 'bank_staff';
export type EmploymentType = 'full_time' | 'part_time' | 'bank';
export type RotaStatus = 'draft' | 'published' | 'confirmed' | 'cancelled';

// ------------------------------------------------------------------
// Core entity types (aligned with PostgreSQL schema)
// ------------------------------------------------------------------

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
  // Clerk integration
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
  start_time: string; // TIME format HH:mm:ss
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
  shift_date: string; // DATE format YYYY-MM-DD
  date?: string; // Alias for shift_date (for rules engine compatibility)
  week_start: string; // YYYY-MM-DD (Monday)
  status: RotaStatus;
  notes: string | null;
  confirmed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type RuleType = 'min_rest_hours' | 'max_weekly_hours' | 'max_consecutive_days';

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
  minRestHours: number;       // rule_type: 'min_rest_hours'  (default 11)
  maxWeeklyHours: number;     // rule_type: 'max_weekly_hours' (default 48)
  maxConsecutiveDays: number; // rule_type: 'max_consecutive_days' (default 6)
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

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface StaffInvite {
  id: string;
  home_id: string;
  email: string;
  role: AppRole;
  invited_by: string;         // staff.id of the manager who sent it
  token: string;              // 64-char crypto random hex token
  status: InviteStatus;
  expires_at: string;         // TIMESTAMPTZ — 72 hours from creation
  accepted_at: string | null;
  created_at: string;
}

// ------------------------------------------------------------------
// Extended/joined types for UI and API responses
// ------------------------------------------------------------------

export interface WeekViewCell {
  shift: Shift;
  rota_shift: RotaShift | null;
  staff: Staff | null;
}

export interface WeekView {
  home_id: string;
  week_start: string;
  days: Record<string, WeekViewCell[]>; // keyed by YYYY-MM-DD
}

export interface RotaShiftDetailed extends RotaShift {
  shift: Shift;
  staff: Staff | null;
}

// ------------------------------------------------------------------
// Rules engine types
// ------------------------------------------------------------------

export interface RulesViolation {
  rule: string;
  message: string;
  current: number;
  limit: number;
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

// ------------------------------------------------------------------
// GDPR types
// ------------------------------------------------------------------

export interface StaffDataExport {
  staff: Staff;
  rota_shifts: (RotaShift & { shift_name: string })[];
  logs: Log[];
  exported_at: string;
}

// ------------------------------------------------------------------
// API request/response types
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Notification types
// ------------------------------------------------------------------

export interface ShiftReminderData {
  staff: Staff;
  shift: RotaShiftDetailed;
}

export interface GapAlertData {
  homeId: string;
  homeName: string;
  weekStart: string;
  unfilledCount: number;
  managerEmail: string;
}

// ------------------------------------------------------------------
// Session/Auth context types
// ------------------------------------------------------------------

export interface SessionContext {
  userId: string;
  role: AppRole;
  homeId: string | null;
}

export interface SessionMetadata {
  role?: AppRole;
  homeId?: string;
}

// ------------------------------------------------------------------
// Report types
// ------------------------------------------------------------------

export interface HoursReportRow {
  staff: Staff;
  shifts: RotaShiftDetailed[];
  totalHours: number;
}

// ------------------------------------------------------------------
// Utility types
// ------------------------------------------------------------------

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export const DAYS_OF_WEEK: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}
