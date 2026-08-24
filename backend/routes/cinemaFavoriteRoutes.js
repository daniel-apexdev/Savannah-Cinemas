const express = require('express');

const router = express.Router();

const {
    addCinemaFavorite,
    removeCinemaFavorite,
    getMyCinemaFavorites,
    checkCinemaFavorite
} = require('../controllers/cinemaFavoriteController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');


// ============================================================
// GET MY FAVORITE CINEMAS
// ============================================================

router.get(
    '/',
    authenticateToken,
    getMyCinemaFavorites
);


// ============================================================
// CHECK IF CINEMA IS FAVORITE
// ============================================================

router.get(
    '/:cinemaId',
    authenticateToken,
    checkCinemaFavorite
);


// ============================================================
// ADD CINEMA TO FAVORITES
// ============================================================

router.post(
    '/',
    authenticateToken,
    addCinemaFavorite
);


// ============================================================
// REMOVE CINEMA FROM FAVORITES
// ============================================================

router.delete(
    '/:cinemaId',
    authenticateToken,
    removeCinemaFavorite
);


module.exports = router;