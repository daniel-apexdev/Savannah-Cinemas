const express = require('express');

const router = express.Router();

const {
    addFavourite,
    removeFavourite,
    getMyFavourites,
    checkFavourite
} = require('../controllers/favouriteController');

const {
    authenticateToken
} = require('../middleware/authMiddleware');


// GET MY FAVOURITES

router.get(
    '/',
    authenticateToken,
    getMyFavourites
);


// CHECK FAVOURITE

router.get(
    '/check',
    authenticateToken,
    checkFavourite
);


// ADD FAVOURITE

router.post(
    '/',
    authenticateToken,
    addFavourite
);


// REMOVE FAVOURITE

router.delete(
    '/:favouriteId',
    authenticateToken,
    removeFavourite
);


module.exports = router;