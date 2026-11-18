// ============================================================
// SAVANNAH CINEMAS - CATALOGUE SYNC
// services/catalogSync.js
//
// Brings the film catalogue up to date from TMDB:
//   - "now playing" films  -> on the Now Showing shelf
//   - "upcoming" films     -> on the Coming Soon shelf
//
// For each film: title, synopsis, release date, runtime, poster,
// backdrop, trailer, rating, age rating (GH/US/UK certificate),
// genres, then cast/crew/studio via the existing enrichment.
//
// Status still comes from the run-length rule
// (migrations/2026-11-17_movie_run_status.sql): UPCOMING before
// release, NOW_SHOWING for the run, ENDED after. A film TMDB lists
// as now playing whose standard run would already be over (common
// when a film reaches Ghana after its US release) gets its run
// extended to MIN_RUN_DAYS from today, so it shows up. Runs are
// only ever extended, never cut short. ARCHIVED films are left
// alone, so archiving a film keeps it out of future syncs.
//
//   npm run movies:sync              # 2 pages of each (≈40 + 40)
//   npm run movies:sync -- --dry-run # list what would change
//   POST /api/movies/tmdb/sync       # admin/manager
//   TMDB_AUTOSYNC=true in .env       # daily, on the server
// ============================================================

const pool = require('../config/database');

const {
    getNowPlayingMovies,
    getUpcomingMovies,
    getMovieForSync,
    getAgeRating,
    getImageUrl,
    getTrailerUrl
} = require('./tmdbService');

const {
    importGenres,
    linkMovieGenres
} = require('../controllers/tmdbController');

const { refreshMovieStatuses } = require('./movieStatus');

const MIN_RUN_DAYS = 28;
const MAX_PAGES = 5;

let running = null;

const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const clampPages = (n, fallback) =>
    Math.min(Math.max(Number.isInteger(Number(n)) && Number(n) > 0 ? Number(n) : fallback, 1), MAX_PAGES);


// TMDB list -> [{ id, source }], now playing winning over upcoming
async function collect(nowPages, upcomingPages, region) {

    const seen = new Map();

    for (let page = 1; page <= nowPages; page++) {
        const r = await getNowPlayingMovies(page, region);
        for (const m of r.results || []) {
            if (!seen.has(m.id)) seen.set(m.id, { id: m.id, source: 'now_playing', title: m.title });
        }
        if (page >= (r.total_pages || 1)) break;
    }

    for (let page = 1; page <= upcomingPages; page++) {
        const r = await getUpcomingMovies(page, region);
        for (const m of r.results || []) {
            if (!seen.has(m.id)) seen.set(m.id, { id: m.id, source: 'upcoming', title: m.title });
        }
        if (page >= (r.total_pages || 1)) break;
    }

    return [...seen.values()];
}


// The film's theatrical date in the chosen region, if TMDB has one
// (e.g. a later Ghana opening), else its main release date.
function releaseDateFor(d, region) {
    if (region && d.release_dates && Array.isArray(d.release_dates.results)) {
        const entry = d.release_dates.results.find(r => r.iso_3166_1 === region);
        const dates = (entry && entry.release_dates) || [];
        const pick = dates.find(x => x.type === 3) || dates.find(x => x.type === 2);
        if (pick && pick.release_date) return pick.release_date.slice(0, 10);
    }
    return d.release_date || null;
}


// Reasons to leave a film out of the catalogue
function skipReason(d, source, today) {
    if (d.adult) return 'adult content';
    if (!d.poster_path) return 'no poster';
    if (!d.release_date) return 'no release date';
    return null;
}


async function upsertFilm(client, d, source, today, runColumns, region) {

    const releaseDate = releaseDateFor(d, region);

    const existing = await client.query(
        `SELECT movie_id, status, age_rating FROM movies WHERE tmdb_id = $1`,
        [d.id]
    );

    if (existing.rows[0] && existing.rows[0].status === 'ARCHIVED') {
        return { action: 'skipped', reason: 'archived', movieId: existing.rows[0].movie_id };
    }

    const values = [
        d.title || d.original_title || 'Untitled',
        d.original_title || null,
        d.overview || null,
        releaseDate,
        d.runtime || null,
        getImageUrl(d.poster_path, 'w500'),
        getImageUrl(d.backdrop_path, 'w1280'),
        getTrailerUrl(d.videos),
        d.vote_average !== undefined && d.vote_count > 0 ? Math.round(d.vote_average * 10) / 10 : null,
        getAgeRating(d.release_dates)
    ];

    let movieId;
    let action;

    if (existing.rows[0]) {

        movieId = existing.rows[0].movie_id;
        action = 'updated';

        // Keep what we have when TMDB has nothing (trailer, runtime,
        // age rating may arrive late for upcoming films)
        await client.query(
            `
            UPDATE movies SET
                title = $1,
                original_title = $2,
                description = COALESCE($3, description),
                release_date = $4::date,
                runtime_minutes = COALESCE($5, runtime_minutes),
                poster_url = COALESCE($6, poster_url),
                backdrop_url = COALESCE($7, backdrop_url),
                trailer_url = COALESCE($8, trailer_url),
                rating = COALESCE($9, rating),
                age_rating = COALESCE($10, age_rating),
                updated_at = CURRENT_TIMESTAMP
            WHERE movie_id = $11
            `,
            [...values, movieId]
        );

    } else {

        action = 'inserted';

        const inserted = await client.query(
            `
            INSERT INTO movies (
                title, original_title, description, release_date, runtime_minutes,
                poster_url, backdrop_url, trailer_url, rating, age_rating, tmdb_id
            )
            VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11)
            RETURNING movie_id
            `,
            [...values, d.id]
        );

        movieId = inserted.rows[0].movie_id;
    }

    // Franchise, countries and language (for Savannah Trophies:
    // Franchise Fan, Made in Ghana). Columns from the rewards migration.
    await client.query('SAVEPOINT extra');
    try {
        await client.query(
            `
            UPDATE movies
            SET collection_id = $2,
                collection_name = $3,
                production_countries = $4,
                original_language = $5
            WHERE movie_id = $1
            `,
            [
                movieId,
                d.belongs_to_collection ? d.belongs_to_collection.id : null,
                d.belongs_to_collection ? d.belongs_to_collection.name : null,
                (d.production_countries || []).map(c => c.iso_3166_1).join(',') || null,
                d.original_language || null
            ]
        );
        await client.query('RELEASE SAVEPOINT extra');
    } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT extra');
        if (e.code !== '42703') throw e;
    }

    // Genres (same tables and logic as the existing importer)
    const genreIds = await importGenres(client, d.genres || []);
    await client.query(`DELETE FROM movie_genres WHERE movie_id = $1`, [movieId]);
    await linkMovieGenres(client, movieId, genreIds);

    // A film that's playing now should be on the shelf for a while
    let extendedTo = null;
    if (source === 'now_playing' && runColumns && releaseDate <= today) {
        const r = await client.query(
            `
            UPDATE movies
            SET run_ends_on = (CURRENT_DATE + $2::int)
            WHERE movie_id = $1
              AND movie_run_end(release_date, run_ends_on) < CURRENT_DATE + $2::int
            RETURNING run_ends_on::text
            `,
            [movieId, MIN_RUN_DAYS - 1]
        );
        if (r.rowCount) extendedTo = r.rows[0].run_ends_on;
    }

    return { action, movieId, extendedTo };
}


/**
 * Sync now-playing and upcoming films from TMDB.
 * Each film is its own transaction, so one bad film doesn't stop the rest.
 */
async function syncCatalog(opts = {}) {

    if (running) {
        throw new Error('A catalogue sync is already running');
    }

    const nowPages = clampPages(opts.nowPages, 2);
    const upcomingPages = clampPages(opts.upcomingPages, 2);
    const region = opts.region || process.env.TMDB_REGION || undefined;
    const dryRun = !!opts.dryRun;
    const log = opts.logger || console;

    running = (async () => {

        const today = todayIso();
        const list = await collect(nowPages, upcomingPages, region);

        // Is the run-length migration installed?
        let runColumns = true;
        try {
            await pool.query(`SELECT movie_run_end(CURRENT_DATE, NULL)`);
        } catch (e) {
            runColumns = false;
        }

        // Enrichment (cast, crew, studio) is optional: skip if missing
        let enrichMovie = null;
        try {
            ({ enrichMovie } = require('../controllers/movieEnrichmentController'));
        } catch (e) {
            enrichMovie = null;
        }

        const results = [];
        const counts = { inserted: 0, updated: 0, skipped: 0, failed: 0, extended: 0 };

        for (const item of list) {

            let details;
            try {
                details = await getMovieForSync(item.id);
            } catch (e) {
                counts.failed++;
                results.push({ tmdbId: item.id, title: item.title, action: 'failed', error: e.message });
                continue;
            }

            const reason = skipReason(details, item.source, today);
            if (reason) {
                counts.skipped++;
                results.push({ tmdbId: item.id, title: details.title, action: 'skipped', reason });
                continue;
            }

            if (dryRun) {
                const exists = await pool.query(`SELECT 1 FROM movies WHERE tmdb_id = $1`, [item.id]);
                const action = exists.rowCount ? 'would update' : 'would add';
                results.push({
                    tmdbId: item.id,
                    title: details.title,
                    source: item.source,
                    releaseDate: releaseDateFor(details, region),
                    ageRating: getAgeRating(details.release_dates),
                    action
                });
                continue;
            }

            const client = await pool.connect();

            try {

                await client.query('BEGIN');
                const r = await upsertFilm(client, details, item.source, today, runColumns, region);

                if (r.action !== 'skipped' && enrichMovie) {
                    // Cast/crew/studio. Failure here shouldn't lose the film.
                    await client.query('SAVEPOINT enrich');
                    try {
                        await enrichMovie(client, r.movieId);
                        await client.query('RELEASE SAVEPOINT enrich');
                    } catch (e) {
                        await client.query('ROLLBACK TO SAVEPOINT enrich');
                        log.warn(`Enrichment skipped for "${details.title}": ${e.message}`);
                    }
                }

                await client.query('COMMIT');

                counts[r.action]++;
                if (r.extendedTo) counts.extended++;
                results.push({
                    tmdbId: item.id,
                    movieId: r.movieId,
                    title: details.title,
                    source: item.source,
                    action: r.action,
                    ...(r.reason ? { reason: r.reason } : {}),
                    ...(r.extendedTo ? { runExtendedTo: r.extendedTo } : {})
                });

            } catch (e) {

                await client.query('ROLLBACK').catch(() => {});
                counts.failed++;
                results.push({ tmdbId: item.id, title: details.title, action: 'failed', error: e.message });

            } finally {
                client.release();
            }
        }

        const statusChanges = dryRun ? 0 : await refreshMovieStatuses();

        const shelves = await pool.query(
            `SELECT status, COUNT(*)::int AS n FROM movies GROUP BY status`
        );

        return {
            dryRun,
            region: region || null,
            fetched: list.length,
            ...counts,
            statusChanges,
            shelves: Object.fromEntries(shelves.rows.map(r => [r.status, r.n])),
            films: results
        };

    })();

    try {
        return await running;
    } finally {
        running = null;
    }
}


/** Daily sync on the server when TMDB_AUTOSYNC=true. */
function startCatalogAutoSync(logger = console) {

    if (String(process.env.TMDB_AUTOSYNC || '').toLowerCase() !== 'true') return false;
    if (!process.env.TMDB_API_KEY) {
        logger.warn('TMDB_AUTOSYNC is on but TMDB_API_KEY is missing; catalogue sync skipped.');
        return false;
    }

    const run = async () => {
        try {
            const r = await syncCatalog({ logger });
            logger.log(`🎞️ Catalogue sync: ${r.inserted} added, ${r.updated} updated, ${r.skipped} skipped, ${r.failed} failed`);
        } catch (e) {
            logger.error('Catalogue sync failed:', e.message);
        }
    };

    setTimeout(run, 15 * 1000);
    const timer = setInterval(run, 24 * 60 * 60 * 1000);
    if (timer.unref) timer.unref();
    return true;
}


module.exports = {
    syncCatalog,
    startCatalogAutoSync
};
