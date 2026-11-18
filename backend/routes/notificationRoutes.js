// ============================================================
// SAVANNAH CINEMAS - NOTIFICATIONS
// routes/notificationRoutes.js
//
// GET    /api/notifications                  inbox + unread count
// POST   /api/notifications/read   { ids? }  mark read (all if no ids)
// GET    /api/notifications/reminders        films I asked to be reminded about
// PUT    /api/notifications/reminders/:movieId
// DELETE /api/notifications/reminders/:movieId
// ============================================================

const express = require('express');
const pool = require('../config/database');
const notifications = require('../services/notifications');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
    try {
        return res.json({ success: true, ...(await notifications.inbox(req.user.userId)) });
    } catch (error) {
        console.error('Notifications error:', error);
        return res.status(500).json({ success: false, message: 'Server error loading notifications' });
    }
});

router.post('/read', authenticateToken, async (req, res) => {
    try {
        const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.filter(n => Number.isInteger(Number(n))) : null;
        await notifications.markRead(req.user.userId, ids);
        return res.json({ success: true });
    } catch (error) {
        console.error('Mark read error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/reminders', authenticateToken, async (req, res) => {
    try {
        return res.json({ success: true, movieIds: await notifications.reminders(req.user.userId) });
    } catch (error) {
        console.error('Reminders error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

async function toggle(req, res, on) {
    try {
        const movieId = Number(req.params.movieId);
        if (!Number.isInteger(movieId)) return res.status(400).json({ success: false, message: 'Invalid movie ID' });
        const m = await pool.query(`SELECT 1 FROM movies WHERE movie_id = $1`, [movieId]);
        if (m.rows.length === 0) return res.status(404).json({ success: false, message: 'Movie not found' });
        await notifications.setReminder(req.user.userId, movieId, on);
        return res.json({ success: true, movieId, reminder: on });
    } catch (error) {
        if (error.code === '42P01') {
            return res.status(501).json({ success: false, message: 'Run the notifications migration first' });
        }
        console.error('Reminder toggle error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}

router.put('/reminders/:movieId', authenticateToken, (req, res) => toggle(req, res, true));
router.delete('/reminders/:movieId', authenticateToken, (req, res) => toggle(req, res, false));

module.exports = router;
