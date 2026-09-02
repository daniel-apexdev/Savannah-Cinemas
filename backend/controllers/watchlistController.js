const pool = require('../config/database');


// ============================================================
// GET WATCHLIST
// ============================================================

async function getWatchlist(req, res) {

    try {

        // ----------------------------------------------------
        // Authentication
        // ----------------------------------------------------

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;


        // ----------------------------------------------------
        // Get watchlist
        // ----------------------------------------------------

        const result = await pool.query(
            `
            SELECT
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
            [userId]
        );


        // ----------------------------------------------------
        // Format response
        // ----------------------------------------------------

        const watchlist = result.rows.map(row => ({

            filmId:
                row.film_id,

            title:
                row.title,

            year:
                row.year,

            poster:
                row.poster_url,

            rating:
                row.rating,

            watched:
                row.watched === 'Y',

            favorite:
                row.favorite === 'Y',

            addedDate:
                row.added_date,

            watchedDate:
                row.watched_date

        }));


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            watchlist

        });

    } catch (error) {

        console.error(
            '❌ Get watchlist error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching watchlist'

        });

    }

}


// ============================================================
// ADD TO WATCHLIST
// ============================================================

async function addToWatchlist(req, res) {

    try {

        // ----------------------------------------------------
        // Authentication
        // ----------------------------------------------------

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }


        // ----------------------------------------------------
        // Request data
        // ----------------------------------------------------

        const {
            filmId,
            title,
            year,
            poster,
            rating
        } = req.body;


        // ----------------------------------------------------
        // Validation
        // ----------------------------------------------------

        if (!filmId || !title) {

            return res.status(400).json({

                success: false,

                message:
                    'filmId and title are required'

            });

        }


        const userId = req.user.userId;


        // ----------------------------------------------------
        // Check existing watchlist entry
        // ----------------------------------------------------

        const existing = await pool.query(
            `
            SELECT
                watchlist_id

            FROM watchlist

            WHERE user_id = $1
              AND film_id = $2
            `,
            [
                userId,
                filmId
            ]
        );


        if (existing.rows.length > 0) {

            return res.status(409).json({

                success: false,

                message:
                    'Movie already in watchlist'

            });

        }


        // ----------------------------------------------------
        // Insert watchlist entry
        // ----------------------------------------------------

        await pool.query(
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
            `,
            [
                userId,
                filmId,
                title,
                year || null,
                poster || null,
                rating || 0
            ]
        );


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.status(201).json({

            success: true,

            message:
                'Movie added to watchlist'

        });

    } catch (error) {

        console.error(
            '❌ Add to watchlist error:',
            error
        );


        // ----------------------------------------------------
        // PostgreSQL duplicate key protection
        // ----------------------------------------------------

        if (error.code === '23505') {

            return res.status(409).json({

                success: false,

                message:
                    'Movie already in watchlist'

            });

        }


        return res.status(500).json({

            success: false,

            message:
                'Server error adding to watchlist'

        });

    }

}


// ============================================================
// REMOVE FROM WATCHLIST
// ============================================================

async function removeFromWatchlist(req, res) {

    try {

        // ----------------------------------------------------
        // Authentication
        // ----------------------------------------------------

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }


        const userId = req.user.userId;

        const filmId =
            req.params.filmId;


        // ----------------------------------------------------
        // Delete watchlist entry
        // ----------------------------------------------------

        const result = await pool.query(
            `
            DELETE FROM watchlist

            WHERE user_id = $1
              AND film_id = $2
            `,
            [
                userId,
                filmId
            ]
        );


        // ----------------------------------------------------
        // Movie not found
        // ----------------------------------------------------

        if (result.rowCount === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Movie not found in watchlist'

            });

        }


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            message:
                'Movie removed from watchlist'

        });

    } catch (error) {

        console.error(
            '❌ Remove from watchlist error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error removing from watchlist'

        });

    }

}


// ============================================================
// TOGGLE WATCHED
// ============================================================

async function toggleWatched(req, res) {

    try {

        // ----------------------------------------------------
        // Authentication
        // ----------------------------------------------------

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }


        // ----------------------------------------------------
        // Request data
        // ----------------------------------------------------

        const {
            filmId,
            watched
        } = req.body;


        const userId =
            req.user.userId;

        const watchedValue =
            watched ? 'Y' : 'N';


        // ----------------------------------------------------
        // Update watched status
        // ----------------------------------------------------

        const result = await pool.query(
            `
            UPDATE watchlist

            SET
                watched = $1,

                watched_date =
                    CASE
                        WHEN $1 = 'Y'
                        THEN CURRENT_TIMESTAMP
                        ELSE NULL
                    END

            WHERE user_id = $2
              AND film_id = $3
            `,
            [
                watchedValue,
                userId,
                filmId
            ]
        );


        // ----------------------------------------------------
        // Movie not found
        // ----------------------------------------------------

        if (result.rowCount === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Movie not found in watchlist'

            });

        }


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            message: watched
                ? 'Movie marked as watched'
                : 'Movie marked as unwatched'

        });

    } catch (error) {

        console.error(
            '❌ Toggle watched error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error updating watched status'

        });

    }

}


// ============================================================
// TOGGLE FAVORITE
// ============================================================

async function toggleFavorite(req, res) {

    try {

        // ----------------------------------------------------
        // Authentication
        // ----------------------------------------------------

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }


        // ----------------------------------------------------
        // Request data
        // ----------------------------------------------------

        const {
            filmId,
            favorite
        } = req.body;


        const userId =
            req.user.userId;

        const favoriteValue =
            favorite ? 'Y' : 'N';


        // ----------------------------------------------------
        // Update favorite status
        // ----------------------------------------------------

        const result = await pool.query(
            `
            UPDATE watchlist

            SET
                favorite = $1

            WHERE user_id = $2
              AND film_id = $3
            `,
            [
                favoriteValue,
                userId,
                filmId
            ]
        );


        // ----------------------------------------------------
        // Movie not found
        // ----------------------------------------------------

        if (result.rowCount === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Movie not found in watchlist'

            });

        }


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            message: favorite
                ? 'Movie added to favorites'
                : 'Movie removed from favorites'

        });

    } catch (error) {

        console.error(
            '❌ Toggle favorite error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error updating favorite status'

        });

    }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    getWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatched,
    toggleFavorite

};