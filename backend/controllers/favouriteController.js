const { getConnection } = require('../config/database');


// ============================================================
// ADD FAVOURITE
// ============================================================

async function addFavourite(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        const {
            favouriteType,
            referenceId
        } = req.body;

        const parsedReferenceId =
            Number(referenceId);

        // ----------------------------------------------------
        // Validate type
        // ----------------------------------------------------

        const allowedTypes = [
            'MOVIE',
            'CINEMA'
        ];

        if (!allowedTypes.includes(favouriteType)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid favourite type'
            });

        }

        if (!Number.isInteger(parsedReferenceId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid reference ID'
            });

        }

        connection = await getConnection();

        // ----------------------------------------------------
        // Validate referenced object
        // ----------------------------------------------------

        let result;

        if (favouriteType === 'MOVIE') {

            result = await connection.execute(
                `
                SELECT
                    MOVIE_ID,
                    TITLE,
                    POSTER_URL

                FROM MOVIES

                WHERE MOVIE_ID = :referenceId
                `,
                {
                    referenceId: parsedReferenceId
                }
            );

        } else {

            result = await connection.execute(
                `
                SELECT
                    CINEMA_ID,
                    CINEMA_NAME,
                    ADDRESS,
                    CITY

                FROM CINEMAS

                WHERE CINEMA_ID = :referenceId
                `,
                {
                    referenceId: parsedReferenceId
                }
            );

        }

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    `${favouriteType.toLowerCase()} not found`
            });

        }

        // ----------------------------------------------------
        // Check existing favourite
        // ----------------------------------------------------

        const existing =
            await connection.execute(
                `
                SELECT
                    FAVOURITE_ID

                FROM USER_FAVOURITES

                WHERE USER_ID = :userId

                  AND FAVOURITE_TYPE =
                      :favouriteType

                  AND REFERENCE_ID =
                      :referenceId
                `,
                {
                    userId,
                    favouriteType,
                    referenceId:
                        parsedReferenceId
                }
            );

        if (existing.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    'Item is already in your favourites'
            });

        }

        // ----------------------------------------------------
        // Insert favourite
        // ----------------------------------------------------

        const insertResult =
            await connection.execute(
                `
                INSERT INTO USER_FAVOURITES (
                    USER_ID,
                    FAVOURITE_TYPE,
                    REFERENCE_ID
                )
                VALUES (
                    :userId,
                    :favouriteType,
                    :referenceId
                )

                RETURNING FAVOURITE_ID
                INTO :favouriteId
                `,
                {
                    userId,

                    favouriteType,

                    referenceId:
                        parsedReferenceId,

                    favouriteId: {
                        dir:
                            require('oracledb').BIND_OUT,

                        type:
                            require('oracledb').NUMBER
                    }
                }
            );

        const favouriteId =
            insertResult.outBinds
                .favouriteId[0];

        await connection.commit();

        return res.status(201).json({

            success: true,

            message:
                'Added to favourites',

            favourite: {

                favouriteId,

                favouriteType,

                referenceId:
                    parsedReferenceId

            }

        });

    } catch (error) {

        console.error(
            '❌ Add favourite error:',
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
                'Server error adding favourite',

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
// REMOVE FAVOURITE
// ============================================================

async function removeFavourite(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        const favouriteId =
            Number(req.params.favouriteId);

        if (!Number.isInteger(favouriteId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid favourite ID'
            });

        }

        connection = await getConnection();

        const result =
            await connection.execute(
                `
                DELETE FROM USER_FAVOURITES

                WHERE FAVOURITE_ID =
                      :favouriteId

                  AND USER_ID =
                      :userId
                `,
                {
                    favouriteId,
                    userId
                }
            );

        if (result.rowsAffected !== 1) {

            return res.status(404).json({
                success: false,
                message: 'Favourite not found'
            });

        }

        await connection.commit();

        return res.json({

            success: true,

            message:
                'Removed from favourites'

        });

    } catch (error) {

        console.error(
            '❌ Remove favourite error:',
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
                'Server error removing favourite',

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
// GET MY FAVOURITES
// ============================================================

async function getMyFavourites(req, res) {

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

        // ----------------------------------------------------
        // Movies
        // ----------------------------------------------------

        const moviesResult =
            await connection.execute(
                `
                SELECT
                    F.FAVOURITE_ID,
                    M.MOVIE_ID,
                    M.TITLE,
                    M.ORIGINAL_TITLE,
                    M.POSTER_URL,
                    M.BACKDROP_URL,
                    M.RATING,
                    M.RELEASE_DATE,
                    F.CREATED_AT

                FROM USER_FAVOURITES F

                JOIN MOVIES M
                    ON M.MOVIE_ID =
                       F.REFERENCE_ID

                WHERE F.USER_ID = :userId

                  AND F.FAVOURITE_TYPE =
                      'MOVIE'

                ORDER BY
                    F.CREATED_AT DESC
                `,
                {
                    userId
                }
            );

        // ----------------------------------------------------
        // Cinemas
        // ----------------------------------------------------

        const cinemasResult =
            await connection.execute(
                `
                SELECT
                    F.FAVOURITE_ID,
                    C.CINEMA_ID,
                    C.CINEMA_NAME,
                    C.ADDRESS,
                    C.CITY,
                    F.CREATED_AT

                FROM USER_FAVOURITES F

                JOIN CINEMAS C
                    ON C.CINEMA_ID =
                       F.REFERENCE_ID

                WHERE F.USER_ID = :userId

                  AND F.FAVOURITE_TYPE =
                      'CINEMA'

                ORDER BY
                    F.CREATED_AT DESC
                `,
                {
                    userId
                }
            );

        const movies =
            moviesResult.rows.map(row => ({

                favouriteId: row[0],

                movieId: row[1],

                title: row[2],

                originalTitle: row[3],

                posterUrl: row[4],

                backdropUrl: row[5],

                rating: row[6],

                releaseDate: row[7],

                createdAt: row[8]

            }));

        const cinemas =
            cinemasResult.rows.map(row => ({

                favouriteId: row[0],

                cinemaId: row[1],

                name: row[2],

                address: row[3],

                city: row[4],

                createdAt: row[5]

            }));

        return res.json({

            success: true,

            count:
                movies.length +
                cinemas.length,

            favourites: {

                movies,

                cinemas

            }

        });

    } catch (error) {

        console.error(
            '❌ Get favourites error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching favourites',

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
// CHECK FAVOURITE
// ============================================================

async function checkFavourite(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        const {
            favouriteType,
            referenceId
        } = req.query;

        const parsedReferenceId =
            Number(referenceId);

        if (
            !['MOVIE', 'CINEMA']
                .includes(favouriteType)
        ) {

            return res.status(400).json({
                success: false,
                message: 'Invalid favourite type'
            });

        }

        if (!Number.isInteger(parsedReferenceId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid reference ID'
            });

        }

        connection = await getConnection();

        const result =
            await connection.execute(
                `
                SELECT
                    FAVOURITE_ID

                FROM USER_FAVOURITES

                WHERE USER_ID = :userId

                  AND FAVOURITE_TYPE =
                      :favouriteType

                  AND REFERENCE_ID =
                      :referenceId
                `,
                {
                    userId,

                    favouriteType,

                    referenceId:
                        parsedReferenceId
                }
            );

        return res.json({

            success: true,

            isFavourite:
                result.rows.length > 0,

            favouriteId:
                result.rows.length > 0
                    ? result.rows[0][0]
                    : null

        });

    } catch (error) {

        console.error(
            '❌ Check favourite error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error checking favourite',

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


module.exports = {
    addFavourite,
    removeFavourite,
    getMyFavourites,
    checkFavourite
};