const { getConnection } = require('../config/database');
const oracledb = require('oracledb');


// ============================================================
// CREATE REVIEW
// ============================================================

async function createReview(req, res) {

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

        const {
            movieId,
            rating,
            reviewText
        } = req.body;

        const parsedMovieId = Number(movieId);
        const parsedRating = Number(rating);

        if (!Number.isInteger(parsedMovieId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });

        }

        if (
            !Number.isFinite(parsedRating) ||
            parsedRating < 1 ||
            parsedRating > 5
        ) {

            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });

        }

        // ----------------------------------------------------
        // Validate review text
        // ----------------------------------------------------

        let cleanedReviewText = null;

        if (reviewText !== undefined &&
            reviewText !== null) {

            cleanedReviewText =
                String(reviewText).trim();

            if (cleanedReviewText.length > 2000) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Review cannot exceed 2000 characters'
                });

            }

            if (cleanedReviewText.length === 0) {
                cleanedReviewText = null;
            }
        }

        // ----------------------------------------------------
        // Database
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // Verify movie exists
        // ----------------------------------------------------

        const movieResult =
            await connection.execute(
                `
                SELECT
                    MOVIE_ID,
                    TITLE
                FROM MOVIES
                WHERE MOVIE_ID = :movieId
                `,
                {
                    movieId: parsedMovieId
                }
            );

        if (movieResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });

        }

        const movieTitle =
            movieResult.rows[0][1];

        // ----------------------------------------------------
        // Check existing review
        // ----------------------------------------------------

        const existingResult =
            await connection.execute(
                `
                SELECT
                    REVIEW_ID
                FROM MOVIE_REVIEWS
                WHERE USER_ID = :userId
                  AND MOVIE_ID = :movieId
                `,
                {
                    userId,
                    movieId: parsedMovieId
                }
            );

        if (existingResult.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    'You have already reviewed this movie',
                reviewId:
                    existingResult.rows[0][0]
            });

        }

        // ----------------------------------------------------
        // Create review
        // ----------------------------------------------------

        const result =
            await connection.execute(
                `
                INSERT INTO MOVIE_REVIEWS (
                    USER_ID,
                    MOVIE_ID,
                    RATING,
                    REVIEW_TEXT,
                    STATUS
                )
                VALUES (
                    :userId,
                    :movieId,
                    :rating,
                    :reviewText,
                    'PUBLISHED'
                )
                RETURNING REVIEW_ID
                INTO :reviewId
                `,
                {
                    userId,

                    movieId:
                        parsedMovieId,

                    rating:
                        parsedRating,

                    reviewText:
                        cleanedReviewText,

                    reviewId: {
                        dir:
                            oracledb.BIND_OUT,

                        type:
                            oracledb.NUMBER
                    }
                }
            );

        const reviewId =
            result.outBinds.reviewId[0];

        await connection.commit();

        return res.status(201).json({

            success: true,

            message:
                'Movie review created successfully',

            review: {

                reviewId,

                userId,

                movieId:
                    parsedMovieId,

                movieTitle,

                rating:
                    parsedRating,

                reviewText:
                    cleanedReviewText,

                status:
                    'PUBLISHED'

            }

        });

    } catch (error) {

        console.error(
            '❌ Create review error:',
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

        if (error.errorNum === 1) {

            return res.status(409).json({
                success: false,
                message:
                    'You have already reviewed this movie'
            });

        }

        return res.status(500).json({

            success: false,

            message:
                'Server error creating movie review',

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
// GET MOVIE REVIEWS
// ============================================================

async function getMovieReviews(req, res) {

    let connection;

    try {

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
                    R.REVIEW_ID,
                    R.USER_ID,
                    U.FORENAMES,
                    U.SURNAME,
                    R.RATING,
                    R.REVIEW_TEXT,
                    R.CREATED_AT,
                    R.UPDATED_AT

                FROM MOVIE_REVIEWS R

                JOIN USERS U
                    ON U.USER_ID = R.USER_ID

                WHERE R.MOVIE_ID = :movieId
                  AND R.STATUS = 'PUBLISHED'

                ORDER BY
                    R.CREATED_AT DESC
                `,
                {
                    movieId
                }
            );

        const reviews =
            result.rows.map(row => ({

                reviewId:
                    row[0],

                userId:
                    row[1],

                customerName:
                    `${row[2]} ${row[3]}`,

                rating:
                    row[4],

                reviewText:
                    row[5],

                createdAt:
                    row[6],

                updatedAt:
                    row[7]

            }));

        return res.json({

            success: true,

            movieId,

            count:
                reviews.length,

            reviews

        });

    } catch (error) {

        console.error(
            '❌ Get movie reviews error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching movie reviews',

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
// UPDATE MY REVIEW
// ============================================================

async function updateReview(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        const reviewId =
            Number(req.params.reviewId);

        const {
            rating,
            reviewText
        } = req.body;

        if (!Number.isInteger(reviewId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });

        }

        const parsedRating = Number(rating);

        if (
            !Number.isFinite(parsedRating) ||
            parsedRating < 1 ||
            parsedRating > 5
        ) {

            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });

        }

        let cleanedReviewText = null;

        if (reviewText !== undefined &&
            reviewText !== null) {

            cleanedReviewText =
                String(reviewText).trim();

            if (cleanedReviewText.length > 2000) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Review cannot exceed 2000 characters'
                });

            }

            if (cleanedReviewText.length === 0) {
                cleanedReviewText = null;
            }
        }

        connection = await getConnection();

        const result =
            await connection.execute(
                `
                UPDATE MOVIE_REVIEWS

                SET
                    RATING = :rating,
                    REVIEW_TEXT = :reviewText,
                    UPDATED_AT = CURRENT_TIMESTAMP

                WHERE REVIEW_ID = :reviewId
                  AND USER_ID = :userId
                  AND STATUS = 'PUBLISHED'
                `,
                {
                    rating:
                        parsedRating,

                    reviewText:
                        cleanedReviewText,

                    reviewId,

                    userId
                }
            );

        if (result.rowsAffected === 0) {

            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });

        }

        await connection.commit();

        return res.json({

            success: true,

            message:
                'Review updated successfully',

            review: {

                reviewId,

                rating:
                    parsedRating,

                reviewText:
                    cleanedReviewText

            }

        });

    } catch (error) {

        console.error(
            '❌ Update review error:',
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
                'Server error updating review',

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
// DELETE MY REVIEW
// ============================================================

async function deleteReview(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        const reviewId =
            Number(req.params.reviewId);

        if (!Number.isInteger(reviewId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });

        }

        connection = await getConnection();

        const result =
            await connection.execute(
                `
                UPDATE MOVIE_REVIEWS

                SET
                    STATUS = 'DELETED',
                    UPDATED_AT = CURRENT_TIMESTAMP

                WHERE REVIEW_ID = :reviewId
                  AND USER_ID = :userId
                `,
                {
                    reviewId,
                    userId
                }
            );

        if (result.rowsAffected === 0) {

            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });

        }

        await connection.commit();

        return res.json({

            success: true,

            message:
                'Review deleted successfully'

        });

    } catch (error) {

        console.error(
            '❌ Delete review error:',
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
                'Server error deleting review',

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
    createReview,
    getMovieReviews,
    updateReview,
    deleteReview
};