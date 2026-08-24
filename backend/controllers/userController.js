const { getConnection } = require('../config/database');

const bcrypt = require('bcryptjs');
// ============================================================
// GET MY PROFILE
// ============================================================

async function getMyProfile(req, res) {

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
        // Database connection
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // Get user profile
        // ----------------------------------------------------

        const result = await connection.execute(
            `
            SELECT
                USER_ID,
                EMAIL,
                FORENAMES,
                SURNAME,
                PHONE_NUMBER,
                IS_ACTIVE,
                CREATED_AT,
                UPDATED_AT

            FROM USERS

            WHERE USER_ID = :userId
            `,
            {
                userId
            }
        );

        // ----------------------------------------------------
        // User not found
        // ----------------------------------------------------

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'User account not found'
            });

        }

        const row = result.rows[0];

        /*
            PROFILE SELECT INDEXES

            0  USER_ID
            1  EMAIL
            2  FORENAMES
            3  SURNAME
            4  PHONE_NUMBER
            5  IS_ACTIVE
            6  CREATED_AT
            7  UPDATED_AT
        */

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            user: {

                userId: row[0],

                email: row[1],

                forenames: row[2],

                surname: row[3],

                phoneNumber: row[4],

                isActive: row[5],

                createdAt: row[6],

                updatedAt: row[7]

            }

        });

    } catch (error) {

        console.error(
            '❌ Get my profile error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching profile',

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
// UPDATE MY PROFILE
// ============================================================

async function updateMyProfile(req, res) {

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
            forenames,
            surname,
            phoneNumber
        } = req.body;

        // ----------------------------------------------------
        // Make sure at least one field was supplied
        // ----------------------------------------------------

        if (
            forenames === undefined &&
            surname === undefined &&
            phoneNumber === undefined
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'At least one profile field is required'

            });

        }

        // ----------------------------------------------------
        // Validate fields
        // ----------------------------------------------------

        if (
            forenames !== undefined &&
            (
                typeof forenames !== 'string' ||
                forenames.trim().length === 0
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Forenames must be a valid value'

            });

        }

        if (
            surname !== undefined &&
            (
                typeof surname !== 'string' ||
                surname.trim().length === 0
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Surname must be a valid value'

            });

        }

        if (
            phoneNumber !== undefined &&
            phoneNumber !== null &&
            typeof phoneNumber !== 'string'
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Phone number must be a valid value'

            });

        }

        // ----------------------------------------------------
        // Database connection
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // Check user exists
        // ----------------------------------------------------

        const userResult = await connection.execute(
            `
            SELECT
                USER_ID,
                IS_ACTIVE

            FROM USERS

            WHERE USER_ID = :userId
            `,
            {
                userId
            }
        );

        if (userResult.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'User account not found'

            });

        }

        // ----------------------------------------------------
        // Make sure account is active
        // ----------------------------------------------------

        if (userResult.rows[0][1] !== 'Y') {

            return res.status(403).json({

                success: false,

                message:
                    'This user account is inactive'

            });

        }

        // ----------------------------------------------------
        // Update profile
        //
        // NVL keeps existing values when a field
        // was not supplied.
        // ----------------------------------------------------

        await connection.execute(
            `
            UPDATE USERS

            SET

                FORENAMES =
                    NVL(
                        :forenames,
                        FORENAMES
                    ),

                SURNAME =
                    NVL(
                        :surname,
                        SURNAME
                    ),

                PHONE_NUMBER =
                    CASE

                        WHEN :phoneNumberProvided = 1
                        THEN :phoneNumber

                        ELSE PHONE_NUMBER

                    END,

                UPDATED_AT =
                    CURRENT_TIMESTAMP

            WHERE USER_ID = :userId
            `,
            {
                userId,

                forenames:
                    forenames !== undefined
                        ? forenames.trim()
                        : null,

                surname:
                    surname !== undefined
                        ? surname.trim()
                        : null,

                phoneNumber:
                    phoneNumber !== undefined
                        ? (
                            phoneNumber === null
                                ? null
                                : phoneNumber.trim()
                        )
                        : null,

                phoneNumberProvided:
                    phoneNumber !== undefined
                        ? 1
                        : 0
            }
        );

        await connection.commit();

        // ----------------------------------------------------
        // Get updated profile
        // ----------------------------------------------------

        const updatedResult =
            await connection.execute(
                `
                SELECT
                    USER_ID,
                    EMAIL,
                    FORENAMES,
                    SURNAME,
                    PHONE_NUMBER,
                    IS_ACTIVE,
                    CREATED_AT,
                    UPDATED_AT

                FROM USERS

                WHERE USER_ID = :userId
                `,
                {
                    userId
                }
            );

        const row =
            updatedResult.rows[0];

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            message:
                'Profile updated successfully',

            user: {

                userId: row[0],

                email: row[1],

                forenames: row[2],

                surname: row[3],

                phoneNumber: row[4],

                isActive: row[5],

                createdAt: row[6],

                updatedAt: row[7]

            }

        });

    } catch (error) {

        console.error(
            '❌ Update my profile error:',
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
                'Server error updating profile',

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
// CHANGE MY PASSWORD
// ============================================================

async function changeMyPassword(req, res) {

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
            currentPassword,
            newPassword
        } = req.body;

        if (!currentPassword || !newPassword) {

            return res.status(400).json({
                success: false,
                message:
                    'Current password and new password are required'
            });

        }

        // ----------------------------------------------------
        // Validate new password
        // ----------------------------------------------------

        if (typeof newPassword !== 'string') {

            return res.status(400).json({
                success: false,
                message: 'New password must be a valid value'
            });

        }

        if (newPassword.length < 8) {

            return res.status(400).json({
                success: false,
                message:
                    'New password must be at least 8 characters long'
            });

        }

        // ----------------------------------------------------
        // Database connection
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // Get current password hash
        // ----------------------------------------------------

        const result = await connection.execute(
            `
            SELECT
                PASSWORD_HASH,
                IS_ACTIVE

            FROM USERS

            WHERE USER_ID = :userId
            `,
            {
                userId
            }
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'User account not found'
            });

        }

        const passwordHash = result.rows[0][0];
        const isActive = result.rows[0][1];

        // ----------------------------------------------------
        // Check account status
        // ----------------------------------------------------

        if (isActive !== 'Y') {

            return res.status(403).json({
                success: false,
                message: 'This user account is inactive'
            });

        }

        // ----------------------------------------------------
        // Verify current password
        //
        // IMPORTANT:
        // Use the same bcrypt library your login system uses.
        // ----------------------------------------------------

        const passwordMatch =
            await bcrypt.compare(
                currentPassword,
                passwordHash
            );

        if (!passwordMatch) {

            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });

        }

        // ----------------------------------------------------
        // Make sure new password is different
        // ----------------------------------------------------

        const samePassword =
            await bcrypt.compare(
                newPassword,
                passwordHash
            );

        if (samePassword) {

            return res.status(400).json({
                success: false,
                message:
                    'New password must be different from your current password'
            });

        }

        // ----------------------------------------------------
        // Hash new password
        // ----------------------------------------------------

        const newPasswordHash =
            await bcrypt.hash(
                newPassword,
                12
            );

        // ----------------------------------------------------
        // Update password
        // ----------------------------------------------------

        await connection.execute(
            `
            UPDATE USERS

            SET
                PASSWORD_HASH = :passwordHash,
                UPDATED_AT = CURRENT_TIMESTAMP

            WHERE USER_ID = :userId
            `,
            {
                passwordHash: newPasswordHash,
                userId
            }
        );

        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await connection.commit();

        console.log(
            `🔐 Password changed successfully | User: ${userId}`
        );

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            message:
                'Password changed successfully'

        });

    } catch (error) {

        console.error(
            '❌ Change password error:',
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
                'Server error changing password',

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
// EXPORT
// ============================================================

module.exports = {
    getMyProfile,
    updateMyProfile,
    changeMyPassword
};