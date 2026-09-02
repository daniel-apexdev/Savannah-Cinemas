const pool = require('../config/database');


// ============================================================
// GET MY PREFERENCES
// ============================================================

async function getMyPreferences(req, res) {

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
        // Get general preferences
        // ----------------------------------------------------

        const preferencesResult =
            await pool.query(
                `
                SELECT
                    preference_id,
                    preference_type,
                    preference_value,
                    created_at,
                    updated_at

                FROM user_preferences

                WHERE user_id = $1

                ORDER BY
                    preference_type,
                    preference_value
                `,
                [userId]
            );

        // ----------------------------------------------------
        // Get notification preferences
        // ----------------------------------------------------

        const notificationResult =
            await pool.query(
                `
                SELECT
                    notification_preference_id,
                    booking_reminders,
                    booking_confirmations,
                    movie_releases,
                    promotions,
                    new_movies,
                    created_at,
                    updated_at

                FROM user_notification_preferences

                WHERE user_id = $1
                `,
                [userId]
            );

        // ----------------------------------------------------
        // Format general preferences
        // ----------------------------------------------------

        const preferences = {};

        for (
            const row
            of preferencesResult.rows
        ) {

            const type =
                row.preference_type;

            const value =
                row.preference_value;

            if (!preferences[type]) {
                preferences[type] = [];
            }

            preferences[type].push(value);

        }

        // ----------------------------------------------------
        // Format notification preferences
        // ----------------------------------------------------

        let notifications = null;

        if (
            notificationResult.rows.length > 0
        ) {

            const row =
                notificationResult.rows[0];

            notifications = {

                preferenceId:
                    row.notification_preference_id,

                bookingReminders:
                    row.booking_reminders === 'Y',

                bookingConfirmations:
                    row.booking_confirmations === 'Y',

                movieReleases:
                    row.movie_releases === 'Y',

                promotions:
                    row.promotions === 'Y',

                newMovies:
                    row.new_movies === 'Y',

                createdAt:
                    row.created_at,

                updatedAt:
                    row.updated_at

            };

        }

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            preferences,

            notifications

        });

    } catch (error) {

        console.error(
            '❌ Get preferences error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching preferences',

            error:
                error.message

        });

    }

}


// ============================================================
// UPDATE MY PREFERENCES
// ============================================================

async function updateMyPreferences(req, res) {

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
            genres,
            languages,
            ageRatings,
            cinemas
        } = req.body;

        // ----------------------------------------------------
        // Validate arrays
        // ----------------------------------------------------

        const preferenceGroups = [

            {
                type: 'GENRE',
                values: genres
            },

            {
                type: 'LANGUAGE',
                values: languages
            },

            {
                type: 'AGE_RATING',
                values: ageRatings
            },

            {
                type: 'CINEMA',
                values: cinemas
            }

        ];

        for (
            const group
            of preferenceGroups
        ) {

            if (
                group.values !== undefined &&
                !Array.isArray(group.values)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `${group.type} preferences must be an array`

                });

            }

        }

        // ----------------------------------------------------
        // Get PostgreSQL client
        // ----------------------------------------------------

        client = await pool.connect();

        // ----------------------------------------------------
        // Start transaction
        // ----------------------------------------------------

        await client.query('BEGIN');

        // ----------------------------------------------------
        // Delete existing preferences
        // ----------------------------------------------------

        await client.query(
            `
            DELETE FROM user_preferences
            WHERE user_id = $1
            `,
            [userId]
        );

        // ----------------------------------------------------
        // Insert new preferences
        // ----------------------------------------------------

        for (
            const group
            of preferenceGroups
        ) {

            if (
                !group.values ||
                group.values.length === 0
            ) {

                continue;

            }

            // ------------------------------------------------
            // Remove duplicate values
            // ------------------------------------------------

            const uniqueValues =
                [
                    ...new Set(
                        group.values.map(
                            value =>
                                String(value).trim()
                        )
                    )
                ];

            // ------------------------------------------------
            // Insert each preference
            // ------------------------------------------------

            for (
                const value
                of uniqueValues
            ) {

                if (!value) {
                    continue;
                }

                await client.query(
                    `
                    INSERT INTO user_preferences (
                        user_id,
                        preference_type,
                        preference_value
                    )

                    VALUES (
                        $1,
                        $2,
                        $3
                    )
                    `,
                    [
                        userId,
                        group.type,
                        value
                    ]
                );

            }

        }

        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await client.query('COMMIT');

        console.log(
            `✅ Preferences updated | User: ${userId}`
        );

        return res.json({

            success: true,

            message:
                'Preferences updated successfully'

        });

    } catch (error) {

        console.error(
            '❌ Update preferences error:',
            error
        );

        // ----------------------------------------------------
        // Rollback
        // ----------------------------------------------------

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
                'Server error updating preferences',

            error:
                error.message

        });

    } finally {

        // ----------------------------------------------------
        // Release client
        // ----------------------------------------------------

        if (client) {

            client.release();

        }

    }

}


// ============================================================
// UPDATE NOTIFICATION PREFERENCES
// ============================================================

async function updateNotificationPreferences(req, res) {

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

        const {
            bookingReminders,
            bookingConfirmations,
            movieReleases,
            promotions,
            newMovies
        } = req.body;

        // ----------------------------------------------------
        // Validate values
        // ----------------------------------------------------

        const settings = {

            bookingReminders,

            bookingConfirmations,

            movieReleases,

            promotions,

            newMovies

        };

        for (
            const [key, value]
            of Object.entries(settings)
        ) {

            if (
                value !== undefined &&
                typeof value !== 'boolean'
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `${key} must be a boolean`

                });

            }

        }

        // ----------------------------------------------------
        // Get PostgreSQL client
        // ----------------------------------------------------

        client = await pool.connect();

        // ----------------------------------------------------
        // Start transaction
        // ----------------------------------------------------

        await client.query('BEGIN');

        // ----------------------------------------------------
        // Check existing preferences
        // ----------------------------------------------------

        const existing =
            await client.query(
                `
                SELECT
                    notification_preference_id

                FROM user_notification_preferences

                WHERE user_id = $1
                `,
                [userId]
            );

        // ----------------------------------------------------
        // Create if missing
        // ----------------------------------------------------

        if (
            existing.rows.length === 0
        ) {

            await client.query(
                `
                INSERT INTO user_notification_preferences (
                    user_id
                )

                VALUES (
                    $1
                )
                `,
                [userId]
            );

        }

        // ----------------------------------------------------
        // Build dynamic update
        // ----------------------------------------------------

        const updates = [];

        const values = [userId];

        let parameterIndex = 2;

        // ----------------------------------------------------
        // Booking reminders
        // ----------------------------------------------------

        if (
            bookingReminders !== undefined
        ) {

            updates.push(
                `booking_reminders = $${parameterIndex}`
            );

            values.push(
                bookingReminders ? 'Y' : 'N'
            );

            parameterIndex++;

        }

        // ----------------------------------------------------
        // Booking confirmations
        // ----------------------------------------------------

        if (
            bookingConfirmations !== undefined
        ) {

            updates.push(
                `booking_confirmations = $${parameterIndex}`
            );

            values.push(
                bookingConfirmations ? 'Y' : 'N'
            );

            parameterIndex++;

        }

        // ----------------------------------------------------
        // Movie releases
        // ----------------------------------------------------

        if (
            movieReleases !== undefined
        ) {

            updates.push(
                `movie_releases = $${parameterIndex}`
            );

            values.push(
                movieReleases ? 'Y' : 'N'
            );

            parameterIndex++;

        }

        // ----------------------------------------------------
        // Promotions
        // ----------------------------------------------------

        if (
            promotions !== undefined
        ) {

            updates.push(
                `promotions = $${parameterIndex}`
            );

            values.push(
                promotions ? 'Y' : 'N'
            );

            parameterIndex++;

        }

        // ----------------------------------------------------
        // New movies
        // ----------------------------------------------------

        if (
            newMovies !== undefined
        ) {

            updates.push(
                `new_movies = $${parameterIndex}`
            );

            values.push(
                newMovies ? 'Y' : 'N'
            );

            parameterIndex++;

        }

        // ----------------------------------------------------
        // Nothing to update
        // ----------------------------------------------------

        if (updates.length === 0) {

            await client.query('ROLLBACK');

            return res.status(400).json({

                success: false,

                message:
                    'No notification preferences provided'

            });

        }

        // ----------------------------------------------------
        // Updated timestamp
        // ----------------------------------------------------

        updates.push(
            `updated_at = CURRENT_TIMESTAMP`
        );

        // ----------------------------------------------------
        // Update preferences
        // ----------------------------------------------------

        await client.query(
            `
            UPDATE user_notification_preferences

            SET
                ${updates.join(', ')}

            WHERE user_id = $1
            `,
            values
        );

        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await client.query('COMMIT');

        console.log(
            `✅ Notification preferences updated | User: ${userId}`
        );

        return res.json({

            success: true,

            message:
                'Notification preferences updated successfully'

        });

    } catch (error) {

        console.error(
            '❌ Update notification preferences error:',
            error
        );

        // ----------------------------------------------------
        // Rollback
        // ----------------------------------------------------

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
                'Server error updating notification preferences',

            error:
                error.message

        });

    } finally {

        // ----------------------------------------------------
        // Release client
        // ----------------------------------------------------

        if (client) {

            client.release();

        }

    }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    getMyPreferences,
    updateMyPreferences,
    updateNotificationPreferences
};