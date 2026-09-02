js
const pool = require('../config/database');


// ============================================================
// CREATE REVIEW
// ============================================================

async function createReview(req, res) {

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

        if (
            reviewText !== undefined &&
            reviewText !== null
        ) {

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
        // Verify movie exists
        // ----------------------------------------------------

        const movieResult = await pool.query(
            `
            SELECT
                movie_id,
                title
            FROM movies
            WHERE movie_id = $1
            `,
            [parsedMovieId]
        );

        if (movieResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });

        }

        const movieTitle =
            movieResult.rows[0].title;

        // ----------------------------------------------------
        // Check existing review
        // ----------------------------------------------------

        const existingResult = await pool.query(
            `
            SELECT
                review_id
            FROM movie_reviews
            WHERE user_id = $1
              AND movie_id = $2
            `,
            [
                userId,
                parsedMovieId
            ]
        );

        if (existingResult.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    'You have already reviewed this movie',
                reviewId:
                    existingResult.rows[0].review_id
            });

        }

        // ----------------------------------------------------
        // Create review
        // ----------------------------------------------------

        const result = await pool.query(
            `
            INSERT INTO movie_reviews (
                user_id,
                movie_id,
                rating,
                review_text,
                status
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                'PUBLISHED'
            )
            RETURNING review_id
            `,
            [
                userId,
                parsedMovieId,
                parsedRating,
                cleanedReviewText
            ]
        );

        const reviewId =
            result.rows[0].review_id;

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

        // PostgreSQL unique constraint violation
        if (error.code === '23505') {

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

    }

}


// ============================================================
// GET MOVIE REVIEWS
// ============================================================

async function getMovieReviews(req, res) {

    try {

        const movieId =
            Number(req.params.movieId);

        if (!Number.isInteger(movieId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });

        }

        const result = await pool.query(
            `
            SELECT
                r.review_id,
                r.user_id,
                u.forenames,
                u.surname,
                r.rating,
                r.review_text,
                r.created_at,
                r.updated_at

            FROM movie_reviews r

            JOIN users u
                ON u.user_id = r.user_id

            WHERE r.movie_id = $1
              AND r.status = 'PUBLISHED'

            ORDER BY
                r.created_at DESC
            `,
            [movieId]
        );

        const reviews =
            result.rows.map(row => ({

                reviewId:
                    row.review_id,

                userId:
                    row.user_id,

                customerName:
                    `${row.forenames} ${row.surname}`,

                rating:
                    row.rating,

                reviewText:
                    row.review_text,

                createdAt:
                    row.created_at,

                updatedAt:
                    row.updated_at

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

    }

}


// ============================================================
// UPDATE MY REVIEW
// ============================================================

async function updateReview(req, res) {

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

        // ----------------------------------------------------
        // Validate review text
        // ----------------------------------------------------

        let cleanedReviewText = null;

        if (
            reviewText !== undefined &&
            reviewText !== null
        ) {

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
        // Update review
        // ----------------------------------------------------

        const result = await pool.query(
            `
            UPDATE movie_reviews

            SET
                rating = $1,
                review_text = $2,
                updated_at = CURRENT_TIMESTAMP

            WHERE review_id = $3
              AND user_id = $4
              AND status = 'PUBLISHED'
            `,
            [
                parsedRating,
                cleanedReviewText,
                reviewId,
                userId
            ]
        );

        if (result.rowCount === 0) {

            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });

        }

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

        return res.status(500).json({

            success: false,

            message:
                'Server error updating review',

            error:
                error.message

        });

    }

}


// ============================================================
// DELETE MY REVIEW
// ============================================================

async function deleteReview(req, res) {

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

        const reviewId =
            Number(req.params.reviewId);

        if (!Number.isInteger(reviewId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid review ID'
            });

        }

        // ----------------------------------------------------
        // Soft delete review
        // ----------------------------------------------------

        const result = await pool.query(
            `
            UPDATE movie_reviews

            SET
                status = 'DELETED',
                updated_at = CURRENT_TIMESTAMP

            WHERE review_id = $1
              AND user_id = $2
            `,
            [
                reviewId,
                userId
            ]
        );

        if (result.rowCount === 0) {

            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });

        }

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

        return res.status(500).json({

            success: false,

            message:
                'Server error deleting movie review',

            error:
                error.message

        });

    }

}


module.exports = {
    createReview,
    getMovieReviews,
    updateReview,
    deleteReview
};

