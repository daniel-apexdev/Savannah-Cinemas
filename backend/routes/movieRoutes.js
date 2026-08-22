// backend/routes/movieRoutes.js

const express = require('express');

const {
    getMovies,
    getMovieById,
    getNowShowing,
    getUpcomingMovies,
    getMovieShowtimes
} = require('../controllers/movieController');

const router = express.Router();


// ============================================================
// MOVIE ROUTES
// ============================================================

// IMPORTANT:
// Specific routes must come before /:id

router.get('/now-showing', getNowShowing);

router.get('/upcoming', getUpcomingMovies);

router.get('/', getMovies);

router.get('/:id', getMovieById);

router.get(
    '/:movieId/showtimes',
    getMovieShowtimes
);

module.exports = router;