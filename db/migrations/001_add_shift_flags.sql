-- Migration: Add is_night and is_weekend to shifts
-- Run this on your Neon database

ALTER TABLE shifts 
ADD COLUMN IF NOT EXISTS is_night BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_weekend BOOLEAN NOT NULL DEFAULT FALSE;

-- Verify the columns were added
SELECT name, is_night, is_weekend FROM shifts LIMIT 5;