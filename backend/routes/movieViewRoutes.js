const express = require('express');

const router = express.Router();

const {
    recordMovieView,
    getRecentlyViewedMovies,
    getMovieViewStatus
} = require('../controllers/movieViewController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');


// ============================================================
// GET RECENTLY VIEWED MOVIES
// ============================================================

router.get(
    '/',
    authenticateToken,
    getRecentlyViewedMovies
);


// ============================================================
// GET MOVIE VIEW STATUS
// ============================================================

router.get(
    '/:movieId',
    authenticateToken,
    getMovieViewStatus
);


// ============================================================
// RECORD MOVIE VIEW
// ============================================================

router.post(
    '/',
    authenticateToken,
    recordMovieView
);


module.exports = router;