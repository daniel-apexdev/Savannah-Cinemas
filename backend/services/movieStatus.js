const pool = require('../config/database');


// ============================================================
// FILM STATUS (UPCOMING / NOW_SHOWING / ENDED)
//
// The rule lives in the database (migrations/2026-11-17_movie_run_status.sql):
//   UPCOMING until release_date, NOW_SHOWING for movie_run_weeks
//   (app_settings, default 12) or until movies.run_ends_on, then ENDED.
//   ARCHIVED is manual and never changed.
//
// The trigger only runs when a film row is written, so time passing
// doesn't change anything by itself. refreshMovieStatuses() moves films
// along as their dates arrive. The server runs it at start-up and every
// hour; the showtime generator runs it before planning.
// ============================================================

let warnedMissing = false;


/** Returns how many films changed status (0 if the migration isn't installed). */
async function refreshMovieStatuses(client = pool) {

    try {

        const result = await client.query('SELECT refresh_movie_statuses() AS changed');
        return Number(result.rows[0].changed) || 0;

    } catch (error) {

        // 42883 = undefined_function: migration not run yet
        if (error && error.code === '42883') {
            if (!warnedMissing) {
                warnedMissing = true;
                console.warn('Film statuses: run Development/migrations/2026-11-17_movie_run_status.sql to enable run-length statuses.');
            }
            return 0;
        }

        throw error;

    }

}


async function getRunWeeks() {

    const result = await pool.query(`SELECT movie_run_weeks() AS weeks`);
    return Number(result.rows[0].weeks);

}


async function setRunWeeks(weeks) {

    await pool.query(
        `
        INSERT INTO app_settings (setting_key, setting_value, description, updated_at)
        VALUES ('movie_run_weeks', $1, 'Weeks a film stays NOW_SHOWING after its release date, unless movies.run_ends_on is set', CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
        `,
        [String(weeks)]
    );

    return refreshMovieStatuses();

}


function startMovieStatusRefresh(logger = console) {

    const run = async () => {
        try {
            const changed = await refreshMovieStatuses();
            if (changed > 0) logger.log(`Film statuses: ${changed} film(s) moved on (upcoming → now showing → ended)`);
        } catch (error) {
            logger.error('Film status refresh failed:', error.message);
        }
    };

    setTimeout(run, 2000);
    const timer = setInterval(run, 60 * 60 * 1000);
    if (timer.unref) timer.unref();
    return timer;

}


module.exports = {
    refreshMovieStatuses,
    getRunWeeks,
    setRunWeeks,
    startMovieStatusRefresh
};
