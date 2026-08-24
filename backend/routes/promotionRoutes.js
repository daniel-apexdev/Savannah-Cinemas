const express = require('express');

const router = express.Router();

const {
    getPromotions,
    getPromotionById,
    validatePromotion
} = require('../controllers/promotionController');


// ============================================================
// PROMOTIONS
// ============================================================

router.get(
    '/',
    getPromotions
);

router.post(
    '/validate',
    validatePromotion
);

router.get(
    '/:promotionId',
    getPromotionById
);


module.exports = router;