const pool = require('../config/database');


// ============================================================
// ADD CINEMA TO FAVORITES
// ============================================================

async function addCinemaFavorite(req, res) {
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
        // Request data
        // ----------------------------------------------------

        const cinemaId = Number(req.body.cinemaId);

        if (!Number.isInteger(cinemaId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });
        }

        // ----------------------------------------------------
        // Verify cinema exists
        // ----------------------------------------------------

        const cinemaResult = await pool.query(
            `
            SELECT
                cinema_id,
                cinema_name,
                address,
                city,
                is_active
            FROM cinemas
            WHERE cinema_id = $1
            `,
            [cinemaId]
        );

        if (cinemaResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cinema not found'
            });
        }

        const cinema = cinemaResult.rows[0];

        if (cinema.is_active !== 'Y') {
            return res.status(400).json({
                success: false,
                message: 'This cinema is not currently active'
            });
        }

        // ----------------------------------------------------
        // Check existing favorite
        // ----------------------------------------------------

        const existingResult = await pool.query(
            `
            SELECT favorite_id
            FROM user_cinema_favorites
            WHERE user_id = $1
              AND cinema_id = $2
            `,
            [userId, cinemaId]
        );

        if (existingResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Cinema is already in your favorites'
            });
        }

        // ----------------------------------------------------
        // Insert favorite
        // ----------------------------------------------------

        const insertResult = await pool.query(
            `
            INSERT INTO user_cinema_favorites (
                user_id,
                cinema_id
            )
            VALUES ($1, $2)
            RETURNING favorite_id
            `,
            [userId, cinemaId]
        );

        const favoriteId = insertResult.rows[0].favorite_id;

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.status(201).json({
            success: true,
            message: 'Cinema added to favorites',

            favorite: {
                favoriteId,
                cinemaId: cinema.cinema_id,
                cinemaName: cinema.cinema_name,
                address: cinema.address,
                city: cinema.city
            }
        });

    } catch (error) {
        console.error(
            '❌ Add cinema favorite error:',
            error
        );

        // PostgreSQL unique constraint violation
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Cinema is already in your favorites'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Server error adding cinema to favorites',
            error: error.message
        });
    }
}


// ============================================================
// REMOVE CINEMA FROM FAVORITES
// ============================================================

async function removeCinemaFavorite(req, res) {
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

        const cinemaId = Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });
        }

        // ----------------------------------------------------
        // Delete favorite
        // ----------------------------------------------------

        const result = await pool.query(
            `
            DELETE FROM user_cinema_favorites
            WHERE user_id = $1
              AND cinema_id = $2
            `,
            [userId, cinemaId]
        );

        // PostgreSQL uses rowCount instead of rowsAffected
        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cinema is not in your favorites'
            });
        }

        return res.json({
            success: true,
            message: 'Cinema removed from favorites',
            cinemaId
        });

    } catch (error) {
        console.error(
            '❌ Remove cinema favorite error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Server error removing cinema from favorites',
            error: error.message
        });
    }
}


// ============================================================
// GET MY FAVORITE CINEMAS
// ============================================================

async function getMyCinemaFavorites(req, res) {
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
        // Get favorites
        // ----------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                ucf.favorite_id,
                c.cinema_id,
                c.cinema_name,
                c.address,
                c.city,
                c.is_active,
                ucf.created_at

            FROM user_cinema_favorites ucf

            JOIN cinemas c
                ON c.cinema_id = ucf.cinema_id

            WHERE ucf.user_id = $1

            ORDER BY ucf.created_at DESC
            `,
            [userId]
        );

        const favorites = result.rows.map(row => ({
            favoriteId: row.favorite_id,
            cinemaId: row.cinema_id,
            cinemaName: row.cinema_name,
            address: row.address,
            city: row.city,
            isActive: row.is_active === 'Y',
            createdAt: row.created_at
        }));

        return res.json({
            success: true,
            count: favorites.length,
            favorites
        });

    } catch (error) {
        console.error(
            '❌ Get cinema favorites error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Server error fetching favorite cinemas',
            error: error.message
        });
    }
}


// ============================================================
// CHECK CINEMA FAVORITE
// ============================================================

async function checkCinemaFavorite(req, res) {
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

        const cinemaId = Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });
        }

        // ----------------------------------------------------
        // Check favorite
        // ----------------------------------------------------

        const result = await pool.query(
            `
            SELECT favorite_id
            FROM user_cinema_favorites
            WHERE user_id = $1
              AND cinema_id = $2
            `,
            [userId, cinemaId]
        );

        return res.json({
            success: true,
            cinemaId,

            isFavorite: result.rows.length > 0,

            favoriteId:
                result.rows.length > 0
                    ? result.rows[0].favorite_id
                    : null
        });

    } catch (error) {
        console.error(
            '❌ Check cinema favorite error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Server error checking cinema favorite',
            error: error.message
        });
    }
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    addCinemaFavorite,
    removeCinemaFavorite,
    getMyCinemaFavorites,
    checkCinemaFavorite
};