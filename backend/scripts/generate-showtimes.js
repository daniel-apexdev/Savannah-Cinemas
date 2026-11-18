#!/usr/bin/env node
// ============================================================
// Generate showtimes from today for the next N days.
//
//   npm run showtimes:generate                 # 14 days, all cinemas
//   npm run showtimes:generate -- --days 7
//   npm run showtimes:generate -- --dry-run    # print the plan, write nothing
//   npm run showtimes:generate -- --cinema 1
//   npm run showtimes:generate -- --no-upcoming
//   npm run showtimes:rebuild                  # clear unbooked future shows, programme again
//
// Existing showtimes are never changed; new ones fit around them, so it's
// safe to run every day (or let the server do it: SHOWTIME_AUTOGEN=true).
// --rebuild deletes future showtimes with no bookings first (use it after
// adding screens or films). Shows with any booking are always kept.
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const pool = require('../config/database');
const { generateShowtimes } = require('../services/showtimeScheduler');

function arg(name) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {

    const options = {
        days: Number(arg('--days')) || 14,
        cinemaId: arg('--cinema') ? Number(arg('--cinema')) : undefined,
        dryRun: process.argv.includes('--dry-run'),
        includeUpcoming: !process.argv.includes('--no-upcoming'),
        rebuild: process.argv.includes('--rebuild')
    };

    try {

        const r = await generateShowtimes(options);

        console.log('');
        console.log(`Savannah Cinemas showtimes ${r.dryRun ? '(DRY RUN, nothing saved)' : ''}`);
        console.log(`${r.from} → ${r.to} · ${r.screens} screen(s) · ${r.films} film(s) available`);
        console.log('');

        for (const day of r.days) {
            console.log(day.date);
            for (const s of day.screens) {
                if (s.skipped) {
                    console.log(`  ${s.screen}: skipped (${s.skipped})`);
                    continue;
                }
                const line = s.shows.map(x => `${x.time} ${x.title}`).join('  |  ');
                const kept = s.kept ? ` (+${s.kept} existing)` : '';
                console.log(`  ${s.screen}: ${line || (s.kept ? 'already full' : 'nothing scheduled')}${kept}`);
            }
        }

        if (r.specials && r.specials.length) {
            console.log('');
            console.log('Special nights (older films from the catalogue):');
            for (const sp of r.specials) {
                console.log(`  ${sp.date} ${sp.programme} · cinema ${sp.cinemaId} ${sp.screen}: ${sp.times.join(', ')} ${sp.title}`);
            }
        }

        console.log('');
        if (r.removed) console.log(`${r.dryRun ? 'Would remove' : 'Removed'} ${r.removed} unbooked future showtime(s) first.`);
        console.log(`${r.dryRun ? 'Would create' : 'Created'} ${r.created} showtime(s). ${r.skipped} screen-day(s) already had shows; new ones were fitted around them.`);

        if (r.films === 0) {
            console.log('');
            console.log('No films qualified. Films need status NOW_SHOWING (or UPCOMING with a release date in range) and a runtime.');
        }

    } catch (error) {

        console.error('Showtime generation failed:', error.message);
        process.exitCode = 1;

    } finally {

        await pool.end();

    }

})();
