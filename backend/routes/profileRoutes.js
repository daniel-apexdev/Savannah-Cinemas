// ============================================================
// SAVANNAH CINEMAS - PROFILE LOOK
// routes/profileRoutes.js
//
// GET   /api/profile/username/check?u=VelvetCritic27   { available, reason? }
// GET   /api/profile/username/suggest?name=Ama          { usernames: [...] }
// GET   /api/profile/backdrops?q=                       film stills to pick from (whole catalogue)
// GET   /api/profile/me                                 { username, avatar, backdrop }
// PATCH /api/profile/me  { username?, avatar?, backdropMovieId? }
// ============================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const look = require('../services/profileLook');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

function fail(res, error, what) {
    if (error instanceof look.LookError) {
        return res.status(error.status).json({ success: false, message: error.message, field: error.field });
    }
    if (error && (error.code === '42703' || error.code === '42P01')) {
        return res.status(503).json({ success: false, message: 'Usernames need the 2026-11-22_profile_look migration (npm run db:migrate).' });
    }
    console.error(`❌ Profile ${what} error:`, error);
    return res.status(500).json({ success: false, message: `Server error ${what}` });
}

router.get('/username/check', async (req, res) => {
    try {
        const u = String(req.query.u ?? '').trim();
        const problem = look.usernameProblem(u);
        if (problem) return res.json({ success: true, available: false, reason: problem });

        // Signed-in callers may "check" their own current name
        let me = null;
        const header = req.headers.authorization || '';
        if (header.startsWith('Bearer ') && process.env.JWT_SECRET) {
            try {
                me = jwt.verify(header.slice(7), process.env.JWT_SECRET).userId ?? null;
            } catch (_) {
                me = null;
            }
        }

        const taken = await look.isTaken(pool, u, me);
        return res.json({ success: true, available: !taken, reason: taken ? 'That username is taken.' : null });
    } catch (error) {
        return fail(res, error, 'checking username');
    }
});

router.get('/username/suggest', async (req, res) => {
    try {
        const usernames = await look.suggestUsernames(undefined, { name: req.query.name, count: 4 });
        return res.json({ success: true, usernames });
    } catch (error) {
        return fail(res, error, 'suggesting usernames');
    }
});

router.get('/backdrops', async (req, res) => {
    try {
        return res.json({ success: true, backdrops: await look.backdropChoices(120, req.query.q) });
    } catch (error) {
        return fail(res, error, 'loading backdrops');
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        return res.json({ success: true, ...(await look.getLook(req.user.userId)) });
    } catch (error) {
        return fail(res, error, 'loading profile');
    }
});

router.patch('/me', authenticateToken, async (req, res) => {
    try {
        const { username, avatar, backdropMovieId } = req.body || {};
        const result = await look.updateLook(req.user.userId, { username, avatar, backdropMovieId });
        return res.json({ success: true, ...result });
    } catch (error) {
        return fail(res, error, 'updating profile');
    }
});

module.exports = router;
