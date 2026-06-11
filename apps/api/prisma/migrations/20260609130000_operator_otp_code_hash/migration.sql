-- Phase 9.1 / 1C.2 — OTP challenge code hash (scrypt, verifier-side)
ALTER TABLE mobile_otp_challenges
  ADD COLUMN IF NOT EXISTS code_hash TEXT NOT NULL DEFAULT '';
