const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const supabaseAuth = require('../services/supabaseAuth');


// ============================================================
// SUPABASE TOKENS
// The token is a Supabase Auth access token. Check it with Supabase,
// then use our own users row (created on first sign-in).
// ============================================================

const ROLE_PRIORITY = { ADMIN: 4, MANAGER: 3, STAFF: 2, CUSTOMER: 1 };

async function authenticateSupabase(req, res, next) {

    const parts = String(req.headers.authorization || '').trim().split(/\s+/);

    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
        return res.status(401).json({ success: false, message: 'Please sign in' });
    }

    try {

        const authUser = await supabaseAuth.userForToken(parts[1]);

        if (!authUser) {
            return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again' });
        }

        const local = await supabaseAuth.ensureLocalUser(authUser);

        const roles = await pool.query(
            `SELECT r.role_id, r.role_name
             FROM user_role_assignments ura
             JOIN user_roles r ON r.role_id = ura.role_id
             JOIN users u ON u.user_id = ura.user_id
             WHERE ura.user_id = $1 AND r.is_active = 'Y' AND u.is_active = 'Y'`,
            [local.userId]
        );

        if (!roles.rows.length) {
            return res.status(403).json({ success: false, message: 'This account is not active' });
        }

        const best = roles.rows.reduce((a, r) => ((ROLE_PRIORITY[r.role_name] || 0) > (ROLE_PRIORITY[a.role_name] || 0) ? r : a));

        req.user = {
            userId: local.userId,
            email: local.email,
            role: best.role_name,
            roleId: best.role_id,
            authUserId: authUser.id
        };

        return next();

    } catch (error) {

        console.error('Supabase authentication error:', error.message);
        return res.status(503).json({ success: false, message: 'Sign-in is unavailable right now. Try again in a moment' });

    }
}



// ============================================================
// AUTHENTICATE JWT
// ============================================================

async function authenticateToken(req, res, next) {

    // Supabase sign-in (website and app on Supabase)
    if (supabaseAuth.enabled()) {
        return authenticateSupabase(req, res, next);
    }

    try {

        const JWT_SECRET = process.env.JWT_SECRET;

        // ----------------------------------------
        // CHECK JWT SECRET
        // ----------------------------------------

        if (!JWT_SECRET) {

            console.error(
                '❌ JWT_SECRET is not configured'
            );

            return res.status(500).json({
                success: false,
                message:
                    'Authentication service is not configured'
            });

        }


        // ----------------------------------------
        // GET AUTHORIZATION HEADER
        // ----------------------------------------

        const authHeader =
            req.headers.authorization;

        if (!authHeader) {

            return res.status(401).json({
                success: false,
                message:
                    'Authorization header is required'
            });

        }


        // ----------------------------------------
        // VALIDATE BEARER FORMAT
        // ----------------------------------------

        const parts =
            authHeader.trim().split(/\s+/);

        if (
            parts.length !== 2 ||
            parts[0].toLowerCase() !== 'bearer' ||
            !parts[1]
        ) {

            return res.status(401).json({
                success: false,
                message:
                    'Invalid authorization format. Use Bearer <token>'
            });

        }

        const token = parts[1];


        // ----------------------------------------
        // VERIFY JWT
        // ----------------------------------------

        const decoded =
            jwt.verify(token, JWT_SECRET);


        // ----------------------------------------
        // VALIDATE JWT PAYLOAD
        // ----------------------------------------

        if (
            !decoded.userId ||
            !decoded.email
        ) {

            return res.status(401).json({
                success: false,
                message:
                    'Invalid token payload'
            });

        }


        // ----------------------------------------
        // GET CURRENT USER ROLE
        // ----------------------------------------

        const roleResult =
            await pool.query(
                `
                SELECT
                    r.role_id,
                    r.role_name

                FROM user_role_assignments ura

                JOIN user_roles r
                    ON r.role_id = ura.role_id

                JOIN users u
                    ON u.user_id = ura.user_id

                WHERE ura.user_id = $1

                  AND r.is_active = 'Y'

                  AND u.is_active = 'Y'

                ORDER BY r.role_id
                `,
                [decoded.userId]
            );


        // ----------------------------------------
        // USER MUST HAVE A VALID ROLE
        // ----------------------------------------

        if (
            roleResult.rows.length === 0
        ) {

            return res.status(403).json({
                success: false,
                message:
                    'User does not have an active role'
            });

        }


        /*
            If a user has multiple roles,
            the highest-priority active role is used.

            ROLE PRIORITY:

            ADMIN
            MANAGER
            STAFF
            CUSTOMER
        */

        const rolePriority = {
            ADMIN: 4,
            MANAGER: 3,
            STAFF: 2,
            CUSTOMER: 1
        };


        let selectedRole = null;
        let selectedRoleId = null;
        let highestPriority = 0;


        for (
            const row of roleResult.rows
        ) {

            const roleId = row.role_id;
            const roleName = row.role_name;

            const priority =
                rolePriority[roleName] || 0;

            if (
                priority > highestPriority
            ) {

                highestPriority =
                    priority;

                selectedRole =
                    roleName;

                selectedRoleId =
                    roleId;

            }

        }


        if (!selectedRole) {

            return res.status(403).json({
                success: false,
                message:
                    'User has an invalid role'
            });

        }


        // ----------------------------------------
        // ATTACH USER TO REQUEST
        // ----------------------------------------

        req.user = {

            userId:
                decoded.userId,

            email:
                decoded.email,

            role:
                selectedRole,

            roleId:
                selectedRoleId

        };


        // ----------------------------------------
        // CONTINUE REQUEST
        // ----------------------------------------

        next();

    } catch (error) {

        console.error(
            'Authentication error:',
            error.name,
            error.message
        );


        // ----------------------------------------
        // EXPIRED TOKEN
        // ----------------------------------------

        if (
            error.name ===
            'TokenExpiredError'
        ) {

            return res.status(401).json({
                success: false,
                message:
                    'Token has expired'
            });

        }


        // ----------------------------------------
        // INVALID TOKEN
        // ----------------------------------------

        if (
            error.name ===
            'JsonWebTokenError'
        ) {

            return res.status(401).json({
                success: false,
                message:
                    'Invalid token'
            });

        }


        // ----------------------------------------
        // OTHER AUTHENTICATION ERROR
        // ----------------------------------------

        return res.status(401).json({
            success: false,
            message:
                'Authentication failed'
        });

    }

}


// ============================================================
// REQUIRE ROLE
// ============================================================

function requireRole(...allowedRoles) {

    return function (req, res, next) {

        // ----------------------------------------
        // MAKE SURE AUTHENTICATION RAN FIRST
        // ----------------------------------------

        if (!req.user) {

            return res.status(401).json({
                success: false,
                message:
                    'Authentication required'
            });

        }


        // ----------------------------------------
        // CHECK USER ROLE
        // ----------------------------------------

        if (
            !allowedRoles.includes(
                req.user.role
            )
        ) {

            return res.status(403).json({

                success: false,

                message:
                    'You do not have permission to perform this action',

                requiredRoles:
                    allowedRoles,

                currentRole:
                    req.user.role

            });

        }


        next();

    };

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    authenticateToken,

    requireRole

};
