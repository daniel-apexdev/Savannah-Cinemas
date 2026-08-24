const express = require('express');

const router = express.Router();

const {
    getMyProfile,
    updateMyProfile,
    changeMyPassword
} = require('../controllers/userController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');


// ============================================================
// GET MY PROFILE
// ============================================================

router.get(
    '/me',
    authenticateToken,
    getMyProfile
);


// ============================================================
// UPDATE MY PROFILE
// ============================================================

router.patch(
    '/me',
    authenticateToken,
    updateMyProfile
);

// ============================================================
// CHANGE MY PASSWORD
// ============================================================

router.patch(
    '/me/password',
    authenticateToken,
    changeMyPassword
);


module.exports = router;