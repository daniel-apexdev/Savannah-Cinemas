const express = require('express');

const {
    getMovies,
    getMovieById,
    getNowShowing,
    getUpcomingMovies,
    getMovieShowtimes,
    searchMovies,
    getComingSoonMovies,
    getMovieDetails,
    getTopRatedMovies,
    getPopularMovies
} = require('../controllers/movieController');

const {
    authenticateToken,
    requireRole
} = require('../middleware/authMiddleware');

const pool = require('../config/database');

const {
    getRunWeeks,
    setRunWeeks,
    refreshMovieStatuses
} = require('../services/movieStatus');

const router = express.Router();

// ============================================================
// SPECIFIC ROUTES FIRST
// ============================================================

router.get('/now-showing', getNowShowing);

router.get('/upcoming', getUpcomingMovies);

router.get('/popular', getPopularMovies);

router.get('/top-rated', getTopRatedMovies);

router.get('/search', searchMovies);

router.get('/coming-soon', getComingSoonMovies);

// ============================================================
// RUN LENGTH (admin/manager)
// A film is UPCOMING before release_date, NOW_SHOWING for the run
// length (weeks) or until its own run_ends_on, then ENDED.
//   GET  /api/movies/run-length            -> { weeks }
//   PUT  /api/movies/run-length { weeks }  -> re-sorts every film
//   PATCH /api/movies/:movieId/run { runEndsOn: 'YYYY-MM-DD' | null }
// ============================================================

const adminOnly = [authenticateToken, requireRole('ADMIN', 'MANAGER')];

function runMigrationMissing(res, error) {
    if (error && (error.code === '42883' || error.code === '42P01' || error.code === '42703')) {
        res.status(501).json({
            success: false,
            message: 'Run the 2026-11-17_movie_run_status.sql migration first'
        });
        return true;
    }
    return false;
}

router.get('/run-length', ...adminOnly, async (req, res) => {
    try {
        return res.json({ success: true, weeks: await getRunWeeks() });
    } catch (error) {
        if (runMigrationMissing(res, error)) return;
        console.error('Get run length error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/run-length', ...adminOnly, async (req, res) => {
    const weeks = Number((req.body || {}).weeks);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
        return res.status(400).json({ success: false, message: 'weeks must be a whole number from 1 to 52' });
    }
    try {
        const changed = await setRunWeeks(weeks);
        return res.json({ success: true, weeks, changed });
    } catch (error) {
        if (runMigrationMissing(res, error)) return;
        console.error('Set run length error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.patch('/:movieId/run', ...adminOnly, async (req, res) => {
    const movieId = Number(req.params.movieId);
    const raw = (req.body || {}).runEndsOn;
    if (!Number.isInteger(movieId) || movieId < 1) {
        return res.status(400).json({ success: false, message: 'Invalid movie id' });
    }
    if (raw !== null && !(typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw))) {
        return res.status(400).json({ success: false, message: 'runEndsOn must be YYYY-MM-DD or null' });
    }
    try {
        const result = await pool.query(
            `
            UPDATE movies
            SET run_ends_on = $2::date
            WHERE movie_id = $1
            RETURNING movie_id, title, release_date::text, run_ends_on::text,
                      movie_run_end(release_date, run_ends_on)::text AS run_end, status
            `,
            [movieId, raw]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Movie not found' });
        }
        await refreshMovieStatuses();
        return res.json({ success: true, movie: result.rows[0] });
    } catch (error) {
        if (runMigrationMissing(res, error)) return;
        if (error.code === '23514') {
            return res.status(400).json({ success: false, message: 'runEndsOn cannot be before the release date' });
        }
        console.error('Set movie run error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================================
// MOVIE DETAILS / SHOWTIMES
// ============================================================

router.get('/:movieId/showtimes', getMovieShowtimes);

router.get('/:movieId/details', getMovieDetails);

router.get('/:movieId', getMovieById);

// ============================================================
// ALL MOVIES
// ============================================================

router.get('/', getMovies);

module.exports = router;