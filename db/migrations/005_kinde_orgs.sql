-- Add Kinde org mapping to homes
ALTER TABLE homes ADD COLUMN IF NOT EXISTS kinde_org_code VARCHAR(255) UNIQUE;

-- Rename column on staff table
ALTER TABLE staff RENAME COLUMN clerk_user_id TO kinde_user_id;

-- Update indexes
DROP INDEX IF EXISTS idx_staff_clerk_user_id;
CREATE INDEX IF NOT EXISTS idx_staff_kinde_user_id ON staff(kinde_user_id);
