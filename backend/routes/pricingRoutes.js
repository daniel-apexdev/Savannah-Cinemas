const express = require('express');

const router = express.Router();

const {
    getPrices,
    getPriceById,
    getShowtimePricing
} = require('../controllers/pricingController');


// ============================================================
// PRICING
// ============================================================

router.get(
    '/',
    getPrices
);

router.get(
    '/showtime/:showtimeId',
    getShowtimePricing
);

router.get(
    '/:priceId',
    getPriceById
);


module.exports = router;