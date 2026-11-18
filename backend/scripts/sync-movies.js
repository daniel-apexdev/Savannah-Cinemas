// Sync the film catalogue from TMDB (now playing + upcoming).
//
//   npm run movies:sync                      # 2 pages of each
//   npm run movies:sync -- --pages 3         # 3 pages of each
//   npm run movies:sync -- --region GH       # TMDB's Ghana lists
//   npm run movies:preview                   # dry run, saves nothing
//
// Then: npm run showtimes:generate  (puts the new films on screens)

require('dotenv').config();

const { syncCatalog } = require('../services/catalogSync');
const pool = require('../config/database');

function arg(name) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
    const pages = Number(arg('--pages')) || 2;
    try {
        const r = await syncCatalog({
            nowPages: Number(arg('--now-pages')) || pages,
            upcomingPages: Number(arg('--upcoming-pages')) || pages,
            region: arg('--region'),
            dryRun: process.argv.includes('--dry-run')
        });

        for (const f of r.films) {
            const extra = f.reason ? ` (${f.reason})` : f.error ? ` (${f.error})` : f.runExtendedTo ? ` (showing until ${f.runExtendedTo})` : '';
            console.log(`${String(f.action).padEnd(13)} ${f.source === 'upcoming' ? 'COMING' : f.source ? 'NOW   ' : '      '} ${f.title}${extra}`);
        }
        console.log('');
        console.log(
            r.dryRun
                ? `Dry run: ${r.films.filter(f => f.action === 'would add').length} to add, ${r.films.filter(f => f.action === 'would update').length} to update, ${r.skipped} skipped.`
                : `Added ${r.inserted}, updated ${r.updated}, skipped ${r.skipped}, failed ${r.failed}. Runs extended: ${r.extended}.`
        );
        console.log('Shelves:', r.shelves);
    } catch (e) {
        console.error('Sync failed:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
})();
