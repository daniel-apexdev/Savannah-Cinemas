const express = require('express');

const router =
    express.Router();


const {
    verifyTicket,
    useTicket
} = require('../controllers/ticketController');


const {
    authenticateToken,
    requireRole
} = require('../middleware/authMiddleware');


// ============================================================
// VERIFY TICKET
// STAFF / MANAGER / ADMIN
// ============================================================

router.post(
    '/verify',
    authenticateToken,
    requireRole(
        'STAFF',
        'MANAGER',
        'ADMIN'
    ),
    verifyTicket
);


// ============================================================
// USE / ADMIT TICKET
// STAFF / MANAGER / ADMIN
// ============================================================

router.post(
    '/:ticketId/use',
    authenticateToken,
    requireRole(
        'STAFF',
        'MANAGER',
        'ADMIN'
    ),
    useTicket
);


module.exports = router;
