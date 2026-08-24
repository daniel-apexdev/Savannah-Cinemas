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

const router = express.Router();

// ============================================================
// ALL SHOWTIMES
// ============================================================

router.get('/', getShowtimes);

router.post('/', createShowtime);

router.post(
    '/',
    authenticateToken,
    requireRole('ADMIN', 'MANAGER'),
    createShowtime
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