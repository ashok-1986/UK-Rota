// src/mocks.ts

export type MockHome = {
  id: string;
  name: string;
  max_staff: number;
};

export type MockUnit = {
  id: string;
  home_id: string;
  name: string;
  max_staff: number;
};

export type MockStaff = {
  id: string;
  name: string;
  role: string;
  skills: string[];
  max_hours_week: number;
  night_shifts_ok: boolean;
  email: string;
  phone: string | null;
};

export type MockShift = {
  id: string;
  name: string;
  start_time: string;  // e.g. "08:00"
  end_time: string;    // e.g. "16:00"
  is_night: boolean;
  is_weekend: boolean;
};

export type MockRotaShift = {
  id: string;
  staff_id: string | null;
  shift_id: string;
  home_id: string;
  unit_id: string;
  date: string;        // "2026-04-14"
  status: "draft" | "published" | "confirmed" | "cancelled";
};

export type MockRule = {
  home_id: string;
  min_rest_hours: number;
  max_weekly_hours: number;
  max_consecutive_days: number;
};

export type MockLog = {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
};

// === Example mock data ===

export const mockHome: MockHome = {
  id: "home-001",
  name: "Ashok Care Home (MVP)",
  max_staff: 20,
};

export const mockUnits: MockUnit[] = [
  {
    id: "unit-001",
    home_id: "home-001",
    name: "Unit A - Ground Floor",
    max_staff: 10,
  },
  {
    id: "unit-002",
    home_id: "home-001",
    name: "Unit B - First Floor",
    max_staff: 10,
  },
];

export const mockStaff: MockStaff[] = [
  {
    id: "staff-001",
    name: "Alice Smith",
    role: "Senior Care Assistant",
    skills: ["night-shift", "dementia-care"],
    max_hours_week: 48,
    night_shifts_ok: true,
    email: "alice@example.com",
    phone: "+44 7900 123456",
  },
  {
    id: "staff-002",
    name: "Bob Johnson",
    role: "Care Assistant",
    skills: [],
    max_hours_week: 40,
    night_shifts_ok: false,
    email: "bob@example.com",
    phone: "+44 7900 123457",
  },
  {
    id: "staff-003",
    name: "Charlie Brown",
    role: "Nurse",
    skills: ["night-shift", "meds-management"],
    max_hours_week: 40,
    night_shifts_ok: true,
    email: "charlie@example.com",
    phone: "+44 7900 123458",
  },
];

export const mockShifts: MockShift[] = [
  {
    id: "shift-001",
    name: "Early",
    start_time: "07:00",
    end_time: "15:00",
    is_night: false,
    is_weekend: false,
  },
  {
    id: "shift-002",
    name: "Late",
    start_time: "14:00",
    end_time: "22:00",
    is_night: false,
    is_weekend: false,
  },
  {
    id: "shift-003",
    name: "Night",
    start_time: "22:00",
    end_time: "07:00",
    is_night: true,
    is_weekend: false,
  },
];

export const generateMockRota: () => MockRotaShift[] = () => {
  const baseDate = new Date("2026-04-14");
  const weekDays = 7;
  const shiftsPerDay = mockShifts.length;
  const mockRota: MockRotaShift[] = [];

  for (let dayIdx = 0; dayIdx < weekDays; dayIdx++) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + dayIdx);
    const dateString = date.toISOString().split("T")[0];

    for (const shift of mockShifts) {
      const rand = Math.random();
      let staffId: string | null = null;

      if (rand < 0.4) {
        staffId = "staff-001"; // Always assign Alice
      } else if (rand < 0.8) {
        staffId = "staff-002";
      } else if (rand < 0.95) {
        staffId = "staff-003";
      }

      mockRota.push({
        id: `${dateString}-${shift.id}`,
        staff_id: staffId,
        shift_id: shift.id,
        home_id: "home-001",
        unit_id: "unit-001",
        date: dateString,
        status: "draft",
      });
    }
  }

  return mockRota;
};

export const mockRules: MockRule[] = [
  {
    home_id: "home-001",
    min_rest_hours: 11,
    max_weekly_hours: 48,
    max_consecutive_days: 6,
  },
];

export const mockLogs: MockLog[] = [
  {
    id: "log-001",
    actor_id: "staff-001",
    action: "rota.assign",
    entity_type: "rota_shift",
    entity_id: "2026-04-14-shift-001",
    metadata: {
      previous_staff_id: null,
      new_staff_id: "staff-001",
    },
    ip_address: "192.0.2.1",
    user_agent: "Firefox/102.0",
  },
];
