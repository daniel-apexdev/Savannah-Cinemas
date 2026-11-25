-- ============================================================
-- SAVANNAH CINEMAS - GUEST TICKETS FOLLOW THE EMAIL
-- 2026-11-25_guest_ticket_lookup.sql
--
-- When someone signs in with an email they used for guest bookings on
-- the website, those bookings move into their account. This index makes
-- that lookup (by checkout email) quick.
--
-- Safe to run more than once.
-- ============================================================

CREATE INDEX IF NOT EXISTS ix_bookings_receipt_email
    ON bookings (LOWER(TRIM(receipt_email)))
    WHERE receipt_email IS NOT NULL;
