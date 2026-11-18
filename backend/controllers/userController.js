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
            phoneNumber,
            dateOfBirth
        } = req.body;


        // ----------------------------------------------------
        // Make sure at least one field was supplied
        // ----------------------------------------------------

        if (
            forenames === undefined &&
            surname === undefined &&
            phoneNumber === undefined &&
            dateOfBirth === undefined
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


        // Date of birth: 'YYYY-MM-DD' (a real, past date) or null to clear
        if (dateOfBirth !== undefined && dateOfBirth !== null) {

            const valid =
                typeof dateOfBirth === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) &&
                !Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00Z`)) &&
                new Date(`${dateOfBirth}T00:00:00Z`).toISOString().slice(0, 10) === dateOfBirth;

            const year = valid ? Number(dateOfBirth.slice(0, 4)) : 0;

            if (!valid || dateOfBirth > new Date().toISOString().slice(0, 10) || year < 1900) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Date of birth must be a valid past date (YYYY-MM-DD)'

                });

            }

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
        // Date of birth lives on the customer profile
        // ----------------------------------------------------

        if (dateOfBirth !== undefined) {

            const profileResult = await client.query(
                `
                UPDATE customer_profiles
                SET date_of_birth = $1::date,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $2
                `,
                [dateOfBirth, userId]
            );

            if (profileResult.rowCount === 0) {

                await client.query(
                    `
                    INSERT INTO customer_profiles (user_id, date_of_birth)
                    VALUES ($1, $2::date)
                    `,
                    [userId, dateOfBirth]
                );

            }

        }


        // ----------------------------------------------------
        // Get updated profile
        // ----------------------------------------------------

        const updatedResult = await client.query(
            `
            SELECT
                u.user_id,
                u.email,
                u.forenames,
                u.surname,
                u.phone_number,
                u.is_active,
                u.created_at,
                u.updated_at,
                cp.date_of_birth::text AS date_of_birth

            FROM users u

            LEFT JOIN customer_profiles cp
                ON cp.user_id = u.user_id

            WHERE u.user_id = $1
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

                dateOfBirth:
                    row.date_of_birth,

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
// DELETE MY ACCOUNT
//
// DELETE /api/users/me   { password }
//
// App stores require in-app account deletion. Bookings, payments and
// tickets are financial records, so the user row is kept but
// anonymised and deactivated (login and tokens stop working at once);
// personal data that isn't a record of a sale is deleted.
//
// Refused while the user holds paid tickets for shows that haven't
// happened yet, so nobody deletes their way out of a ticket they'll
// need at the door. Unpaid holds are released.
// ============================================================

async function deleteMyAccount(req, res) {

    let client;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;
        const { password } = req.body || {};

        if (!password || typeof password !== 'string') {

            return res.status(400).json({
                success: false,
                message: 'Enter your password to delete your account'
            });

        }

        client = await pool.connect();

        await client.query('BEGIN');

        const userResult = await client.query(
            `
            SELECT password_hash, is_active
            FROM users
            WHERE user_id = $1
            FOR UPDATE
            `,
            [userId]
        );

        if (userResult.rows.length === 0 || userResult.rows[0].is_active !== 'Y') {

            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'User account not found'
            });

        }

        const passwordMatch = await bcrypt.compare(
            password,
            userResult.rows[0].password_hash
        );

        if (!passwordMatch) {

            await client.query('ROLLBACK');

            return res.status(401).json({
                success: false,
                message: 'Password is incorrect'
            });

        }

        // Paid tickets for shows still to come
        const upcoming = await client.query(
            `
            SELECT COUNT(*)::int AS n
            FROM bookings b
            JOIN showtimes s ON s.showtime_id = b.showtime_id
            WHERE b.user_id = $1
              AND b.status = 'CONFIRMED'
              AND s.start_time > CURRENT_TIMESTAMP
            `,
            [userId]
        );

        if (upcoming.rows[0].n > 0) {

            await client.query('ROLLBACK');

            return res.status(409).json({
                success: false,
                code: 'UPCOMING_TICKETS',
                message:
                    'You have tickets for upcoming shows. Cancel them from your tickets first, or delete your account after they have played.'
            });

        }

        // Release unpaid holds (their snack orders follow the booking)
        await client.query(
            `
            UPDATE bookings
            SET status = 'CANCELLED'
            WHERE user_id = $1
              AND status = 'PENDING'
            `,
            [userId]
        );

        await client.query('SAVEPOINT snacks');

        try {

            await client.query(
                `
                UPDATE concession_orders
                SET status = 'CANCELLED'
                WHERE user_id = $1
                  AND status = 'PENDING'
                `,
                [userId]
            );
            await client.query('RELEASE SAVEPOINT snacks');

        } catch (error) {

            // Concessions migration not installed
            if (error.code !== '42P01') throw error;
            await client.query('ROLLBACK TO SAVEPOINT snacks');

        }

        // Personal data that isn't a sales record
        for (const table of [
            'watchlist',
            'user_favourites',
            'user_cinema_favorites',
            'user_movie_views',
            'user_preferences',
            'user_notification_preferences',
            'movie_reviews'
        ]) {

            await client.query('SAVEPOINT del');

            try {

                await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
                await client.query('RELEASE SAVEPOINT del');

            } catch (error) {

                // Table missing on this install: nothing to delete
                if (error.code !== '42P01') throw error;
                await client.query('ROLLBACK TO SAVEPOINT del');

            }

        }

        await client.query(
            `
            UPDATE customer_profiles
            SET date_of_birth = NULL,
                gender = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            `,
            [userId]
        );

        // Anonymise and lock the account. The random hash means the
        // old password can never sign in again.
        const lockedHash = await bcrypt.hash(
            require('crypto').randomBytes(32).toString('hex'),
            10
        );

        await client.query(
            `
            UPDATE users
            SET email = 'deleted-' || user_id || '@deleted.invalid',
                forenames = 'Deleted',
                surname = 'User',
                phone_number = NULL,
                password_hash = $2,
                is_active = 'N',
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            `,
            [userId, lockedHash]
        );

        await client.query('COMMIT');

        console.log(`🗑️ Account deleted (anonymised) | User: ${userId}`);

        return res.json({
            success: true,
            message: 'Your account has been deleted'
        });

    } catch (error) {

        console.error('❌ Delete account error:', error);

        if (client) {

            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('❌ Rollback error:', rollbackError);
            }

        }

        return res.status(500).json({
            success: false,
            message: 'Server error deleting account'
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
    changeMyPassword,
    deleteMyAccount
};