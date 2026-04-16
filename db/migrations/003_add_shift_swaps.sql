-- Migration: Add shift_swaps table
-- Run this on your Neon database

CREATE TABLE IF NOT EXISTS shift_swaps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id        UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  target_id         UUID REFERENCES staff(id) ON DELETE SET NULL,
  requester_shift_id  UUID NOT NULL REFERENCES rota_shifts(id) ON DELETE CASCADE,
  target_shift_id  UUID REFERENCES rota_shifts(id) ON DELETE SET NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason            TEXT,
  response_note     TEXT,
  reviewed_by       UUID REFERENCES staff(id),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_swaps_requester ON shift_swaps(requester_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_target ON shift_swaps(target_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON shift_swaps(status);