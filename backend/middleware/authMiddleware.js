const jwt = require('jsonwebtoken');

const { getConnection } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;


// ============================================================
// AUTHENTICATE JWT
// ============================================================

async function authenticateToken(req, res, next) {

    let connection;

    try {

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

        connection =
            await getConnection();

        const roleResult =
            await connection.execute(
                `
                SELECT
                    R.ROLE_ID,
                    R.ROLE_NAME

                FROM USER_ROLE_ASSIGNMENTS UR

                JOIN USER_ROLES R
                    ON R.ROLE_ID =
                       UR.ROLE_ID

                JOIN USERS U
                    ON U.USER_ID =
                       UR.USER_ID

                WHERE UR.USER_ID =
                      :userId

                  AND R.IS_ACTIVE = 'Y'

                  AND U.IS_ACTIVE = 'Y'

                ORDER BY R.ROLE_ID
                `,
                {
                    userId:
                        decoded.userId
                }
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
            the first active role is used.

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

            const roleId = row[0];
            const roleName = row[1];

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

    } finally {

        if (connection) {

            try {

                await connection.close();

            } catch (error) {

                console.error(
                    '❌ Error closing authentication connection:',
                    error.message
                );

            }

        }

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

