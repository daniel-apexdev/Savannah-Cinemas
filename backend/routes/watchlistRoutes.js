const express = require('express');
const { getConnection } = require('../config/database');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// ============================================================
// GET WATCHLIST
// ============================================================

router.get('/', authenticateToken, async (req, res) => {
    let connection;

    try {
        console.log(
            `📋 GET /api/watchlist - User ID: ${req.user.userId}`
        );

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                WATCHLIST_ID,
                FILM_ID,
                TITLE,
                YEAR,
                POSTER_URL,
                RATING,
                WATCHED,
                FAVORITE,
                ADDED_DATE,
                WATCHED_DATE
            FROM WATCHLIST
            WHERE USER_ID = :userId
            ORDER BY ADDED_DATE DESC
            `,
            {
                userId: req.user.userId
            }
        );

        const watchlist = result.rows.map(row => ({
            watchlistId: row[0],
            filmId: row[1],
            title: row[2],
            year: row[3],
            poster: row[4],
            rating: row[5],
            watched: row[6] === 'Y',
            favorite: row[7] === 'Y',
            addedDate: row[8],
            watchedDate: row[9]
        }));

        console.log(
            `✅ Watchlist returned: ${watchlist.length} item(s)`
        );

        res.json({
            success: true,
            watchlist
        });

    } catch (error) {

        console.error('❌ Get watchlist error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching watchlist'
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing watchlist connection:',
                    error.message
                );
            }
        }
    }
});


// ============================================================
// ADD TO WATCHLIST
// ============================================================

router.post('/', authenticateToken, async (req, res) => {

    let connection;

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
        // DATABASE CONNECTION
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // CHECK DUPLICATE
        // ----------------------------------------------------

        const existing = await connection.execute(
            `
            SELECT WATCHLIST_ID
            FROM WATCHLIST
            WHERE USER_ID = :userId
              AND FILM_ID = :filmId
            `,
            {
                userId: req.user.userId,
                filmId
            }
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

        const result = await connection.execute(
            `
            INSERT INTO WATCHLIST (
                USER_ID,
                FILM_ID,
                TITLE,
                YEAR,
                POSTER_URL,
                RATING,
                WATCHED,
                FAVORITE,
                ADDED_DATE
            )
            VALUES (
                :userId,
                :filmId,
                :title,
                :year,
                :poster,
                :rating,
                'N',
                'N',
                CURRENT_TIMESTAMP
            )
            `,
            {
                userId: req.user.userId,
                filmId,
                title: title.trim(),
                year: year || null,
                poster: poster || null,
                rating: rating || null
            },
            {
                autoCommit: true
            }
        );

        console.log(
            `✅ Watchlist INSERT successful. Rows affected: ${result.rowsAffected}`
        );

        // ----------------------------------------------------
        // VERIFY INSERT
        // ----------------------------------------------------

        const verify = await connection.execute(
            `
            SELECT
                WATCHLIST_ID,
                USER_ID,
                FILM_ID,
                TITLE
            FROM WATCHLIST
            WHERE USER_ID = :userId
              AND FILM_ID = :filmId
            `,
            {
                userId: req.user.userId,
                filmId
            }
        );

        console.log(
            '🔎 Verification rows:',
            verify.rows.length
        );

        if (verify.rows.length === 0) {

            console.error(
                '❌ INSERT reported success but verification found no row'
            );

            return res.status(500).json({
                success: false,
                message: 'Watchlist item could not be verified after insertion'
            });

        }

        console.log(
            '🎬 Watchlist item:',
            verify.rows[0]
        );

        console.log('==============================================');
        console.log('');

        // ----------------------------------------------------
        // RESPONSE
        // ----------------------------------------------------

        res.status(201).json({
            success: true,
            message: 'Movie added to watchlist',
            watchlistId: verify.rows[0][0],
            userId: verify.rows[0][1],
            filmId: verify.rows[0][2]
        });

    } catch (error) {

        console.error('');
        console.error('❌ ADD WATCHLIST ERROR');
        console.error(error);
        console.error('');

        res.status(500).json({
            success: false,
            message: 'Server error adding movie to watchlist',
            error: error.message
        });

    } finally {

        if (connection) {

            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing watchlist connection:',
                    error.message
                );
            }

        }
    }
});


// ============================================================
// REMOVE FROM WATCHLIST
// ============================================================

router.delete('/:filmId', authenticateToken, async (req, res) => {

    let connection;

    try {

        const filmId = req.params.filmId;

        connection = await getConnection();

        const result = await connection.execute(
            `
            DELETE FROM WATCHLIST
            WHERE USER_ID = :userId
              AND FILM_ID = :filmId
            `,
            {
                userId: req.user.userId,
                filmId
            },
            {
                autoCommit: true
            }
        );

        if (result.rowsAffected === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found in watchlist'
            });

        }

        console.log(
            `🗑️ Removed film ${filmId} from user ${req.user.userId} watchlist`
        );

        res.json({
            success: true,
            message: 'Movie removed from watchlist'
        });

    } catch (error) {

        console.error('❌ Remove watchlist error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error removing movie from watchlist'
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {}
        }
    }
});


// ============================================================
// TOGGLE WATCHED
// ============================================================

router.post('/toggle-watched', authenticateToken, async (req, res) => {

    let connection;

    try {

        const {
            filmId,
            watched
        } = req.body;

        connection = await getConnection();

        const result = await connection.execute(
            `
            UPDATE WATCHLIST
            SET
                WATCHED = :watched,
                WATCHED_DATE =
                    CASE
                        WHEN :watched = 'Y'
                        THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END
            WHERE USER_ID = :userId
              AND FILM_ID = :filmId
            `,
            {
                watched: watched ? 'Y' : 'N',
                userId: req.user.userId,
                filmId
            },
            {
                autoCommit: true
            }
        );

        if (result.rowsAffected === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found in watchlist'
            });

        }

        res.json({
            success: true,
            message: watched
                ? 'Movie marked as watched'
                : 'Movie marked as unwatched'
        });

    } catch (error) {

        console.error('❌ Toggle watched error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error updating watched status'
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {}
        }
    }
});


// ============================================================
// TOGGLE FAVORITE
// ============================================================

router.post('/toggle-favorite', authenticateToken, async (req, res) => {

    let connection;

    try {

        const {
            filmId,
            favorite
        } = req.body;

        connection = await getConnection();

        const result = await connection.execute(
            `
            UPDATE WATCHLIST
            SET FAVORITE = :favorite
            WHERE USER_ID = :userId
              AND FILM_ID = :filmId
            `,
            {
                favorite: favorite ? 'Y' : 'N',
                userId: req.user.userId,
                filmId
            },
            {
                autoCommit: true
            }
        );

        if (result.rowsAffected === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found in watchlist'
            });

        }

        res.json({
            success: true,
            message: favorite
                ? 'Movie added to favorites'
                : 'Movie removed from favorites'
        });

    } catch (error) {

        console.error('❌ Toggle favorite error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error updating favorite status'
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {}
        }
    }
});


module.exports = router;