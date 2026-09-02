const pool = require('../config/database');


// ============================================================
// GET ALL ACTIVE PRICES
// ============================================================

async function getPrices(req, res) {

    try {

        const {
            cinemaId,
            ticketType,
            dayType
        } = req.query;

        let sql = `
            SELECT
                price_id,
                cinema_id,
                screen_id,
                price_name,
                ticket_type,
                amount,
                currency,
                day_type,
                start_time,
                end_time,
                is_active,
                created_at,
                updated_at

            FROM ticket_prices

            WHERE is_active = 'Y'
        `;

        const params = [];

        // ----------------------------------------------------
        // Filter by cinema
        // ----------------------------------------------------

        if (cinemaId) {

            const parsedCinemaId = Number(cinemaId);

            if (!Number.isInteger(parsedCinemaId)) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Invalid cinema ID'

                });

            }

            params.push(parsedCinemaId);

            sql += `
                AND cinema_id = $${params.length}
            `;
        }

        // ----------------------------------------------------
        // Filter by ticket type
        // ----------------------------------------------------

        if (ticketType) {

            params.push(
                ticketType.toUpperCase()
            );

            sql += `
                AND ticket_type = $${params.length}
            `;
        }

        // ----------------------------------------------------
        // Filter by day type
        // ----------------------------------------------------

        if (dayType) {

            params.push(
                dayType.toUpperCase()
            );

            sql += `
                AND day_type = $${params.length}
            `;
        }

        // ----------------------------------------------------
        // Ordering
        // ----------------------------------------------------

        sql += `
            ORDER BY
                cinema_id,
                ticket_type,
                day_type,
                amount
        `;

        const result =
            await pool.query(
                sql,
                params
            );

        const prices =
            result.rows.map(row => ({

                priceId:
                    row.price_id,

                cinemaId:
                    row.cinema_id,

                screenId:
                    row.screen_id,

                priceName:
                    row.price_name,

                ticketType:
                    row.ticket_type,

                amount:
                    row.amount,

                currency:
                    row.currency,

                dayType:
                    row.day_type,

                startTime:
                    row.start_time,

                endTime:
                    row.end_time,

                isActive:
                    row.is_active,

                createdAt:
                    row.created_at,

                updatedAt:
                    row.updated_at

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

    }

}


// ============================================================
// GET PRICE BY ID
// ============================================================

async function getPriceById(req, res) {

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

        const result =
            await pool.query(
                `
                SELECT
                    price_id,
                    cinema_id,
                    screen_id,
                    price_name,
                    ticket_type,
                    amount,
                    currency,
                    day_type,
                    start_time,
                    end_time,
                    is_active,
                    created_at,
                    updated_at

                FROM ticket_prices

                WHERE price_id = $1
                `,
                [priceId]
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

                priceId:
                    row.price_id,

                cinemaId:
                    row.cinema_id,

                screenId:
                    row.screen_id,

                priceName:
                    row.price_name,

                ticketType:
                    row.ticket_type,

                amount:
                    row.amount,

                currency:
                    row.currency,

                dayType:
                    row.day_type,

                startTime:
                    row.start_time,

                endTime:
                    row.end_time,

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

    }

}


// ============================================================
// GET PRICES FOR SHOWTIME
// ============================================================

async function getShowtimePricing(req, res) {

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

        // ----------------------------------------------------
        // Get showtime
        // ----------------------------------------------------

        const showtimeResult =
            await pool.query(
                `
                SELECT
                    showtime_id,
                    cinema_id,
                    screen_id,
                    show_date,
                    start_time,
                    status,
                    is_active

                FROM showtimes

                WHERE showtime_id = $1
                `,
                [showtimeId]
            );

        if (
            showtimeResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Showtime not found'

            });

        }

        const showtime =
            showtimeResult.rows[0];

        const cinemaId =
            showtime.cinema_id;

        const screenId =
            showtime.screen_id;

        const showDate =
            showtime.show_date;

        const startTime =
            showtime.start_time;


        // ----------------------------------------------------
        // Determine day type
        // ----------------------------------------------------
        //
        // PostgreSQL EXTRACT(DOW):
        //
        // Sunday    = 0
        // Monday    = 1
        // Tuesday   = 2
        // Wednesday = 3
        // Thursday  = 4
        // Friday    = 5
        // Saturday  = 6
        //
        // Therefore 0 and 6 = weekend.
        // ----------------------------------------------------

        const dayResult =
            await pool.query(
                `
                SELECT
                    CASE
                        WHEN EXTRACT(
                            DOW FROM $1::date
                        ) IN (0, 6)

                        THEN 'WEEKEND'

                        ELSE 'WEEKDAY'

                    END AS day_type
                `,
                [showDate]
            );

        const dayType =
            dayResult.rows[0].day_type;


        // ----------------------------------------------------
        // Find applicable prices
        // ----------------------------------------------------

        const priceResult =
            await pool.query(
                `
                SELECT

                    price_id,
                    price_name,
                    ticket_type,
                    amount,
                    currency,
                    day_type,
                    start_time,
                    end_time,
                    screen_id

                FROM ticket_prices

                WHERE cinema_id = $1

                  AND is_active = 'Y'

                  AND (
                        screen_id IS NULL
                        OR screen_id = $2
                  )

                  AND (
                        day_type IS NULL
                        OR day_type = $3
                  )

                  AND (
                        start_time IS NULL

                        OR
                        $4::time >= start_time
                  )

                  AND (
                        end_time IS NULL

                        OR
                        $4::time <= end_time
                  )

                ORDER BY

                    ticket_type,

                    CASE
                        WHEN screen_id = $2
                        THEN 1
                        ELSE 2
                    END,

                    CASE
                        WHEN day_type = $3
                        THEN 1
                        ELSE 2
                    END
                `,
                [
                    cinemaId,
                    screenId,
                    dayType,
                    startTime
                ]
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
                row.ticket_type;

            if (
                !priceMap.has(ticketType)
            ) {

                priceMap.set(
                    ticketType,
                    {

                        priceId:
                            row.price_id,

                        priceName:
                            row.price_name,

                        ticketType:
                            row.ticket_type,

                        amount:
                            row.amount,

                        currency:
                            row.currency,

                        dayType:
                            row.day_type,

                        startTime:
                            row.start_time,

                        endTime:
                            row.end_time

                    }
                );

            }

        }

        const prices =
            Array.from(
                priceMap.values()
            );


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

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

    }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    getPrices,
    getPriceById,
    getShowtimePricing

};