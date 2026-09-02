const pool = require('../config/database');


/**
 * Restrict access to users who have at least one
 * of the specified roles.
 *
 * Examples:
 *
 * authorize('ADMIN')
 *
 * authorize('ADMIN', 'STAFF')
 *
 * authorize('CUSTOMER', 'STAFF', 'ADMIN')
 */
function authorize(...allowedRoles) {

    return async (req, res, next) => {

        try {

            // ========================================================
            // AUTHENTICATION CHECK
            // ========================================================

            // authenticateToken must run before authorize()
            if (!req.user || !req.user.userId) {

                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });

            }


            // ========================================================
            // VALIDATE ALLOWED ROLES
            // ========================================================

            if (!allowedRoles || allowedRoles.length === 0) {

                console.error(
                    'Authorization middleware called without allowed roles'
                );

                return res.status(500).json({
                    success: false,
                    message: 'Authorization configuration error'
                });

            }


            // ========================================================
            // GET USER ROLES
            // ========================================================

            const result = await pool.query(
                `
                SELECT
                    r.role_name

                FROM user_role_assignments ura

                INNER JOIN user_roles r
                    ON r.role_id = ura.role_id

                WHERE ura.user_id = $1

                  AND r.is_active = 'Y'
                `,
                [req.user.userId]
            );


            // ========================================================
            // NORMALIZE USER ROLES
            // ========================================================

            const userRoles = result.rows.map(
                row => String(row.role_name).toUpperCase()
            );


            // ========================================================
            // NORMALIZE ALLOWED ROLES
            // ========================================================

            const normalizedAllowedRoles =
                allowedRoles.map(
                    role => String(role).toUpperCase()
                );


            // ========================================================
            // CHECK AUTHORIZATION
            // ========================================================

            const hasPermission = userRoles.some(
                role => normalizedAllowedRoles.includes(role)
            );


            // ========================================================
            // DENY ACCESS
            // ========================================================

            if (!hasPermission) {

                console.warn(
                    `⚠️ Authorization denied for user ${req.user.userId}. ` +
                    `User roles: [${userRoles.join(', ')}]. ` +
                    `Required: [${normalizedAllowedRoles.join(', ')}]`
                );

                return res.status(403).json({
                    success: false,
                    message:
                        'You are not authorized to perform this action'
                });

            }


            // ========================================================
            // ATTACH ROLES TO REQUEST
            // ========================================================

            req.user.roles = userRoles;

            console.log(
                `✅ Authorization successful for user ${req.user.userId}. ` +
                `Roles: [${userRoles.join(', ')}]`
            );


            // ========================================================
            // CONTINUE REQUEST
            // ========================================================

            next();

        } catch (error) {

            console.error(
                '❌ Authorization error:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    'Server error checking authorization'
            });

        }
    };
}


module.exports = authorize;
