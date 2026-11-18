const express = require('express');

const router = express.Router();

const { authenticateToken } = require('../middleware/authMiddleware');

const {
    getItems,
    getBookingConcessions,
    setBookingConcessions,
    createPreorder,
    getMyOrders
} = require('../controllers/concessionController');


// ============================================================
// CONCESSIONS (snacks & drinks)
// ============================================================

// Menu (public)
router.get('/', getItems);

// The signed-in user's snack orders
router.get('/orders', authenticateToken, getMyOrders);

// Pre-order snacks for a paid, upcoming booking
router.post('/orders', authenticateToken, createPreorder);

// Snacks attached to a booking (view / replace while unpaid)
router.get('/bookings/:bookingId', authenticateToken, getBookingConcessions);
router.put('/bookings/:bookingId', authenticateToken, setBookingConcessions);


module.exports = router;
