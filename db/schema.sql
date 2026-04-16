-- =============================================================
-- CareRota — Multi-tenant PostgreSQL Schema
-- Region: EU-London (UK/EU data sovereignty)
-- UK-GDPR: All personal data stays in UK/EU
-- Retention: Rota/staff data = 12 months, Logs = 3 years
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- HOMES (Tenant Root)
-- Each care home is a tenant.
-- System admins manage homes; managers and staff belong to a home.
-- =============================================================
CREATE TABLE homes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  address       TEXT,
  email         VARCHAR(255),
  timezone      TEXT        NOT NULL DEFAULT 'Europe/London',
  max_staff     INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  clerk_org_id  VARCHAR(255),  -- Clerk organization ID for SSO/permissions
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
-- UNITS (Wards/Departments within a home)
-- Optional grouping within a home (e.g., Ground Floor, First Floor)
-- =============================================================
CREATE TABLE units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id     UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  max_staff   INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================
-- STAFF (Belongs to a home + optional unit)
-- Soft-delete via deleted_at (GDPR right to erasure)
-- Retention: 12 months after deletion
-- =============================================================
CREATE TABLE staff (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id       VARCHAR(255) NOT NULL,  -- Clerk user ID
  home_id             UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  unit_id             UUID REFERENCES units(id) ON DELETE SET NULL,
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  email               VARCHAR(255) UNIQUE NOT NULL,
  phone               VARCHAR(20),
  role                VARCHAR(50) NOT NULL
    CHECK (role IN ('system_admin', 'home_manager', 'unit_manager', 'care_staff', 'bank_staff')),
  employment_type     VARCHAR(20)
    CHECK (employment_type IN ('full_time', 'part_time', 'bank')),
  contracted_hours    NUMERIC(5,1),  -- e.g., 37.5
  max_hours_week      INT NOT NULL DEFAULT 48,
  night_shifts_ok    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at          TIMESTAMPTZ,  -- Soft-delete for GDPR
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- SHIFTS (Shift Templates per home)
-- Standard shift types: Early, Late, Night
-- =============================================================
CREATE TABLE shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id         UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  duration_hours  NUMERIC(4,1) NOT NULL,
  color           VARCHAR(7) NOT NULL DEFAULT '#3B82F6',  -- Hex color for UI
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- ROTA_SHIFTS (Staff Assignments to Shifts)
-- Tenant-scoped by home_id. week_start = Monday of the ISO week.
-- Retention: 12 months
-- =============================================================
CREATE TABLE rota_shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id         UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  shift_id        UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_id        UUID REFERENCES staff(id) ON DELETE SET NULL,
  unit_id         UUID REFERENCES units(id) ON DELETE SET NULL,
  shift_date      DATE NOT NULL,
  week_start      DATE NOT NULL,  -- Monday of ISO week
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'confirmed', 'cancelled')),
  notes           TEXT,
  confirmed_at    TIMESTAMPTZ,
  created_by      UUID NOT NULL,  -- FK to staff.id of creator
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- RULES (Per-home Working Time Regulations settings)
-- Stored as key-value pairs; engine reads per-home rules
-- =============================================================
CREATE TABLE rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id         UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  rule_type       VARCHAR(50) NOT NULL
    CHECK (rule_type IN ('min_rest_hours', 'max_weekly_hours', 'max_consecutive_days')),
  value           NUMERIC(6,2) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(home_id, rule_type)
);

-- =============================================================
-- LOGS (Audit Trail)
-- Records all significant actions for compliance and security.
-- Retention: 3 years
-- =============================================================
CREATE TABLE logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID,  -- FK to staff.id (nullable for system actions)
  home_id         UUID,  -- Tenant scope
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(100) NOT NULL,
  entity_id       UUID,
  metadata_json   JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- INDEXES (Performance optimization)
-- =============================================================

-- Homes
CREATE INDEX idx_homes_active ON homes(is_active) WHERE is_active = TRUE;

-- Units
CREATE INDEX idx_units_home_id ON units(home_id);

-- Staff
CREATE INDEX idx_staff_home_id ON staff(home_id);
CREATE INDEX idx_staff_clerk_user_id ON staff(clerk_user_id);
CREATE INDEX idx_staff_email ON staff(email);
CREATE INDEX idx_staff_active_home ON staff(home_id) WHERE is_active = TRUE AND deleted_at IS NULL;

-- Shifts
CREATE INDEX idx_shifts_home_active ON shifts(home_id) WHERE is_active = TRUE;

-- Rota Shifts (most queried)
CREATE INDEX idx_rota_shifts_home_week ON rota_shifts(home_id, week_start);
CREATE INDEX idx_rota_shifts_staff_date ON rota_shifts(staff_id, shift_date);
CREATE INDEX idx_rota_shifts_home_date ON rota_shifts(home_id, shift_date);
CREATE INDEX idx_rota_shifts_home_week_status ON rota_shifts(home_id, week_start, status);

-- Rules
CREATE INDEX idx_rules_home_active ON rules(home_id) WHERE is_active = TRUE;

-- Logs
CREATE INDEX idx_logs_home_action ON logs(home_id, action);
CREATE INDEX idx_logs_actor ON logs(actor_id);
CREATE INDEX idx_logs_created_at ON logs(created_at);

-- =============================================================
-- SEED DATA: Default shifts for new homes
-- =============================================================
-- Note: Inserted by application logic when a new home is created
-- Default shift templates:
--   Early:  07:00 - 15:00 (8h)
--   Late:   14:00 - 22:00 (8h)
--   Night:  22:00 - 07:00 (9h)

-- =============================================================
-- DATA RETENTION COMMENTS (UK-GDPR compliance)
-- =============================================================
-- Rota data: DELETE records older than 12 months from rota_shifts
-- Staff data: DELETE staff records 12 months after deleted_at is set
-- Logs: DELETE log entries older than 3 years
-- Implement via scheduled job (e.g., Vercel Cron or pg_cron)

-- =============================================================
-- SECURITY COMMENTS
-- =============================================================
-- Row-Level Security (RLS) can be enabled for additional isolation:
--   ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY staff_tenant_isolation ON staff USING (home_id = current_home_id());
-- For MVP, application-level scoping via home_id is sufficient.
