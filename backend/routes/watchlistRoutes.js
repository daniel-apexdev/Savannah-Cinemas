const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();


// ============================================================
// GET WATCHLIST
// ============================================================

router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log(
            `📋 GET /api/watchlist - User ID: ${req.user.userId}`
        );

        const result = await pool.query(
            `
            SELECT
                watchlist_id,
                film_id,
                title,
                year,
                poster_url,
                rating,
                watched,
                favorite,
                added_date,
                watched_date
            FROM watchlist
            WHERE user_id = $1
            ORDER BY added_date DESC
            `,
            [req.user.userId]
        );

        const watchlist = result.rows.map(row => ({
            watchlistId: row.watchlist_id,
            filmId: row.film_id,
            title: row.title,
            year: row.year,
            poster: row.poster_url,
            rating: row.rating,
            watched: row.watched === 'Y',
            favorite: row.favorite === 'Y',
            addedDate: row.added_date,
            watchedDate: row.watched_date
        }));

        console.log(
            `✅ Watchlist returned: ${watchlist.length} item(s)`
        );

        return res.json({
            success: true,
            watchlist
        });

    } catch (error) {

        console.error('❌ Get watchlist error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching watchlist'
        });
    }
});


// ============================================================
// ADD TO WATCHLIST
// ============================================================

router.post('/', authenticateToken, async (req, res) => {

    try {

        const {
            filmId,
            title,
            year,
            poster,
            rating
        } = req.body;

        console.log('');
        console.log('==============================================');
        console.log('➕ ADD TO WATCHLIST');
        console.log('==============================================');
        console.log('User ID:', req.user.userId);
        console.log('Film ID:', filmId);
        console.log('Title:', title);

        // ----------------------------------------------------
        // VALIDATION
        // ----------------------------------------------------

        if (filmId === undefined || filmId === null) {

            return res.status(400).json({
                success: false,
                message: 'filmId is required'
            });
        }

        if (!title) {

            return res.status(400).json({
                success: false,
                message: 'title is required'
            });
        }

        // ----------------------------------------------------
        // CHECK DUPLICATE
        // ----------------------------------------------------

        const existing = await pool.query(
            `
            SELECT watchlist_id
            FROM watchlist
            WHERE user_id = $1
              AND film_id = $2
            `,
            [
                req.user.userId,
                filmId
            ]
        );

        if (existing.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message: 'Movie already exists in your watchlist'
            });
        }

        // ----------------------------------------------------
        // INSERT
        // ----------------------------------------------------

        const result = await pool.query(
            `
            INSERT INTO watchlist (
                user_id,
                film_id,
                title,
                year,
                poster_url,
                rating,
                watched,
                favorite,
                added_date
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                'N',
                'N',
                CURRENT_TIMESTAMP
            )
            RETURNING
                watchlist_id,
                user_id,
                film_id
            `,
            [
                req.user.userId,
                filmId,
                title.trim(),
                year || null,
                poster || null,
                rating || null
            ]
        );

        console.log(
            `✅ Watchlist INSERT successful. Rows returned: ${result.rows.length}`
        );

        // ----------------------------------------------------
        // RESPONSE
        // ----------------------------------------------------

        const inserted = result.rows[0];

        console.log(
            '🎬 Watchlist item:',
            inserted
        );

        console.log('==============================================');
        console.log('');

        return res.status(201).json({
            success: true,
            message: 'Movie added to watchlist',
            watchlistId: inserted.watchlist_id,
            userId: inserted.user_id,
            filmId: inserted.film_id
        });

    } catch (error) {

        console.error('');
        console.error('❌ ADD WATCHLIST ERROR');
        console.error(error);
        console.error('');

        return res.status(500).json({
            success: false,
            message: 'Server error adding movie to watchlist',
            error: error.message
        });
    }
});


// ============================================================
// REMOVE FROM WATCHLIST
// ============================================================

router.delete('/:filmId', authenticateToken, async (req, res) => {

    try {

        const filmId = req.params.filmId;

        const result = await pool.query(
            `
            DELETE FROM watchlist
            WHERE user_id = $1
              AND film_id = $2
            `,
            [
                req.user.userId,
                filmId
            ]
        );

        if (result.rowCount === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found in watchlist'
            });
        }

        console.log(
            `🗑️ Removed film ${filmId} from user ${req.user.userId} watchlist`
        );

        return res.json({
            success: true,
            message: 'Movie removed from watchlist'
        });

    } catch (error) {

        console.error('❌ Remove watchlist error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error removing movie from watchlist'
        });
    }
});


// ============================================================
// TOGGLE WATCHED
// ============================================================

router.post('/toggle-watched', authenticateToken, async (req, res) => {

    try {

        const {
            filmId,
            watched
        } = req.body;

        const watchedValue = watched ? 'Y' : 'N';

        const result = await pool.query(
            `
            UPDATE watchlist
            SET
                watched = $1,
                watched_date = CASE
                    WHEN $1 = 'Y'
                    THEN CURRENT_TIMESTAMP
                    ELSE NULL
                END
            WHERE user_id = $2
              AND film_id = $3
            `,
            [
                watchedValue,
                req.user.userId,
                filmId
            ]
        );

        if (result.rowCount === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found in watchlist'
            });
        }

        return res.json({
            success: true,
            message: watched
                ? 'Movie marked as watched'
                : 'Movie marked as unwatched'
        });

    } catch (error) {

        console.error('❌ Toggle watched error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error updating watched status'
        });
    }
});


// ============================================================
// TOGGLE FAVORITE
// ============================================================

router.post('/toggle-favorite', authenticateToken, async (req, res) => {

    try {

        const {
            filmId,
            favorite
        } = req.body;

        const favoriteValue = favorite ? 'Y' : 'N';

        const result = await pool.query(
            `
            UPDATE watchlist
            SET favorite = $1
            WHERE user_id = $2
              AND film_id = $3
            `,
            [
                favoriteValue,
                req.user.userId,
                filmId
            ]
        );

        if (result.rowCount === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found in watchlist'
            });
        }

        return res.json({
            success: true,
            message: favorite
                ? 'Movie added to favorites'
                : 'Movie removed from favorites'
        });

    } catch (error) {

        console.error('❌ Toggle favorite error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error updating favorite status'
        });
    }
});


module.exports = router;