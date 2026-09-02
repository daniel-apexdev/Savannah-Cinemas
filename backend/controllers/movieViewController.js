const pool = require('../config/database');


// ============================================================
// RECORD MOVIE VIEW
// ============================================================

async function recordMovieView(req, res) {

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

        // ----------------------------------------------------
        // Verify movie exists
        // ----------------------------------------------------

        const movieResult = await pool.query(
            `
            SELECT
                movie_id,
                title,
                poster_url
            FROM movies
            WHERE movie_id = $1
            `,
            [movieId]
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

        const existingResult = await pool.query(
            `
            SELECT
                view_id
            FROM user_movie_views
            WHERE user_id = $1
              AND movie_id = $2
            `,
            [
                userId,
                movieId
            ]
        );

        // ----------------------------------------------------
        // Existing movie view
        // ----------------------------------------------------

        if (existingResult.rows.length > 0) {

            const viewId =
                existingResult.rows[0].view_id;

            await pool.query(
                `
                UPDATE user_movie_views

                SET
                    view_count = view_count + 1,
                    last_viewed_at = CURRENT_TIMESTAMP

                WHERE view_id = $1
                `,
                [viewId]
            );

            return res.json({

                success: true,

                message:
                    'Movie view recorded',

                view: {

                    viewId,

                    movieId,

                    movieTitle:
                        movie.title,

                    viewCount:
                        'incremented'

                }

            });

        }

        // ----------------------------------------------------
        // First view
        // ----------------------------------------------------

        const insertResult = await pool.query(
            `
            INSERT INTO user_movie_views (
                user_id,
                movie_id
            )

            VALUES (
                $1,
                $2
            )

            RETURNING view_id
            `,
            [
                userId,
                movieId
            ]
        );

        const viewId =
            insertResult.rows[0].view_id;

        return res.status(201).json({

            success: true,

            message:
                'Movie view recorded',

            view: {

                viewId,

                movieId,

                movieTitle:
                    movie.title,

                viewCount: 1

            }

        });

    } catch (error) {

        console.error(
            '❌ Record movie view error:',
            error
        );

        // PostgreSQL unique constraint violation
        if (error.code === '23505') {

            return res.status(409).json({

                success: false,

                message:
                    'Movie view already exists'

            });

        }

        return res.status(500).json({

            success: false,

            message:
                'Server error recording movie view',

            error:
                error.message

        });

    }

}


// ============================================================
// GET RECENTLY VIEWED MOVIES
// ============================================================

async function getRecentlyViewedMovies(req, res) {

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
        // Validate limit
        // ----------------------------------------------------

        const limit =
            Math.min(
                Math.max(
                    Number(req.query.limit) || 10,
                    1
                ),
                50
            );

        // ----------------------------------------------------
        // Get recently viewed movies
        // ----------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                v.view_id,
                m.movie_id,
                m.title,
                m.original_title,
                m.poster_url,
                m.backdrop_url,
                m.trailer_url,
                m.rating,
                m.status,
                v.view_count,
                v.first_viewed_at,
                v.last_viewed_at

            FROM user_movie_views v

            JOIN movies m
                ON m.movie_id = v.movie_id

            WHERE v.user_id = $1

            ORDER BY
                v.last_viewed_at DESC

            LIMIT $2
            `,
            [
                userId,
                limit
            ]
        );

        // ----------------------------------------------------
        // Format response
        // ----------------------------------------------------

        const movies =
            result.rows.map(row => ({

                viewId:
                    row.view_id,

                movieId:
                    row.movie_id,

                title:
                    row.title,

                originalTitle:
                    row.original_title,

                posterUrl:
                    row.poster_url,

                backdropUrl:
                    row.backdrop_url,

                trailerUrl:
                    row.trailer_url,

                rating:
                    row.rating,

                status:
                    row.status,

                viewCount:
                    row.view_count,

                firstViewedAt:
                    row.first_viewed_at,

                lastViewedAt:
                    row.last_viewed_at

            }));

        return res.json({

            success: true,

            count:
                movies.length,

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

    }

}


// ============================================================
// GET MOVIE VIEW STATUS
// ============================================================

async function getMovieViewStatus(req, res) {

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
            Number(req.params.movieId);

        if (!Number.isInteger(movieId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });

        }

        // ----------------------------------------------------
        // Get view status
        // ----------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                view_id,
                view_count,
                first_viewed_at,
                last_viewed_at

            FROM user_movie_views

            WHERE user_id = $1
              AND movie_id = $2
            `,
            [
                userId,
                movieId
            ]
        );

        // ----------------------------------------------------
        // Movie has not been viewed
        // ----------------------------------------------------

        if (result.rows.length === 0) {

            return res.json({

                success: true,

                movieId,

                viewed: false,

                view: null

            });

        }

        // ----------------------------------------------------
        // Movie has been viewed
        // ----------------------------------------------------

        const row =
            result.rows[0];

        return res.json({

            success: true,

            movieId,

            viewed: true,

            view: {

                viewId:
                    row.view_id,

                viewCount:
                    row.view_count,

                firstViewedAt:
                    row.first_viewed_at,

                lastViewedAt:
                    row.last_viewed_at

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