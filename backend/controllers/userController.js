const pool = require('../config/database');
const bcrypt = require('bcryptjs');


// ============================================================
// GET MY PROFILE
// ============================================================

async function getMyProfile(req, res) {

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
        // Get user profile
        // ----------------------------------------------------

        const result = await pool.query(
            `
            SELECT
                user_id,
                email,
                forenames,
                surname,
                phone_number,
                is_active,
                created_at,
                updated_at

            FROM users

            WHERE user_id = $1
            `,
            [userId]
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


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            user: {

                userId:
                    row.user_id,

                email:
                    row.email,

                forenames:
                    row.forenames,

                surname:
                    row.surname,

                phoneNumber:
                    row.phone_number,

                isActive:
                    row.is_active,

                createdAt:
                    row.created_at,

                updatedAt:
                    row.updated_at

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

    }

}


// ============================================================
// UPDATE MY PROFILE
// ============================================================

async function updateMyProfile(req, res) {

    let client;

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
        // Get PostgreSQL client
        // ----------------------------------------------------

        client = await pool.connect();

        await client.query('BEGIN');


        // ----------------------------------------------------
        // Check user exists
        // ----------------------------------------------------

        const userResult = await client.query(
            `
            SELECT
                user_id,
                is_active

            FROM users

            WHERE user_id = $1
            `,
            [userId]
        );


        if (userResult.rows.length === 0) {

            await client.query('ROLLBACK');

            return res.status(404).json({

                success: false,

                message:
                    'User account not found'

            });

        }


        // ----------------------------------------------------
        // Make sure account is active
        // ----------------------------------------------------

        if (userResult.rows[0].is_active !== 'Y') {

            await client.query('ROLLBACK');

            return res.status(403).json({

                success: false,

                message:
                    'This user account is inactive'

            });

        }


        // ----------------------------------------------------
        // Prepare values
        // ----------------------------------------------------

        const forenamesValue =
            forenames !== undefined
                ? forenames.trim()
                : null;

        const surnameValue =
            surname !== undefined
                ? surname.trim()
                : null;

        const phoneNumberValue =
            phoneNumber !== undefined
                ? (
                    phoneNumber === null
                        ? null
                        : phoneNumber.trim()
                )
                : null;

        const phoneNumberProvided =
            phoneNumber !== undefined;


        // ----------------------------------------------------
        // Update profile
        //
        // PostgreSQL equivalent of Oracle NVL logic.
        //
        // Forenames/surname:
        //   supplied  -> update
        //   omitted   -> keep existing value
        //
        // Phone:
        //   supplied string -> update
        //   supplied null   -> clear value
        //   omitted          -> keep existing value
        // ----------------------------------------------------

        await client.query(
            `
            UPDATE users

            SET

                forenames =
                    CASE
                        WHEN $1::boolean
                        THEN $2
                        ELSE forenames
                    END,

                surname =
                    CASE
                        WHEN $3::boolean
                        THEN $4
                        ELSE surname
                    END,

                phone_number =
                    CASE
                        WHEN $5::boolean
                        THEN $6
                        ELSE phone_number
                    END,

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE user_id = $7
            `,
            [
                forenames !== undefined,
                forenamesValue,

                surname !== undefined,
                surnameValue,

                phoneNumberProvided,
                phoneNumberValue,

                userId
            ]
        );


        // ----------------------------------------------------
        // Get updated profile
        // ----------------------------------------------------

        const updatedResult = await client.query(
            `
            SELECT
                user_id,
                email,
                forenames,
                surname,
                phone_number,
                is_active,
                created_at,
                updated_at

            FROM users

            WHERE user_id = $1
            `,
            [userId]
        );


        const row =
            updatedResult.rows[0];


        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await client.query('COMMIT');


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            message:
                'Profile updated successfully',

            user: {

                userId:
                    row.user_id,

                email:
                    row.email,

                forenames:
                    row.forenames,

                surname:
                    row.surname,

                phoneNumber:
                    row.phone_number,

                isActive:
                    row.is_active,

                createdAt:
                    row.created_at,

                updatedAt:
                    row.updated_at

            }

        });

    } catch (error) {

        console.error(
            '❌ Update my profile error:',
            error
        );

        if (client) {

            try {

                await client.query('ROLLBACK');

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

        if (client) {

            client.release();

        }

    }

}


// ============================================================
// CHANGE MY PASSWORD
// ============================================================

async function changeMyPassword(req, res) {

    let client;

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

                message:
                    'New password must be a valid value'

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
        // Get PostgreSQL client
        // ----------------------------------------------------

        client = await pool.connect();

        await client.query('BEGIN');


        // ----------------------------------------------------
        // Get current password hash
        // ----------------------------------------------------

        const result = await client.query(
            `
            SELECT
                password_hash,
                is_active

            FROM users

            WHERE user_id = $1
            `,
            [userId]
        );


        // ----------------------------------------------------
        // User not found
        // ----------------------------------------------------

        if (result.rows.length === 0) {

            await client.query('ROLLBACK');

            return res.status(404).json({

                success: false,

                message:
                    'User account not found'

            });

        }


        const passwordHash =
            result.rows[0].password_hash;

        const isActive =
            result.rows[0].is_active;


        // ----------------------------------------------------
        // Check account status
        // ----------------------------------------------------

        if (isActive !== 'Y') {

            await client.query('ROLLBACK');

            return res.status(403).json({

                success: false,

                message:
                    'This user account is inactive'

            });

        }


        // ----------------------------------------------------
        // Verify current password
        // ----------------------------------------------------

        const passwordMatch =
            await bcrypt.compare(
                currentPassword,
                passwordHash
            );


        if (!passwordMatch) {

            await client.query('ROLLBACK');

            return res.status(401).json({

                success: false,

                message:
                    'Current password is incorrect'

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

            await client.query('ROLLBACK');

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

        await client.query(
            `
            UPDATE users

            SET
                password_hash = $1,
                updated_at = CURRENT_TIMESTAMP

            WHERE user_id = $2
            `,
            [
                newPasswordHash,
                userId
            ]
        );


        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await client.query('COMMIT');


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

        if (client) {

            try {

                await client.query('ROLLBACK');

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

        if (client) {

            client.release();

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