// ============================================================
// SAVANNAH CINEMAS - REWARDS & TROPHIES
// routes/rewardRoutes.js
//
// GET  /api/rewards/me                  points, trophies, stats, referral code
// GET  /api/rewards/quote?bookingId=    points you can use on a booking
// POST /api/rewards/referral  { code }  link a new member to a friend
// POST /api/rewards/seen                mark new trophies as seen
// ============================================================

const express = require('express');
const pool = require('../config/database');
const rewards = require('../services/rewards');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const s = await rewards.summary(req.user.userId);
        if (!s) return res.status(404).json({ success: false, message: 'User not found' });
        return res.json({ success: true, ...s });
    } catch (error) {
        console.error('Rewards summary error:', error);
        return res.status(500).json({ success: false, message: 'Server error loading rewards' });
    }
});

router.get('/quote', authenticateToken, async (req, res) => {
    try {
        const bookingId = Number(req.query.bookingId);
        if (!Number.isInteger(bookingId)) {
            return res.status(400).json({ success: false, message: 'Invalid booking ID' });
        }
        const b = await pool.query(
            `SELECT total_amount, status FROM bookings WHERE booking_id = $1 AND user_id = $2`,
            [bookingId, req.user.userId]
        );
        if (b.rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
        const balance = await rewards.balanceOf(pool, req.user.userId);
        const q = rewards.quote(balance, b.rows[0].total_amount);
        return res.json({ success: true, balance, ...q, value: rewards.VALUE });
    } catch (error) {
        console.error('Rewards quote error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/referral', authenticateToken, async (req, res) => {
    try {
        const r = await rewards.claimReferral(req.user.userId, (req.body || {}).code);
        if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
        return res.json({ success: true, referrer: r.referrer, bonus: r.bonus });
    } catch (error) {
        if (error.code === '42P01' || error.code === '42703') {
            return res.status(501).json({ success: false, message: 'Rewards aren’t set up on the server yet' });
        }
        console.error('Referral error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/seen', authenticateToken, async (req, res) => {
    try {
        await rewards.markTrophiesSeen(req.user.userId);
        return res.json({ success: true });
    } catch (error) {
        console.error('Rewards seen error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
