// ============================================================
// SAVANNAH CINEMAS - TMDB ROUTES
// routes/tmdbRoutes.js
// ============================================================

const express = require('express');

const router = express.Router();

const {
    importMovies
} = require('../controllers/tmdbController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');

const authorize =
    require('../middleware/roleMiddleware');


// ============================================================
// IMPORT MOVIES FROM TMDB
// ============================================================

router.post(
    '/import',
    authenticateToken,
    authorize('ADMIN'),
    importMovies
);


module.exports = router;