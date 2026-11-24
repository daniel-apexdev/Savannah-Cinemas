# Savannah Cinemas

Cinema booking for **Savannah Cinemas, Accra Mall and West Hills Mall**: films, showtimes, seat booking with snacks, tickets, points, watchlist and reminders.

| Part | Where | What it is |
| --- | --- | --- |
| App (phone + web) | `mobile/` | Expo SDK 58, Expo Router, TypeScript. The same code builds the Android/iOS app and the website. |
| API | `backend/` | Express + Postgres. Runs on Supabase as one Edge Function (`api`), or locally with Node. |
| Database | `supabase/migrations/` | One consolidated Postgres migration (built from `Development/migrations/`). |
| Website | GitHub Pages | The web build of the app: https://daniel-apexdev.github.io/Savannah-Cinemas/ |
| Old website | `archive/website-v1/` | The original HTML pages, kept for reference. |

```
backend/          Express API (controllers, routes, services, jobs)
mobile/           Expo app: src/app = screens, src/lib = api/auth/supabase
supabase/
  config.toml     CLI settings (api function: verify_jwt = false)
  migrations/     database schema for Supabase
  functions/api/  Edge Function entry; server.bundle.js is built from backend/
  cron.sql        pg_cron schedules for the jobs
  build-migration.py   rebuilds the migration from Development/
Development/      Postgres scripts and dated migrations (source of truth)
images/           shared pictures (snacks/...), published with the website
```

---

## How it fits together on Supabase

- **Sign-in**: Supabase Auth (email + password). The app uses `@supabase/supabase-js`; the API checks the token with Supabase and links it to a row in `users` (`users.auth_user_id`).
- **API**: the whole Express server is bundled into the `api` Edge Function. Routes are unchanged: `/api/movies` is served at `https://<project-ref>.supabase.co/functions/v1/api/movies`.
- **Database**: Supabase Postgres. Row Level Security is on for every table with no policies, so the public anon key can't read tables directly; everything goes through the API.
- **Jobs**: pg_cron calls `POST /api/jobs/{movie-status|notifications|showtimes|catalog}` with an `x-cron-secret` header (see `supabase/cron.sql`).
- **Email**: Gmail SMTP on port 465 (Supabase blocks 25 and 587).

---

## First-time setup

### 1. Create the Supabase project
1. On https://supabase.com create a project (region: closest to Ghana, e.g. `eu-west`).
2. From **Project Settings > API Keys** note the **Project URL**, the **publishable** key (`sb_publishable_...`), and the **project ref** (the part before `.supabase.co`).

### 2. Create the database
Either, from the repo root:
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```
or open `supabase/migrations/20261124120000_savannah_cinemas.sql` and run it in the dashboard's **SQL editor**.

### 3. Auth settings (Authentication in the dashboard)
- **URL Configuration > Site URL**: `https://daniel-apexdev.github.io/Savannah-Cinemas`
- **Redirect URLs**: add `https://daniel-apexdev.github.io/Savannah-Cinemas/**` and, for testing, `http://localhost:8081/**`
- **Sign In / Providers > Email**: turn *Confirm email* on or off. With it on, new accounts get a confirmation email before they can sign in (the app tells them so).
- Optional: **SMTP Settings** so auth emails come from your Gmail instead of Supabase's limited sender.

### 4. Function secrets
`SUPABASE_URL`, `SUPABASE_DB_URL` and the project keys (`SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`) are provided automatically. Add these under **Edge Functions > Secrets**:

| Name | Value |
| --- | --- |
| `PUBLIC_SITE_URL` | `https://daniel-apexdev.github.io/Savannah-Cinemas` |
| `TMDB_API_KEY` | your TMDB key |
| `GMAIL_USER` | the Gmail address tickets are sent from |
| `GMAIL_APP_PASSWORD` | a Gmail app password for that address |

The jobs secret isn't set here: `supabase/cron.sql` creates a random one in Vault and the function reads it from there.

### 5. Deploy the API
```bash
cd backend
npm install
npm run deploy:api
```
This bundles the server into `supabase/functions/api/server.bundle.js` and deploys it. Check it: `https://<project-ref>.supabase.co/functions/v1/api/movies`.

### 6. Schedule the jobs
Replace `<project-ref>` in `supabase/cron.sql` and run it in the SQL editor.

### 7. First film sync
Run the jobs once from the SQL editor, one line at a time, waiting for each to finish:
```sql
select public.savannah_run_job('catalog?pages=1');   -- run it a few times for more films; bigger batches exceed the free plan's limits
select public.savannah_run_job('movie-status');
select public.savannah_run_job('showtimes');
-- replies: select status_code, left(content, 300) from net._http_response order by created desc;
```
Or locally: put the Supabase connection string in `backend/.env` as `DATABASE_URL` and run `npm run movies:sync` then `npm run showtimes:generate`.

### 8. The app
Copy `mobile/.env.example` to `mobile/.env` and fill in the Supabase URL and publishable key, then:
```bash
cd mobile
npm install
npx expo start          # phone (Expo Go / dev build) and web on http://localhost:8081
```

### 9. The website (GitHub Pages)
1. **Settings > Pages > Source**: *GitHub Actions*.
2. **Settings > Secrets and variables > Actions**: add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the publishable key).
3. Push to `main` (or run *Deploy web app* from the Actions tab). The workflow in `.github/workflows/deploy-web.yml` builds the web version, adds `images/`, and publishes it.

---

## Everyday work

| Task | Command |
| --- | --- |
| Run the app | `cd mobile && npx expo start` |
| Android dev build | `cd mobile && npx expo run:android` (iOS builds go through EAS: `eas build -p ios`) |
| Redeploy the API after backend changes | `cd backend && npm run deploy:api` |
| New database change | add a dated file to `Development/migrations/`, then `npx supabase migration new <name>` with the same SQL and `npx supabase db push` |
| Run the API locally (Node) | `cd backend && npm start` (uses `backend/.env`) |
| Publish the website | push to `main` |

## Licence
MIT.
