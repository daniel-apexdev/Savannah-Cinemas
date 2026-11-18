-- ============================================================
-- SAVANNAH CINEMAS - BOOKING RECEIPTS
-- 2026-11-18_booking_receipts.sql
--
-- Remembers where each booking's confirmation email went and when,
-- for booking history and "email it again".
--
-- Safe to run more than once. The backend works without it (it just
-- won't remember the address or the time sent).
-- ============================================================

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS receipt_email VARCHAR(255);

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP;

COMMENT ON COLUMN bookings.receipt_email IS
    'Address the booking confirmation was sent to (chosen at checkout; defaults to the account email)';

COMMENT ON COLUMN bookings.confirmation_sent_at IS
    'When the confirmation email was last sent successfully';

-- History lists a user's bookings newest first
CREATE INDEX IF NOT EXISTS idx_bookings_user_date
    ON bookings (user_id, booking_date DESC);
