const { getConnection } = require('../config/database');

// ============================================================
// GET WATCHLIST
// ============================================================

async function getWatchlist(req, res) {
    let connection;

    try {
        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
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
            filmId: row[0],
            title: row[1],
            year: row[2],
            poster: row[3],
            rating: row[4],
            watched: row[5] === 'Y',
            favorite: row[6] === 'Y',
            addedDate: row[7],
            watchedDate: row[8]
        }));

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
                    'Error closing watchlist connection:',
                    error.message
                );
            }
        }
    }
}

// ============================================================
// ADD TO WATCHLIST
// ============================================================

async function addToWatchlist(req, res) {
    let connection;

    try {

        const {
            filmId,
            title,
            year,
            poster,
            rating
        } = req.body;

        if (!filmId || !title) {
            return res.status(400).json({
                success: false,
                message: 'filmId and title are required'
            });
        }

        connection = await getConnection();

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
                message: 'Movie already in watchlist'
            });
        }

        await connection.execute(
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
                title,
                year: year || null,
                poster: poster || null,
                rating: rating || 0
            }
        );

        res.status(201).json({
            success: true,
            message: 'Movie added to watchlist'
        });

    } catch (error) {

        console.error('❌ Add to watchlist error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error adding to watchlist'
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    'Error closing watchlist connection:',
                    error.message
                );
            }
        }
    }
}

// ============================================================
// REMOVE FROM WATCHLIST
// ============================================================

async function removeFromWatchlist(req, res) {
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
            message: 'Movie removed from watchlist'
        });

    } catch (error) {

        console.error('❌ Remove from watchlist error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error removing from watchlist'
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    'Error closing watchlist connection:',
                    error.message
                );
            }
        }
    }
}

// ============================================================
// TOGGLE WATCHED
// ============================================================

async function toggleWatched(req, res) {
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
            } catch (error) {
                console.error(
                    'Error closing watchlist connection:',
                    error.message
                );
            }
        }
    }
}

// ============================================================
// TOGGLE FAVORITE
// ============================================================

async function toggleFavorite(req, res) {
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
            } catch (error) {
                console.error(
                    'Error closing watchlist connection:',
                    error.message
                );
            }
        }
    }
}

module.exports = {
    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatched,
    toggleFavorite
};