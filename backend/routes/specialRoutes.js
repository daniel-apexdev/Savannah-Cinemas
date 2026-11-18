// ============================================================
// SAVANNAH CINEMAS - SPECIAL NIGHTS
// routes/specialRoutes.js
//
// GET /api/specials   programmes (Throwback Thursday, Bargain Tuesday...)
//                     and their upcoming screenings for the next 3 weeks
// ============================================================

const express = require('express');
const specialScreenings = require('../services/specialScreenings');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const data = await specialScreenings.upcoming({ days: 21 });
        return res.json({ success: true, ...data });
    } catch (error) {
        console.error('❌ Specials error:', error);
        return res.status(500).json({ success: false, message: 'Server error loading special screenings' });
    }
});

module.exports = router;
