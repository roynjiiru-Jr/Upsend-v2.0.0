-- Migration 0005: Bring Your Own Payment refactor
-- Adds payment detail fields to events table
-- Resets contributions table to simple schema (name, amount, message)

-- ── 1. Add payment fields to events ─────────────────────────────────────────
ALTER TABLE events ADD COLUMN payment_method  TEXT;  -- mpesa_phone | mpesa_paybill | mpesa_till | bank_transfer | external_link
ALTER TABLE events ADD COLUMN payment_phone   TEXT;  -- for mpesa_phone
ALTER TABLE events ADD COLUMN payment_name    TEXT;  -- for mpesa_phone, mpesa_till
ALTER TABLE events ADD COLUMN payment_paybill TEXT;  -- for mpesa_paybill
ALTER TABLE events ADD COLUMN payment_account TEXT;  -- for mpesa_paybill (account number)
ALTER TABLE events ADD COLUMN payment_till    TEXT;  -- for mpesa_till
ALTER TABLE events ADD COLUMN payment_link    TEXT;  -- for external_link

-- ── 2. Notes on contributions table ─────────────────────────────────────────
-- contributor_phone, contributor_email, transaction_id, payment_source, message
-- were already added in migration 0004. No further schema changes needed here.
-- We use contributor_name as 'name' in the app layer for backwards compatibility.

-- ── 3. Drop Pesapal payments table (no longer needed) ───────────────────────
DROP TABLE IF EXISTS pesapal_payments;
