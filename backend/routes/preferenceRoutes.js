const express = require('express');

const router = express.Router();

const {
    getMyPreferences,
    updateMyPreferences,
    updateNotificationPreferences
} = require('../controllers/preferenceController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');


// ============================================================
// GET MY PREFERENCES
// ============================================================

router.get(
    '/',
    authenticateToken,
    getMyPreferences
);


// ============================================================
// UPDATE MY PREFERENCES
// ============================================================

router.put(
    '/',
    authenticateToken,
    updateMyPreferences
);


// ============================================================
// UPDATE NOTIFICATION PREFERENCES
// ============================================================

router.patch(
    '/notifications',
    authenticateToken,
    updateNotificationPreferences
);


module.exports = router;