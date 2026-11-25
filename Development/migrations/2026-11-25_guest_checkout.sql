-- ============================================================
-- SAVANNAH CINEMAS - BOOK WITHOUT AN ACCOUNT (WEBSITE)
-- 2026-11-25_guest_checkout.sql
--
-- The website lets people book without signing in. Each visitor who
-- books gets a guest user (users.is_guest = 'Y', no sign-in) and a
-- guest session token kept in their browser. Their tickets are
-- emailed to the address they give at checkout (bookings.receipt_email).
--
-- Safe to run more than once.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest CHAR(1) DEFAULT 'N' NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_is_guest') THEN
        ALTER TABLE users ADD CONSTRAINT ck_users_is_guest CHECK (is_guest IN ('Y','N'));
    END IF;
END $$;

-- Guests never have a password
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Where the tickets go (also used by "email it again")
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS receipt_email VARCHAR(254);

CREATE TABLE IF NOT EXISTS guest_sessions (
    token_hash   CHAR(64) PRIMARY KEY,               -- sha256 of the token; the token itself is never stored
    user_id      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,
    expires_at   TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_guest_sessions_user ON guest_sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_users_is_guest ON users (is_guest) WHERE is_guest = 'Y';

COMMENT ON TABLE guest_sessions IS 'Website visitors who book without an account';

-- Supabase: no direct access from the public keys (same as every table)
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;
