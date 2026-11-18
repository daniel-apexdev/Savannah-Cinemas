-- ============================================================
-- Savannah Cinemas - booking hold expiry
-- Safe to run more than once.
--
-- createBooking() already writes bookings.expires_at, and the
-- seat map now ignores PENDING bookings whose hold has expired.
-- This makes sure the column exists on databases created from
-- savannah_cinemas_update_script.sql, which does not define it.
-- ============================================================

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_bookings_expires_at
    ON bookings(expires_at);
