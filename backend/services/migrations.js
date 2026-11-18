// ============================================================
// SAVANNAH CINEMAS - DATABASE MIGRATIONS
// services/migrations.js
//
// Applies the .sql files in Development/migrations in name order
// (they're dated, so that's the order they were written) and records
// each one in schema_migrations, so every file runs once per database.
//
// Every migration is written to be safe to run again, so a database
// where some were already run by hand is fine: they're re-applied
// harmlessly and then recorded.
//
//   npm run db:migrate            apply anything new
//   npm run db:migrate -- --status  list applied / pending
//
// The server checks at start-up and names anything pending. Set
// DB_AUTO_MIGRATE=true in .env to apply them automatically instead.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pool = require('../config/database');

function migrationsDir() {
    const candidates = [
        process.env.MIGRATIONS_DIR,
        path.resolve(__dirname, '..', '..', 'Development', 'migrations'),
        path.resolve(__dirname, '..', 'migrations')
    ].filter(Boolean);
    return candidates.find(d => fs.existsSync(d)) || candidates[candidates.length - 1];
}

function listFiles(dir = migrationsDir()) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter(f => f.toLowerCase().endsWith('.sql'))
        .sort()
        .map(f => {
            const sql = fs.readFileSync(path.join(dir, f), 'utf8');
            return {
                filename: f,
                sql,
                checksum: crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex').slice(0, 16)
            };
        });
}

async function ensureTable(db = pool) {
    await db.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename   VARCHAR(255) PRIMARY KEY,
            checksum   VARCHAR(64)  NOT NULL,
            applied_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    `);
}

async function status() {
    await ensureTable();
    const files = listFiles();
    const applied = await pool.query(`SELECT filename, checksum, applied_at FROM schema_migrations`);
    const byName = new Map(applied.rows.map(r => [r.filename, r]));
    return {
        dir: migrationsDir(),
        files: files.map(f => ({
            filename: f.filename,
            applied: byName.has(f.filename),
            appliedAt: byName.get(f.filename)?.applied_at || null,
            changedSinceApplied: byName.has(f.filename) && byName.get(f.filename).checksum !== f.checksum
        }))
    };
}

/** Apply pending migrations, each in its own transaction. Stops at the first failure. */
async function migrate({ logger = console } = {}) {

    await ensureTable();

    const files = listFiles();
    const applied = new Set((await pool.query(`SELECT filename FROM schema_migrations`)).rows.map(r => r.filename));
    const pending = files.filter(f => !applied.has(f.filename));
    const done = [];

    for (const f of pending) {

        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            await client.query(f.sql);
            await client.query(
                `INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)`,
                [f.filename, f.checksum]
            );
            await client.query('COMMIT');
            done.push(f.filename);
            logger.log(`✅ Migration applied: ${f.filename}`);
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            error.message = `${f.filename}: ${error.message}`;
            error.migration = f.filename;
            error.applied = done;
            throw error;
        } finally {
            client.release();
        }
    }

    return { dir: migrationsDir(), applied: done, alreadyApplied: files.length - pending.length };
}

/**
 * Start-up check. Returns the pending file names (and applies them
 * if DB_AUTO_MIGRATE=true). Never throws: the server still starts.
 */
async function checkOnStartup(logger = console) {

    try {

        const s = await status();
        const pending = s.files.filter(f => !f.applied).map(f => f.filename);

        if (pending.length === 0) return [];

        if (String(process.env.DB_AUTO_MIGRATE || '').toLowerCase() === 'true') {
            const r = await migrate({ logger });
            return pending.filter(p => !r.applied.includes(p));
        }

        logger.warn('');
        logger.warn('⚠️  DATABASE NEEDS UPDATING');
        logger.warn(`   ${pending.length} migration(s) haven't been applied to "${process.env.DB_NAME}":`);
        pending.forEach(p => logger.warn(`     - ${p}`));
        logger.warn('   Seats, booking, snacks or film statuses can fail until they are.');
        logger.warn('   Stop the server and run:  npm run db:migrate');
        logger.warn('   (or set DB_AUTO_MIGRATE=true in .env to apply them at start-up)');
        logger.warn('');
        return pending;

    } catch (error) {

        logger.error('Migration check failed:', error.message);
        return null;

    }
}

module.exports = {
    migrationsDir,
    status,
    migrate,
    checkOnStartup
};
