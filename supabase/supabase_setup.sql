-- ============================================================
-- SAVANNAH CINEMAS: SUPABASE SETUP
-- (included at the end of the generated migration)
--
-- 1. Sign-in: our users rows are linked to Supabase Auth accounts
--    by users.auth_user_id. The API creates the users row the first
--    time someone signs in. Passwords live in Supabase Auth now, so
--    users.password_hash is optional.
-- 2. Security: the website and app never read tables directly; all
--    data goes through the "api" Edge Function. So the public schema
--    is closed to Supabase's automatic Data API: row level security
--    on every table, with no policies, and no table rights for the
--    anon / authenticated roles.
-- ============================================================

-- 1. Sign-in link ---------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uk_users_auth_user') THEN
        ALTER TABLE users ADD CONSTRAINT uk_users_auth_user UNIQUE (auth_user_id);
    END IF;

    -- Deleting a Supabase sign-in unlinks the account (the API anonymises it)
    IF to_regclass('auth.users') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_auth_user') THEN
        ALTER TABLE users
            ADD CONSTRAINT fk_users_auth_user
            FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 2. Close the public schema to the Data API ------------------------

DO $$
DECLARE
    t record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    END LOOP;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
        EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
        EXECUTE 'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';
        -- Tables made later (npm run db:migrate) stay closed too
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated';
    END IF;
END $$;
