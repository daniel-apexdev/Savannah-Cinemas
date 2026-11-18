const express = require('express');

const {
    getShowtimes,
    getShowtimeById,
    getMovieShowtimes,
    getCinemaShowtimes,
    getScreenShowtimes,
    getShowtimeSeats,
    createShowtime
} = require('../controllers/showtimeController');

const {
    authenticateToken,
    requireRole
} = require('../middleware/authMiddleware');

const { generateShowtimes } = require('../services/showtimeScheduler');

const router = express.Router();

// ============================================================
// ALL SHOWTIMES
// ============================================================

router.get('/', getShowtimes);

// (An unprotected `router.post('/', createShowtime)` used to sit here,
// letting anyone create showtimes. Creation is admin/manager only.)

router.post(
    '/',
    authenticateToken,
    requireRole('ADMIN', 'MANAGER'),
    createShowtime
);

// ============================================================
// GENERATE SHOWTIMES (admin/manager)
// POST /api/showtimes/generate   { days?: 14, cinemaId?, dryRun?: false, rebuild?: false }
// Fits new shows around existing ones; never changes existing ones.
// rebuild: true first deletes future showtimes that have no bookings.
// ============================================================

router.post(
    '/generate',
    authenticateToken,
    requireRole('ADMIN', 'MANAGER'),
    async (req, res) => {
        try {
            const body = req.body || {};
            const result = await generateShowtimes({
                days: body.days,
                cinemaId: body.cinemaId,
                dryRun: body.dryRun === true,
                includeUpcoming: body.includeUpcoming !== false,
                rebuild: body.rebuild === true
            });
            return res.status(result.dryRun ? 200 : 201).json({ success: true, ...result });
        } catch (error) {
            console.error('Generate showtimes error:', error);
            return res.status(500).json({ success: false, message: 'Server error generating showtimes' });
        }
    }
);


// ============================================================
// SHOWTIMES FOR MOVIE
// ============================================================

router.get('/movie/:movieId', getMovieShowtimes);

// ============================================================
// SHOWTIMES FOR CINEMA
// ============================================================

router.get('/cinema/:cinemaId', getCinemaShowtimes);

// ============================================================
// SHOWTIMES FOR SCREEN
// ============================================================

router.get(
    '/cinema/:cinemaId/screen/:screenId',
    getScreenShowtimes
);


router.get(
    '/:showtimeId/seats',
    getShowtimeSeats
);

// ============================================================
// SINGLE SHOWTIME
// ============================================================
router.get('/:showtimeId', getShowtimeById);

module.exports = router;