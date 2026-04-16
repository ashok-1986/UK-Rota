-- Migration: Add staff_availability table
-- Run this on your Neon database

CREATE TABLE IF NOT EXISTS staff_availability (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  reason      VARCHAR(100) DEFAULT 'unavailable',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_date ON staff_availability(staff_id, date);