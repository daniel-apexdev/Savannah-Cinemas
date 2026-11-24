# Archive

`oracle_original_schema.sql` is the original **Oracle** version of the
Savannah Cinemas schema (formerly `Development/savannah_cinemas_script.sql`).
It is kept for reference only. It does not run on PostgreSQL and the app
does not use it.

The real setup is:

1. `Development/savannah_cinemas_update_script.sql` (PostgreSQL schema and
   sample data; wipes the database first)
2. `cd backend` then `npm run db:migrate` (applies `Development/migrations`)
