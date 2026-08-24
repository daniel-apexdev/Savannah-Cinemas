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
    getPopularMovies,
    getRecommendedMovies
} = require('../controllers/movieController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');

const router = express.Router();


// ============================================================
// MOVIE ROUTES
// ============================================================

// Specific routes FIRST
router.get('/now-showing', getNowShowing);
router.get('/upcoming', getUpcomingMovies);
router.get('/popular', getPopularMovies);
router.get('/top-rated', getTopRatedMovies);
router.get('/search',searchMovies);
router.get('/coming-soon', getComingSoonMovies);
router.get('/recommended', authenticateToken, getRecommendedMovies);
router.get('/:movieId', getMovieDetails);
router.get('/:movieId/showtimes', getMovieShowtimes);


// General routes
router.get('/', getMovies);
router.get('/:id', getMovieById);

module.exports = router;