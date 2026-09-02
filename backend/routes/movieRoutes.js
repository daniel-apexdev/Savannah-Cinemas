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