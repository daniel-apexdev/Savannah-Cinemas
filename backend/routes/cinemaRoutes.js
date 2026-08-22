const express = require('express');

const {
    getCinemas,
    getCinemaById,
    getCinemaScreens,
    getScreenById,
    getScreenSeats
} = require('../controllers/cinemaController');

const router = express.Router();

// ============================================================
// CINEMA ROUTES
// ============================================================

router.get('/', getCinemas);

router.get('/:cinemaId/screens', getCinemaScreens);

// ============================================================
// SCREEN ROUTES
// ============================================================

router.get(
    '/:cinemaId/screens/:screenId',
    getScreenById
);

// ============================================================
// SEAT ROUTES
// ============================================================

router.get(
    '/:cinemaId/screens/:screenId/seats',
    getScreenSeats
);

// ============================================================
// SINGLE CINEMA
// ============================================================

router.get('/:cinemaId', getCinemaById);

module.exports = router;