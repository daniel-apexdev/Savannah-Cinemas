const express = require('express');

const {
    register,
    login,
    getCurrentUser
} = require('../controllers/authController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');

const supabaseAuth = require('../services/supabaseAuth');

const router = express.Router();


// ============================================================
// AUTHENTICATION ROUTES
// ============================================================

// With Supabase sign-in, accounts are created and signed in through
// Supabase Auth (supabase-js in the app and website), not here.
const supabaseOnly = (req, res, next) =>
    supabaseAuth.enabled()
        ? res.status(410).json({ success: false, message: 'Sign in with the Savannah Cinemas app or website' })
        : next();

router.post('/register', supabaseOnly, register);

router.post('/login', supabaseOnly, login);


// ============================================================
// PROTECTED ROUTES
// ============================================================

router.get('/me', authenticateToken, getCurrentUser);


module.exports = router;