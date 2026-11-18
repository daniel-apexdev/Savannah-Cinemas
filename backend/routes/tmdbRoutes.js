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
    syncCatalog
} = require('../services/catalogSync');

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


// ============================================================
// SYNC THE CATALOGUE (admin/manager)
// POST /api/movies/tmdb/sync
//   { nowPages?: 2, upcomingPages?: 2, region?: 'GH', dryRun?: false }
// Adds/updates TMDB's now-playing and upcoming films.
// ============================================================

router.post(
    '/sync',
    authenticateToken,
    authorize('ADMIN', 'MANAGER'),
    async (req, res) => {
        try {
            const body = req.body || {};
            const result = await syncCatalog({
                nowPages: body.nowPages,
                upcomingPages: body.upcomingPages,
                region: body.region,
                dryRun: body.dryRun === true
            });
            return res.json({ success: true, ...result });
        } catch (error) {
            console.error('TMDB sync error:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Catalogue sync failed'
            });
        }
    }
);


module.exports = router;