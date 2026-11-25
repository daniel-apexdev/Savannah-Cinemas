// ============================================================
// SAVANNAH CINEMAS - GUEST CHECKOUT ROUTES (WEBSITE)
// routes/guestRoutes.js
// ============================================================

const express = require('express');
const guests = require('../services/guestSessions');

const router = express.Router();

// POST /api/guest/session -> { token }
// Called by the website when someone who isn't signed in picks seats.
router.post('/session', async (req, res) => {
    try {
        const { token } = await guests.createSession();
        return res.status(201).json({ success: true, token });
    } catch (error) {
        console.error('Guest session failed:', error.message);
        return res.status(500).json({ success: false, message: 'Could not start your booking. Please try again' });
    }
});

module.exports = router;
