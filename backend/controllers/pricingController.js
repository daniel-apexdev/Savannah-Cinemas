const { getConnection } = require('../config/database');


// ============================================================
// GET ALL ACTIVE PRICES
// ============================================================

async function getPrices(req, res) {

    let connection;

    try {

        connection = await getConnection();

        const {
            cinemaId,
            ticketType,
            dayType
        } = req.query;

        let sql = `
            SELECT
                PRICE_ID,
                CINEMA_ID,
                SCREEN_ID,
                PRICE_NAME,
                TICKET_TYPE,
                AMOUNT,
                CURRENCY,
                DAY_TYPE,
                START_TIME,
                END_TIME,
                IS_ACTIVE,
                CREATED_AT,
                UPDATED_AT

            FROM TICKET_PRICES

            WHERE IS_ACTIVE = 'Y'
        `;

        const binds = {};

        if (cinemaId) {

            sql += `
                AND CINEMA_ID = :cinemaId
            `;

            binds.cinemaId =
                Number(cinemaId);
        }

        if (ticketType) {

            sql += `
                AND TICKET_TYPE = :ticketType
            `;

            binds.ticketType =
                ticketType.toUpperCase();
        }

        if (dayType) {

            sql += `
                AND DAY_TYPE = :dayType
            `;

            binds.dayType =
                dayType.toUpperCase();
        }

        sql += `
            ORDER BY
                CINEMA_ID,
                TICKET_TYPE,
                DAY_TYPE,
                AMOUNT
        `;

        const result =
            await connection.execute(
                sql,
                binds
            );

        const prices =
            result.rows.map(row => ({

                priceId: row[0],

                cinemaId: row[1],

                screenId: row[2],

                priceName: row[3],

                ticketType: row[4],

                amount: row[5],

                currency: row[6],

                dayType: row[7],

                startTime: row[8],

                endTime: row[9],

                isActive: row[10],

                createdAt: row[11],

                updatedAt: row[12]

            }));

        return res.json({

            success: true,

            count:
                prices.length,

            prices

        });

    } catch (error) {

        console.error(
            '❌ Get prices error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching prices',

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
// GET PRICE BY ID
// ============================================================

async function getPriceById(req, res) {

    let connection;

    try {

        const priceId =
            Number(req.params.priceId);

        if (!Number.isInteger(priceId)) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid price ID'

            });

        }

        connection =
            await getConnection();

        const result =
            await connection.execute(
                `
                SELECT
                    PRICE_ID,
                    CINEMA_ID,
                    SCREEN_ID,
                    PRICE_NAME,
                    TICKET_TYPE,
                    AMOUNT,
                    CURRENCY,
                    DAY_TYPE,
                    START_TIME,
                    END_TIME,
                    IS_ACTIVE,
                    CREATED_AT,
                    UPDATED_AT

                FROM TICKET_PRICES

                WHERE PRICE_ID =
                      :priceId
                `,
                {
                    priceId
                }
            );

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Price not found'

            });

        }

        const row =
            result.rows[0];

        return res.json({

            success: true,

            price: {

                priceId: row[0],

                cinemaId: row[1],

                screenId: row[2],

                priceName: row[3],

                ticketType: row[4],

                amount: row[5],

                currency: row[6],

                dayType: row[7],

                startTime: row[8],

                endTime: row[9],

                isActive: row[10],

                createdAt: row[11],

                updatedAt: row[12]

            }

        });

    } catch (error) {

        console.error(
            '❌ Get price error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching price',

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
// GET PRICES FOR SHOWTIME
// ============================================================

async function getShowtimePricing(req, res) {

    let connection;

    try {

        const showtimeId =
            Number(req.params.showtimeId);

        if (!Number.isInteger(showtimeId)) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid showtime ID'

            });

        }

        connection =
            await getConnection();

        // ----------------------------------------------------
        // Get showtime
        // ----------------------------------------------------

        const showtimeResult =
            await connection.execute(
                `
                SELECT

                    SHOWTIME_ID,
                    CINEMA_ID,
                    SCREEN_ID,
                    SHOW_DATE,
                    START_TIME,
                    STATUS,
                    IS_ACTIVE

                FROM SHOWTIMES

                WHERE SHOWTIME_ID =
                      :showtimeId
                `,
                {
                    showtimeId
                }
            );

        if (showtimeResult.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Showtime not found'

            });

        }

        const showtime =
            showtimeResult.rows[0];

        const cinemaId =
            showtime[1];

        const screenId =
            showtime[2];

        const showDate =
            showtime[3];

        const startTime =
            showtime[4];

        // ----------------------------------------------------
        // Determine day type
        // ----------------------------------------------------

        const dayResult =
            await connection.execute(
                `
                SELECT

                    CASE

                        WHEN TO_CHAR(
                            :showDate,
                            'DY',
                            'NLS_DATE_LANGUAGE=ENGLISH'
                        ) IN ('SAT', 'SUN')

                        THEN 'WEEKEND'

                        ELSE 'WEEKDAY'

                    END AS DAY_TYPE

                FROM DUAL
                `,
                {
                    showDate
                }
            );

        const dayType =
            dayResult.rows[0][0];

        // ----------------------------------------------------
        // Find applicable prices
        // ----------------------------------------------------

        const priceResult =
            await connection.execute(
                `
                SELECT

                    PRICE_ID,
                    PRICE_NAME,
                    TICKET_TYPE,
                    AMOUNT,
                    CURRENCY,
                    DAY_TYPE,
                    START_TIME,
                    END_TIME

                FROM TICKET_PRICES

                WHERE CINEMA_ID =
                      :cinemaId

                  AND IS_ACTIVE =
                      'Y'

                  AND (
                        SCREEN_ID IS NULL
                        OR SCREEN_ID = :screenId
                  )

                  AND (
                        DAY_TYPE IS NULL
                        OR DAY_TYPE = :dayType
                  )

                  AND (
                        START_TIME IS NULL

                        OR
                        CAST(:startTime AS TIMESTAMP)
                        >= START_TIME
                  )

                  AND (
                        END_TIME IS NULL

                        OR
                        CAST(:startTime AS TIMESTAMP)
                        <= END_TIME
                  )

                ORDER BY

                    TICKET_TYPE,

                    CASE
                        WHEN SCREEN_ID = :screenId
                        THEN 1
                        ELSE 2
                    END,

                    CASE
                        WHEN DAY_TYPE = :dayType
                        THEN 1
                        ELSE 2
                    END

                `,
                {
                    cinemaId,

                    screenId,

                    dayType,

                    startTime
                }
            );

        // ----------------------------------------------------
        // Remove duplicate ticket types
        // ----------------------------------------------------

        const priceMap =
            new Map();

        for (
            const row
            of priceResult.rows
        ) {

            const ticketType =
                row[2];

            if (
                !priceMap.has(ticketType)
            ) {

                priceMap.set(
                    ticketType,
                    {

                        priceId:
                            row[0],

                        priceName:
                            row[1],

                        ticketType:
                            row[2],

                        amount:
                            row[3],

                        currency:
                            row[4],

                        dayType:
                            row[5],

                        startTime:
                            row[6],

                        endTime:
                            row[7]

                    }
                );

            }

        }

        const prices =
            Array.from(
                priceMap.values()
            );

        return res.json({

            success: true,

            showtime: {

                showtimeId,

                cinemaId,

                screenId,

                showDate,

                startTime,

                dayType

            },

            currency:
                prices.length > 0
                    ? prices[0].currency
                    : 'GHS',

            prices

        });

    } catch (error) {

        console.error(
            '❌ Get showtime pricing error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching showtime pricing',

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

    getPrices,
    getPriceById,
    getShowtimePricing

};