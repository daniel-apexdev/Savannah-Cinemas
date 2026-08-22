const { getConnection } = require('../config/database');

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

        let connection;

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
            // DATABASE CONNECTION
            // ========================================================

            connection = await getConnection();

            // ========================================================
            // GET USER ROLES
            // ========================================================

            const result = await connection.execute(
                `
                SELECT
                    r.ROLE_NAME
                FROM USER_ROLE_ASSIGNMENTS ura
                INNER JOIN USER_ROLES r
                    ON r.ROLE_ID = ura.ROLE_ID
                WHERE ura.USER_ID = :userId
                `,
                {
                    userId: req.user.userId
                }
            );

            const userRoles = result.rows.map(
                row => String(row[0]).toUpperCase()
            );

            // ========================================================
            // CHECK AUTHORIZATION
            // ========================================================

            const normalizedAllowedRoles =
                allowedRoles.map(
                    role => String(role).toUpperCase()
                );

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
                    message: 'You are not authorized to perform this action'
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

            next();

        } catch (error) {

            console.error(
                '❌ Authorization error:',
                error
            );

            return res.status(500).json({
                success: false,
                message: 'Server error checking authorization'
            });

        } finally {

            if (connection) {

                try {
                    await connection.close();
                } catch (error) {

                    console.error(
                        '❌ Error closing authorization connection:',
                        error.message
                    );

                }
            }
        }
    };
}

module.exports = authorize;