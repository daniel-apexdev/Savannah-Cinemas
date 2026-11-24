-- ============================================================
-- Savannah Cinemas: scheduled jobs on Supabase
--
-- The Node server used to run these on timers. On Supabase the api
-- Edge Function has no timers, so pg_cron calls its job routes instead.
--
-- Run this whole file in the SQL editor after changing <project-ref>
-- below. Running it again is safe: it keeps the existing secret and just
-- updates the schedules.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Where the api function lives (Vault, so the jobs and the function
-- agree on one place). Change <project-ref> before running.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'savannah_api_url') then
    perform vault.create_secret('https://<project-ref>.supabase.co/functions/v1/api', 'savannah_api_url', 'Savannah api Edge Function URL');
  end if;
  -- The shared jobs secret: random, kept in Vault. The api function reads
  -- the same value from Vault, so nobody needs to copy it anywhere.
  if not exists (select 1 from vault.secrets where name = 'savannah_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'savannah_cron_secret', 'Secret for POST /api/jobs/*');
  end if;
end $$;

create or replace function public.savannah_run_job(job text)
returns bigint
language sql
security definer
set search_path = public, extensions
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'savannah_api_url') || '/jobs/' || job,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'savannah_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$$;

-- Only the database itself (pg_cron) may call it
revoke all on function public.savannah_run_job(text) from public, anon, authenticated;

-- Films move upcoming -> showing -> ended
select cron.schedule('savannah-movie-status', '7 * * * *', $$ select public.savannah_run_job('movie-status') $$);

-- Booking reminders and film alerts
select cron.schedule('savannah-notifications', '*/10 * * * *', $$ select public.savannah_run_job('notifications') $$);

-- Keep the next two weeks programmed
select cron.schedule('savannah-showtimes', '23 */6 * * *', $$ select public.savannah_run_job('showtimes') $$);

-- New films from TMDB, early morning Accra time (UTC)
select cron.schedule('savannah-catalog', '41 4 * * *', $$ select public.savannah_run_job('catalog?pages=1') $$);

-- Check runs:      select * from cron.job_run_details order by start_time desc limit 20;
-- Check replies:   select id, status_code, left(content, 200) from net._http_response order by created desc limit 20;
-- Stop a job:      select cron.unschedule('savannah-catalog');
