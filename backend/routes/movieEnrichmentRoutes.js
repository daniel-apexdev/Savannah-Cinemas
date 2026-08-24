const express = require('express');

const router = express.Router();

const {
    enrichMovieController,
    enrichAllMovies
} = require('../controllers/movieEnrichmentController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');


// ============================================================
// ENRICH ALL MOVIES
// ============================================================

router.post(
    '/all',
    authenticateToken,
    enrichAllMovies
);


// ============================================================
// ENRICH SINGLE MOVIE
// ============================================================

router.post(
    '/:movieId',
    authenticateToken,
    enrichMovieController
);


module.exports = router;