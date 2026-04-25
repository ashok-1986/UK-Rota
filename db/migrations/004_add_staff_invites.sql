-- 004_add_staff_invites.sql
-- Staff invitation system — managers invite staff via email with a unique token

CREATE TABLE IF NOT EXISTS staff_invites (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id       UUID          NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  email         VARCHAR(255)  NOT NULL,
  role          VARCHAR(50)   NOT NULL CHECK (role IN ('home_manager','unit_manager','care_staff','bank_staff')),
  invited_by    UUID          NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  token         VARCHAR(64)   NOT NULL UNIQUE,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','cancelled')),
  expires_at    TIMESTAMPTZ   NOT NULL,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_token   ON staff_invites(token);
CREATE INDEX IF NOT EXISTS idx_staff_invites_home_id ON staff_invites(home_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email   ON staff_invites(email);
