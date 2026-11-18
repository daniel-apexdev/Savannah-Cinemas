// Apply database migrations from Development/migrations.
//
//   npm run db:migrate               apply anything not yet applied
//   npm run db:migrate -- --status   show what's applied / pending

require('dotenv').config();

const pool = require('../config/database');
const { migrate, status } = require('../services/migrations');

(async () => {
    try {
        if (process.argv.includes('--status')) {
            const s = await status();
            console.log(`Migrations in ${s.dir}`);
            for (const f of s.files) {
                const when = f.appliedAt ? new Date(f.appliedAt).toLocaleString('en-GB') : '';
                console.log(`  ${f.applied ? 'applied ' : 'PENDING '} ${f.filename}  ${when}${f.changedSinceApplied ? '  (file changed since)' : ''}`);
            }
            if (s.files.length === 0) console.log('  (no .sql files found)');
        } else {
            const r = await migrate();
            console.log('');
            console.log(
                r.applied.length
                    ? `Applied ${r.applied.length} migration(s). Database "${process.env.DB_NAME}" is up to date.`
                    : `Nothing to do: all ${r.alreadyApplied} migration(s) already applied.`
            );
        }
    } catch (e) {
        console.error('');
        console.error(`❌ Migration failed: ${e.message}`);
        if (e.applied && e.applied.length) console.error(`   (applied before the failure: ${e.applied.join(', ')})`);
        console.error('   Nothing from the failed file was saved. Fix the problem and run again.');
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
