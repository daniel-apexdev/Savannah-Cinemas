const express = require('express');

const router = express.Router();

const {
    createPayment
} = require('../controllers/paymentController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');


// ============================================================
// CREATE PAYMENT
// ============================================================

router.post(
    '/',
    authenticateToken,
    createPayment
);


module.exports = router;