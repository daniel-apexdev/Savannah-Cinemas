js
const pool = require('../config/database');


// ============================================================
// ADD FAVOURITE
// ============================================================

async function addFavourite(req, res) {

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

        const {
            favouriteType,
            referenceId
        } = req.body;

        const parsedReferenceId = Number(referenceId);

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

        // ----------------------------------------------------
        // Validate referenced object
        // ----------------------------------------------------

        let result;

        if (favouriteType === 'MOVIE') {

            result = await pool.query(
                `
                SELECT
                    movie_id,
                    title,
                    poster_url
                FROM movies
                WHERE movie_id = $1
                `,
                [parsedReferenceId]
            );

        } else {

            result = await pool.query(
                `
                SELECT
                    cinema_id,
                    cinema_name,
                    address,
                    city
                FROM cinemas
                WHERE cinema_id = $1
                `,
                [parsedReferenceId]
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

        const existing = await pool.query(
            `
            SELECT
                favourite_id
            FROM user_favourites
            WHERE user_id = $1
              AND favourite_type = $2
              AND reference_id = $3
            `,
            [
                userId,
                favouriteType,
                parsedReferenceId
            ]
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

        const insertResult = await pool.query(
            `
            INSERT INTO user_favourites (
                user_id,
                favourite_type,
                reference_id
            )
            VALUES ($1, $2, $3)
            RETURNING favourite_id
            `,
            [
                userId,
                favouriteType,
                parsedReferenceId
            ]
        );

        const favouriteId =
            insertResult.rows[0].favourite_id;

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

        // PostgreSQL unique constraint violation
        if (error.code === '23505') {

            return res.status(409).json({
                success: false,
                message:
                    'Item is already in your favourites'
            });

        }

        return res.status(500).json({

            success: false,

            message:
                'Server error adding favourite',

            error:
                error.message

        });

    }

}


// ============================================================
// REMOVE FAVOURITE
// ============================================================

async function removeFavourite(req, res) {

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

        const favouriteId =
            Number(req.params.favouriteId);

        if (!Number.isInteger(favouriteId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid favourite ID'
            });

        }

        // ----------------------------------------------------
        // Delete favourite
        // ----------------------------------------------------

        const result = await pool.query(
            `
            DELETE FROM user_favourites
            WHERE favourite_id = $1
              AND user_id = $2
            `,
            [
                favouriteId,
                userId
            ]
        );

        // PostgreSQL uses rowCount instead of rowsAffected
        if (result.rowCount !== 1) {

            return res.status(404).json({
                success: false,
                message: 'Favourite not found'
            });

        }

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

        return res.status(500).json({

            success: false,

            message:
                'Server error removing favourite',

            error:
                error.message

        });

    }

}


// ============================================================
// GET MY FAVOURITES
// ============================================================

async function getMyFavourites(req, res) {

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
        // Movies
        // ----------------------------------------------------

        const moviesResult = await pool.query(
            `
            SELECT
                f.favourite_id,
                m.movie_id,
                m.title,
                m.original_title,
                m.poster_url,
                m.backdrop_url,
                m.rating,
                m.release_date,
                f.created_at

            FROM user_favourites f

            JOIN movies m
                ON m.movie_id = f.reference_id

            WHERE f.user_id = $1
              AND f.favourite_type = 'MOVIE'

            ORDER BY
                f.created_at DESC
            `,
            [userId]
        );

        // ----------------------------------------------------
        // Cinemas
        // ----------------------------------------------------

        const cinemasResult = await pool.query(
            `
            SELECT
                f.favourite_id,
                c.cinema_id,
                c.cinema_name,
                c.address,
                c.city,
                f.created_at

            FROM user_favourites f

            JOIN cinemas c
                ON c.cinema_id = f.reference_id

            WHERE f.user_id = $1
              AND f.favourite_type = 'CINEMA'

            ORDER BY
                f.created_at DESC
            `,
            [userId]
        );

        // ----------------------------------------------------
        // Format movies
        // ----------------------------------------------------

        const movies =
            moviesResult.rows.map(row => ({

                favouriteId:
                    row.favourite_id,

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

                rating:
                    row.rating,

                releaseDate:
                    row.release_date,

                createdAt:
                    row.created_at

            }));

        // ----------------------------------------------------
        // Format cinemas
        // ----------------------------------------------------

        const cinemas =
            cinemasResult.rows.map(row => ({

                favouriteId:
                    row.favourite_id,

                cinemaId:
                    row.cinema_id,

                name:
                    row.cinema_name,

                address:
                    row.address,

                city:
                    row.city,

                createdAt:
                    row.created_at

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

    }

}


// ============================================================
// CHECK FAVOURITE
// ============================================================

async function checkFavourite(req, res) {

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

        const {
            favouriteType,
            referenceId
        } = req.query;

        const parsedReferenceId =
            Number(referenceId);

        // ----------------------------------------------------
        // Validate type
        // ----------------------------------------------------

        if (
            !['MOVIE', 'CINEMA']
                .includes(favouriteType)
        ) {

            return res.status(400).json({
                success: false,
                message: 'Invalid favourite type'
            });

        }

        // ----------------------------------------------------
        // Validate reference ID
        // ----------------------------------------------------

        if (!Number.isInteger(parsedReferenceId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid reference ID'
            });

        }

        // ----------------------------------------------------
        // Check favourite
        // ----------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                favourite_id
            FROM user_favourites
            WHERE user_id = $1
              AND favourite_type = $2
              AND reference_id = $3
            `,
            [
                userId,
                favouriteType,
                parsedReferenceId
            ]
        );

        return res.json({

            success: true,

            isFavourite:
                result.rows.length > 0,

            favouriteId:
                result.rows.length > 0
                    ? result.rows[0].favourite_id
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

    }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    addFavourite,
    removeFavourite,
    getMyFavourites,
    checkFavourite
};

