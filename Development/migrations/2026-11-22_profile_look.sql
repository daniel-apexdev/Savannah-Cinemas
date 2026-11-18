-- ============================================================
-- SAVANNAH CINEMAS - USERNAME, AVATAR, PROFILE BACKDROP
-- 2026-11-22_profile_look.sql
--
-- username       shown on the profile as @name. Unique, not case
--                sensitive. New accounts get a generated one
--                (e.g. VelvetCritic27) that they can change.
-- avatar_key     one of the app's preset avatars ('lion', 'owl', ...)
-- profile_backdrop_movie_id / _url
--                a film still chosen as the profile header
--
-- Existing accounts get a username from their first name and user
-- id (e.g. ama_12) so every account has one.
-- Safe to run more than once.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_backdrop_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_backdrop_movie_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_backdrop_movie') THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_backdrop_movie
            FOREIGN KEY (profile_backdrop_movie_id) REFERENCES movies(movie_id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_username_lower ON users (LOWER(username));

UPDATE users
SET username = COALESCE(NULLIF(LEFT(regexp_replace(LOWER(forenames), '[^a-z0-9]', '', 'g'), 14), ''), 'fan') || '_' || user_id::text
WHERE username IS NULL;
