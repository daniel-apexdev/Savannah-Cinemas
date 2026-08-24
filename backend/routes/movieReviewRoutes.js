const express = require('express');

const router = express.Router();

const {
    createReview,
    getMovieReviews,
    updateReview,
    deleteReview
} = require('../controllers/movieReviewController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');


// ============================================================
// GET REVIEWS FOR MOVIE
// ============================================================

router.get(
    '/movie/:movieId',
    getMovieReviews
);


// ============================================================
// CREATE REVIEW
// ============================================================

router.post(
    '/',
    authenticateToken,
    createReview
);


// ============================================================
// UPDATE MY REVIEW
// ============================================================

router.patch(
    '/:reviewId',
    authenticateToken,
    updateReview
);


// ============================================================
// DELETE MY REVIEW
// ============================================================

router.delete(
    '/:reviewId',
    authenticateToken,
    deleteReview
);


module.exports = router;