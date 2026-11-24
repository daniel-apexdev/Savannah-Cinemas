// ============================================================
// SAVANNAH CINEMAS - DATABASE CONNECTION
//
// Supabase: set DATABASE_URL to the project's connection string
// (Supabase Edge Functions provide SUPABASE_DB_URL automatically).
// Local Postgres: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
// ============================================================

const { Pool } = require('pg');

const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

function sslFor(connectionString) {
    if (String(process.env.DB_SSL || '').toLowerCase() === 'false') return undefined;
    if (!connectionString) return String(process.env.DB_SSL || '').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined;
    return /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(connectionString) || /sslmode=disable/.test(connectionString)
        ? undefined
        : { rejectUnauthorized: false };
}

const pool = url
    ? new Pool({
        connectionString: url,
        ssl: sslFor(url),
        // An Edge Function instance only needs a few connections
        max: Number(process.env.DB_POOL_MAX) || ((globalThis.SAVANNAH_RUNTIME || process.env.RUNTIME) === 'edge' ? 3 : 10),
        idleTimeoutMillis: 20000
    })
    : new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: sslFor('')
    });

pool.on('connect', () => {
    if ((globalThis.SAVANNAH_RUNTIME || process.env.RUNTIME) !== 'edge') console.log('PostgreSQL client connected');
});

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;
