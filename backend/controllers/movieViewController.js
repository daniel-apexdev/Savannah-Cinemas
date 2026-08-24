const { getConnection } = require('../config/database');


// ============================================================
// RECORD MOVIE VIEW
// ============================================================

async function recordMovieView(req, res) {

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

        const movieId =
            Number(req.body.movieId);

        if (!Number.isInteger(movieId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });

        }

        connection = await getConnection();

        // ----------------------------------------------------
        // Verify movie exists
        // ----------------------------------------------------

        const movieResult =
            await connection.execute(
                `
                SELECT
                    MOVIE_ID,
                    TITLE,
                    POSTER_URL
                FROM MOVIES
                WHERE MOVIE_ID = :movieId
                `,
                {
                    movieId
                }
            );

        if (movieResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });

        }

        const movie =
            movieResult.rows[0];

        // ----------------------------------------------------
        // Check existing view
        // ----------------------------------------------------

        const existingResult =
            await connection.execute(
                `
                SELECT VIEW_ID
                FROM USER_MOVIE_VIEWS
                WHERE USER_ID = :userId
                  AND MOVIE_ID = :movieId
                `,
                {
                    userId,
                    movieId
                }
            );

        // ----------------------------------------------------
        // Existing movie view
        // ----------------------------------------------------

        if (existingResult.rows.length > 0) {

            const viewId =
                existingResult.rows[0][0];

            await connection.execute(
                `
                UPDATE USER_MOVIE_VIEWS

                SET
                    VIEW_COUNT = VIEW_COUNT + 1,
                    LAST_VIEWED_AT = CURRENT_TIMESTAMP

                WHERE VIEW_ID = :viewId
                `,
                {
                    viewId
                }
            );

            await connection.commit();

            return res.json({

                success: true,

                message: 'Movie view recorded',

                view: {

                    viewId,

                    movieId,

                    movieTitle:
                        movie[1],

                    viewCount:
                        'incremented'

                }

            });

        }

        // ----------------------------------------------------
        // First view
        // ----------------------------------------------------

        const insertResult =
            await connection.execute(
                `
                INSERT INTO USER_MOVIE_VIEWS (
                    USER_ID,
                    MOVIE_ID
                )

                VALUES (
                    :userId,
                    :movieId
                )

                RETURNING VIEW_ID
                INTO :viewId
                `,
                {
                    userId,
                    movieId,

                    viewId: {
                        dir:
                            require('oracledb').BIND_OUT,

                        type:
                            require('oracledb').NUMBER
                    }
                }
            );

        const viewId =
            insertResult.outBinds
                .viewId[0];

        await connection.commit();

        return res.status(201).json({

            success: true,

            message: 'Movie view recorded',

            view: {

                viewId,

                movieId,

                movieTitle:
                    movie[1],

                viewCount: 1

            }

        });

    } catch (error) {

        console.error(
            '❌ Record movie view error:',
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
                'Server error recording movie view',

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
// GET RECENTLY VIEWED MOVIES
// ============================================================

async function getRecentlyViewedMovies(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        const limit =
            Math.min(
                Math.max(
                    Number(req.query.limit) || 10,
                    1
                ),
                50
            );

        connection = await getConnection();

        const result =
            await connection.execute(
                `
                SELECT
                    VIEW_ID,
                    MOVIE_ID,
                    TITLE,
                    ORIGINAL_TITLE,
                    POSTER_URL,
                    BACKDROP_URL,
                    TRAILER_URL,
                    RATING,
                    STATUS,
                    VIEW_COUNT,
                    FIRST_VIEWED_AT,
                    LAST_VIEWED_AT

                FROM (
                    SELECT
                        V.VIEW_ID,
                        M.MOVIE_ID,
                        M.TITLE,
                        M.ORIGINAL_TITLE,
                        M.POSTER_URL,
                        M.BACKDROP_URL,
                        M.TRAILER_URL,
                        M.RATING,
                        M.STATUS,
                        V.VIEW_COUNT,
                        V.FIRST_VIEWED_AT,
                        V.LAST_VIEWED_AT

                    FROM USER_MOVIE_VIEWS V

                    JOIN MOVIES M
                        ON M.MOVIE_ID = V.MOVIE_ID

                    WHERE V.USER_ID = :userId

                    ORDER BY
                        V.LAST_VIEWED_AT DESC
                )

                WHERE ROWNUM <= :viewLimit
                `,
                {
                    userId,
                    viewLimit: limit
                }
            );

        const movies =
            result.rows.map(row => ({

                viewId:
                    row[0],

                movieId:
                    row[1],

                title:
                    row[2],

                originalTitle:
                    row[3],

                posterUrl:
                    row[4],

                backdropUrl:
                    row[5],

                trailerUrl:
                    row[6],

                rating:
                    row[7],

                status:
                    row[8],

                viewCount:
                    row[9],

                firstViewedAt:
                    row[10],

                lastViewedAt:
                    row[11]

            }));

        return res.json({

            success: true,

            count: movies.length,

            movies

        });

    } catch (error) {

        console.error(
            '❌ Get recently viewed movies error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching recently viewed movies',

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
// GET MOVIE VIEW STATUS
// ============================================================

async function getMovieViewStatus(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        const movieId =
            Number(req.params.movieId);

        if (!Number.isInteger(movieId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });

        }

        connection = await getConnection();

        const result =
            await connection.execute(
                `
                SELECT
                    VIEW_ID,
                    VIEW_COUNT,
                    FIRST_VIEWED_AT,
                    LAST_VIEWED_AT

                FROM USER_MOVIE_VIEWS

                WHERE USER_ID = :userId
                  AND MOVIE_ID = :movieId
                `,
                {
                    userId,
                    movieId
                }
            );

        if (result.rows.length === 0) {

            return res.json({

                success: true,

                movieId,

                viewed: false,

                view: null

            });

        }

        const row =
            result.rows[0];

        return res.json({

            success: true,

            movieId,

            viewed: true,

            view: {

                viewId:
                    row[0],

                viewCount:
                    row[1],

                firstViewedAt:
                    row[2],

                lastViewedAt:
                    row[3]

            }

        });

    } catch (error) {

        console.error(
            '❌ Get movie view status error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error checking movie view',

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
    recordMovieView,
    getRecentlyViewedMovies,
    getMovieViewStatus
};