const { getConnection } = require('../config/database');


// ============================================================
// GET MY PREFERENCES
// ============================================================

async function getMyPreferences(req, res) {

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

        connection = await getConnection();

        // ----------------------------------------------------
        // Get general preferences
        // ----------------------------------------------------

        const preferencesResult =
            await connection.execute(
                `
                SELECT
                    PREFERENCE_ID,
                    PREFERENCE_TYPE,
                    PREFERENCE_VALUE,
                    CREATED_AT,
                    UPDATED_AT

                FROM USER_PREFERENCES

                WHERE USER_ID = :userId

                ORDER BY
                    PREFERENCE_TYPE,
                    PREFERENCE_VALUE
                `,
                {
                    userId
                }
            );

        // ----------------------------------------------------
        // Get notification preferences
        // ----------------------------------------------------

        const notificationResult =
            await connection.execute(
                `
                SELECT
                    NOTIFICATION_PREFERENCE_ID,
                    BOOKING_REMINDERS,
                    BOOKING_CONFIRMATIONS,
                    MOVIE_RELEASES,
                    PROMOTIONS,
                    NEW_MOVIES,
                    CREATED_AT,
                    UPDATED_AT

                FROM USER_NOTIFICATION_PREFERENCES

                WHERE USER_ID = :userId
                `,
                {
                    userId
                }
            );

        // ----------------------------------------------------
        // Format general preferences
        // ----------------------------------------------------

        const preferences = {};

        for (const row of preferencesResult.rows) {

            const type = row[1];
            const value = row[2];

            if (!preferences[type]) {
                preferences[type] = [];
            }

            preferences[type].push(value);
        }

        // ----------------------------------------------------
        // Format notification preferences
        // ----------------------------------------------------

        let notifications = null;

        if (notificationResult.rows.length > 0) {

            const row =
                notificationResult.rows[0];

            notifications = {

                preferenceId: row[0],

                bookingReminders:
                    row[1] === 'Y',

                bookingConfirmations:
                    row[2] === 'Y',

                movieReleases:
                    row[3] === 'Y',

                promotions:
                    row[4] === 'Y',

                newMovies:
                    row[5] === 'Y',

                createdAt:
                    row[6],

                updatedAt:
                    row[7]
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
// UPDATE MY PREFERENCES
// ============================================================

async function updateMyPreferences(req, res) {

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

        for (const group of preferenceGroups) {

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

        connection = await getConnection();

        // ----------------------------------------------------
        // Start transaction
        // ----------------------------------------------------

        await connection.execute(
            `SAVEPOINT PREFERENCES_START`
        );

        // ----------------------------------------------------
        // Delete existing preferences
        // ----------------------------------------------------

        await connection.execute(
            `
            DELETE FROM USER_PREFERENCES
            WHERE USER_ID = :userId
            `,
            {
                userId
            }
        );

        // ----------------------------------------------------
        // Insert new preferences
        // ----------------------------------------------------

        for (const group of preferenceGroups) {

            if (
                !group.values ||
                group.values.length === 0
            ) {
                continue;
            }

            const uniqueValues =
                [
                    ...new Set(
                        group.values.map(
                            value => String(value).trim()
                        )
                    )
                ];

            for (const value of uniqueValues) {

                if (!value) {
                    continue;
                }

                await connection.execute(
                    `
                    INSERT INTO USER_PREFERENCES (
                        USER_ID,
                        PREFERENCE_TYPE,
                        PREFERENCE_VALUE
                    )
                    VALUES (
                        :userId,
                        :preferenceType,
                        :preferenceValue
                    )
                    `,
                    {
                        userId,

                        preferenceType:
                            group.type,

                        preferenceValue:
                            value
                    }
                );

            }

        }

        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await connection.commit();

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
                'Server error updating preferences',

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
// UPDATE NOTIFICATION PREFERENCES
// ============================================================

async function updateNotificationPreferences(req, res) {

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

        connection = await getConnection();

        // ----------------------------------------------------
        // Check existing preferences
        // ----------------------------------------------------

        const existing =
            await connection.execute(
                `
                SELECT
                    NOTIFICATION_PREFERENCE_ID

                FROM USER_NOTIFICATION_PREFERENCES

                WHERE USER_ID = :userId
                `,
                {
                    userId
                }
            );

        // ----------------------------------------------------
        // Create if missing
        // ----------------------------------------------------

        if (existing.rows.length === 0) {

            await connection.execute(
                `
                INSERT INTO USER_NOTIFICATION_PREFERENCES (
                    USER_ID
                )
                VALUES (
                    :userId
                )
                `,
                {
                    userId
                }
            );

        }

        // ----------------------------------------------------
        // Build dynamic update
        // ----------------------------------------------------

        const updates = [];
        const binds = {
            userId
        };

        if (bookingReminders !== undefined) {

            updates.push(
                `BOOKING_REMINDERS = :bookingReminders`
            );

            binds.bookingReminders =
                bookingReminders ? 'Y' : 'N';
        }

        if (bookingConfirmations !== undefined) {

            updates.push(
                `BOOKING_CONFIRMATIONS = :bookingConfirmations`
            );

            binds.bookingConfirmations =
                bookingConfirmations ? 'Y' : 'N';
        }

        if (movieReleases !== undefined) {

            updates.push(
                `MOVIE_RELEASES = :movieReleases`
            );

            binds.movieReleases =
                movieReleases ? 'Y' : 'N';
        }

        if (promotions !== undefined) {

            updates.push(
                `PROMOTIONS = :promotions`
            );

            binds.promotions =
                promotions ? 'Y' : 'N';
        }

        if (newMovies !== undefined) {

            updates.push(
                `NEW_MOVIES = :newMovies`
            );

            binds.newMovies =
                newMovies ? 'Y' : 'N';
        }

        // ----------------------------------------------------
        // Nothing to update
        // ----------------------------------------------------

        if (updates.length === 0) {

            return res.status(400).json({

                success: false,

                message:
                    'No notification preferences provided'

            });

        }

        // ----------------------------------------------------
        // Update
        // ----------------------------------------------------

        updates.push(
            `UPDATED_AT = CURRENT_TIMESTAMP`
        );

        await connection.execute(
            `
            UPDATE USER_NOTIFICATION_PREFERENCES

            SET
                ${updates.join(', ')}

            WHERE USER_ID = :userId
            `,
            binds
        );

        await connection.commit();

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
                'Server error updating notification preferences',

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


module.exports = {
    getMyPreferences,
    updateMyPreferences,
    updateNotificationPreferences
};