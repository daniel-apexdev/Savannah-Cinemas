const express = require('express');

const {
    createBooking,
    getMyBookings,
    getBookingById,
    cancelBooking,
    emailBookingConfirmation
} = require('../controllers/bookingController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');

const router = express.Router();


// GET MY BOOKINGS
router.get(
    '/',
    authenticateToken,
    getMyBookings
);

// GET SINGLE BOOKING
router.get(
    '/:bookingId',
    authenticateToken,
    getBookingById
);

// ============================================================
// CANCEL BOOKING
// ============================================================

router.patch(
    '/:bookingId/cancel',
    authenticateToken,
    cancelBooking
);

// ============================================================
// EMAIL CONFIRMATION (AGAIN)   { to? }
// ============================================================

router.post(
    '/:bookingId/email',
    authenticateToken,
    emailBookingConfirmation
);

// CREATE BOOKING
router.post(
    '/',
    authenticateToken,
    createBooking
);

module.exports = router;