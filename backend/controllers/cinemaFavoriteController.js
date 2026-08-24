const { getConnection } = require('../config/database');


// ============================================================
// ADD CINEMA TO FAVORITES
// ============================================================

async function addCinemaFavorite(req, res) {

    let connection;

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
        // Database connection
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // Verify cinema exists
        // ----------------------------------------------------

        const cinemaResult = await connection.execute(
            `
            SELECT
                CINEMA_ID,
                CINEMA_NAME,
                ADDRESS,
                CITY,
                IS_ACTIVE
            FROM CINEMAS
            WHERE CINEMA_ID = :cinemaId
            `,
            {
                cinemaId
            }
        );

        if (cinemaResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Cinema not found'
            });

        }

        const cinema = cinemaResult.rows[0];

        if (cinema[4] !== 'Y') {

            return res.status(400).json({
                success: false,
                message: 'This cinema is not currently active'
            });

        }

        // ----------------------------------------------------
        // Check existing favorite
        // ----------------------------------------------------

        const existingResult = await connection.execute(
            `
            SELECT FAVORITE_ID
            FROM USER_CINEMA_FAVORITES
            WHERE USER_ID = :userId
              AND CINEMA_ID = :cinemaId
            `,
            {
                userId,
                cinemaId
            }
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

        const insertResult = await connection.execute(
            `
            INSERT INTO USER_CINEMA_FAVORITES (
                USER_ID,
                CINEMA_ID
            )
            VALUES (
                :userId,
                :cinemaId
            )
            RETURNING FAVORITE_ID INTO :favoriteId
            `,
            {
                userId,
                cinemaId,

                favoriteId: {
                    dir: require('oracledb').BIND_OUT,
                    type: require('oracledb').NUMBER
                }
            }
        );

        const favoriteId =
            insertResult.outBinds.favoriteId[0];

        await connection.commit();

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.status(201).json({

            success: true,

            message: 'Cinema added to favorites',

            favorite: {

                favoriteId,

                cinemaId: cinema[0],

                cinemaName: cinema[1],

                address: cinema[2],

                city: cinema[3]

            }

        });

    } catch (error) {

        console.error(
            '❌ Add cinema favorite error:',
            error
        );

        if (connection) {

            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    '❌ Rollback error:',
                    rollbackError
                );
            }

        }

        // ----------------------------------------------------
        // Unique constraint
        // ----------------------------------------------------

        if (error.errorNum === 1) {

            return res.status(409).json({
                success: false,
                message: 'Cinema is already in your favorites'
            });

        }

        return res.status(500).json({

            success: false,

            message:
                'Server error adding cinema to favorites',

            error:
                error.message

        });

    } finally {

        if (connection) {

            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing connection:',
                    error.message
                );
            }

        }

    }

}


// ============================================================
// REMOVE CINEMA FROM FAVORITES
// ============================================================

async function removeCinemaFavorite(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        const cinemaId =
            Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });

        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            DELETE FROM USER_CINEMA_FAVORITES
            WHERE USER_ID = :userId
              AND CINEMA_ID = :cinemaId
            `,
            {
                userId,
                cinemaId
            }
        );

        if (result.rowsAffected === 0) {

            return res.status(404).json({
                success: false,
                message: 'Cinema is not in your favorites'
            });

        }

        await connection.commit();

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

        if (connection) {

            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    '❌ Rollback error:',
                    rollbackError
                );
            }

        }

        return res.status(500).json({

            success: false,

            message:
                'Server error removing cinema from favorites',

            error:
                error.message

        });

    } finally {

        if (connection) {

            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing connection:',
                    error.message
                );
            }

        }

    }

}


// ============================================================
// GET MY FAVORITE CINEMAS
// ============================================================

async function getMyCinemaFavorites(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                UCF.FAVORITE_ID,
                C.CINEMA_ID,
                C.CINEMA_NAME,
                C.ADDRESS,
                C.CITY,
                C.IS_ACTIVE,
                UCF.CREATED_AT

            FROM USER_CINEMA_FAVORITES UCF

            JOIN CINEMAS C
                ON C.CINEMA_ID = UCF.CINEMA_ID

            WHERE UCF.USER_ID = :userId

            ORDER BY UCF.CREATED_AT DESC
            `,
            {
                userId
            }
        );

        const favorites = result.rows.map(row => ({

            favoriteId: row[0],

            cinemaId: row[1],

            cinemaName: row[2],

            address: row[3],

            city: row[4],

            isActive: row[5],

            createdAt: row[6]

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

            message:
                'Server error fetching favorite cinemas',

            error:
                error.message

        });

    } finally {

        if (connection) {

            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing connection:',
                    error.message
                );
            }

        }

    }

}


// ============================================================
// CHECK CINEMA FAVORITE
// ============================================================

async function checkCinemaFavorite(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        const cinemaId =
            Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });

        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT FAVORITE_ID
            FROM USER_CINEMA_FAVORITES
            WHERE USER_ID = :userId
              AND CINEMA_ID = :cinemaId
            `,
            {
                userId,
                cinemaId
            }
        );

        return res.json({

            success: true,

            cinemaId,

            isFavorite:
                result.rows.length > 0,

            favoriteId:
                result.rows.length > 0
                    ? result.rows[0][0]
                    : null

        });

    } catch (error) {

        console.error(
            '❌ Check cinema favorite error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error checking cinema favorite',

            error:
                error.message

        });

    } finally {

        if (connection) {

            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing connection:',
                    error.message
                );
            }

        }

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