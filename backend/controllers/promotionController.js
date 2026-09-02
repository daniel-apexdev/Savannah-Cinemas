const pool = require('../config/database');


// ============================================================
// GET ACTIVE PROMOTIONS
// ============================================================

async function getPromotions(req, res) {

    try {

        const {
            cinemaId,
            code
        } = req.query;

        let sql = `
            SELECT
                promotion_id,
                cinema_id,
                promotion_name,
                promotion_code,
                description,
                discount_type,
                discount_value,
                min_tickets,
                max_discount,
                start_date,
                end_date,
                is_active,
                created_at,
                updated_at

            FROM promotions

            WHERE is_active = 'Y'

              AND start_date <= CURRENT_TIMESTAMP

              AND end_date >= CURRENT_TIMESTAMP
        `;

        const params = [];

        // ----------------------------------------------------
        // Filter by cinema
        // ----------------------------------------------------

        if (cinemaId) {

            const parsedCinemaId =
                Number(cinemaId);

            if (
                !Number.isInteger(parsedCinemaId)
            ) {

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
        // Filter by promotion code
        // ----------------------------------------------------

        if (code) {

            params.push(code);

            sql += `
                AND UPPER(promotion_code)
                    = UPPER($${params.length})
            `;
        }

        // ----------------------------------------------------
        // Ordering
        // ----------------------------------------------------

        sql += `
            ORDER BY
                start_date DESC,
                promotion_id
        `;

        const result =
            await pool.query(
                sql,
                params
            );

        const promotions =
            result.rows.map(row => ({

                promotionId:
                    row.promotion_id,

                cinemaId:
                    row.cinema_id,

                promotionName:
                    row.promotion_name,

                promotionCode:
                    row.promotion_code,

                description:
                    row.description,

                discountType:
                    row.discount_type,

                discountValue:
                    row.discount_value,

                minTickets:
                    row.min_tickets,

                maxDiscount:
                    row.max_discount,

                startDate:
                    row.start_date,

                endDate:
                    row.end_date,

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
                promotions.length,

            promotions

        });

    } catch (error) {

        console.error(
            '❌ Get promotions error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching promotions',

            error:
                error.message

        });

    }

}


// ============================================================
// GET PROMOTION BY ID
// ============================================================

async function getPromotionById(req, res) {

    try {

        const promotionId =
            Number(req.params.promotionId);

        if (
            !Number.isInteger(promotionId)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid promotion ID'

            });

        }

        const result =
            await pool.query(
                `
                SELECT
                    promotion_id,
                    cinema_id,
                    promotion_name,
                    promotion_code,
                    description,
                    discount_type,
                    discount_value,
                    min_tickets,
                    max_discount,
                    start_date,
                    end_date,
                    is_active,
                    created_at,
                    updated_at

                FROM promotions

                WHERE promotion_id = $1
                `,
                [promotionId]
            );

        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Promotion not found'

            });

        }

        const row =
            result.rows[0];

        return res.json({

            success: true,

            promotion: {

                promotionId:
                    row.promotion_id,

                cinemaId:
                    row.cinema_id,

                promotionName:
                    row.promotion_name,

                promotionCode:
                    row.promotion_code,

                description:
                    row.description,

                discountType:
                    row.discount_type,

                discountValue:
                    row.discount_value,

                minTickets:
                    row.min_tickets,

                maxDiscount:
                    row.max_discount,

                startDate:
                    row.start_date,

                endDate:
                    row.end_date,

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
            '❌ Get promotion error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching promotion',

            error:
                error.message

        });

    }

}


// ============================================================
// VALIDATE PROMOTION
// ============================================================

async function validatePromotion(req, res) {

    try {

        const {
            promotionCode,
            showtimeId,
            tickets
        } = req.body;


        // ----------------------------------------------------
        // Validate request
        // ----------------------------------------------------

        if (!promotionCode) {

            return res.status(400).json({

                success: false,

                message:
                    'Promotion code is required'

            });

        }

        if (!showtimeId) {

            return res.status(400).json({

                success: false,

                message:
                    'Showtime ID is required'

            });

        }

        if (
            !Array.isArray(tickets) ||
            tickets.length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Tickets are required'

            });

        }


        // ----------------------------------------------------
        // Validate showtime ID
        // ----------------------------------------------------

        const parsedShowtimeId =
            Number(showtimeId);

        if (
            !Number.isInteger(parsedShowtimeId)
        ) {

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
                    start_time

                FROM showtimes

                WHERE showtime_id = $1
                `,
                [parsedShowtimeId]
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


        // ----------------------------------------------------
        // Find promotion
        // ----------------------------------------------------

        const promotionResult =
            await pool.query(
                `
                SELECT
                    promotion_id,
                    promotion_name,
                    promotion_code,
                    discount_type,
                    discount_value,
                    min_tickets,
                    max_discount

                FROM promotions

                WHERE UPPER(promotion_code)
                      = UPPER($1)

                  AND cinema_id = $2

                  AND is_active = 'Y'

                  AND start_date <= CURRENT_TIMESTAMP

                  AND end_date >= CURRENT_TIMESTAMP
                `,
                [
                    promotionCode,
                    cinemaId
                ]
            );

        if (
            promotionResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                valid: false,

                message:
                    'Promotion code is invalid or expired'

            });

        }

        const promotion =
            promotionResult.rows[0];

        const promotionId =
            promotion.promotion_id;

        const promotionName =
            promotion.promotion_name;

        const discountType =
            promotion.discount_type;

        const discountValue =
            Number(
                promotion.discount_value
            );

        const minTickets =
            Number(
                promotion.min_tickets || 0
            );

        const maxDiscount =
            promotion.max_discount !== null
                ? Number(
                    promotion.max_discount
                )
                : null;


        // ----------------------------------------------------
        // Calculate ticket quantity
        // ----------------------------------------------------

        let totalTickets = 0;

        for (
            const ticket
            of tickets
        ) {

            const quantity =
                Number(ticket.quantity);

            if (
                !Number.isInteger(quantity) ||
                quantity <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Invalid ticket quantity'

                });

            }

            totalTickets += quantity;

        }


        // ----------------------------------------------------
        // Minimum ticket requirement
        // ----------------------------------------------------

        if (
            totalTickets < minTickets
        ) {

            return res.json({

                success: true,

                valid: false,

                message:
                    `Minimum ${minTickets} tickets required for this promotion`

            });

        }


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
        // Therefore:
        // 0 and 6 = WEEKEND
        // Everything else = WEEKDAY
        // ----------------------------------------------------

        const dayTypeResult =
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
            dayTypeResult.rows[0].day_type;


        // ----------------------------------------------------
        // Get pricing
        // ----------------------------------------------------

        const priceResult =
            await pool.query(
                `
                SELECT
                    price_id,
                    ticket_type,
                    amount,
                    screen_id,
                    day_type

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
                    dayType
                ]
            );


        // ----------------------------------------------------
        // Build price map
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
                    Number(row.amount)
                );

            }

        }


        // ----------------------------------------------------
        // Calculate original total
        // ----------------------------------------------------

        let originalAmount = 0;

        for (
            const ticket
            of tickets
        ) {

            const ticketType =
                String(
                    ticket.ticketType
                ).toUpperCase();

            const quantity =
                Number(ticket.quantity);

            const price =
                priceMap.get(
                    ticketType
                );

            if (
                price === undefined
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `No price found for ticket type ${ticketType}`

                });

            }

            originalAmount +=
                price * quantity;

        }


        // ----------------------------------------------------
        // Calculate discount
        // ----------------------------------------------------

        let discountAmount = 0;

        if (
            discountType === 'PERCENTAGE'
        ) {

            discountAmount =
                originalAmount *
                (
                    discountValue / 100
                );

        } else if (
            discountType === 'FIXED'
        ) {

            discountAmount =
                discountValue;

        }


        // ----------------------------------------------------
        // Apply maximum discount
        // ----------------------------------------------------

        if (
            maxDiscount !== null &&
            discountAmount > maxDiscount
        ) {

            discountAmount =
                maxDiscount;

        }


        // ----------------------------------------------------
        // Never discount below zero
        // ----------------------------------------------------

        if (
            discountAmount > originalAmount
        ) {

            discountAmount =
                originalAmount;

        }


        // ----------------------------------------------------
        // Calculate final amount
        // ----------------------------------------------------

        const finalAmount =
            originalAmount -
            discountAmount;


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            valid: true,

            promotion: {

                promotionId,

                promotionName,

                discountType,

                discountValue

            },

            pricing: {

                originalAmount:
                    Number(
                        originalAmount.toFixed(2)
                    ),

                discountAmount:
                    Number(
                        discountAmount.toFixed(2)
                    ),

                finalAmount:
                    Number(
                        finalAmount.toFixed(2)
                    )

            }

        });

    } catch (error) {

        console.error(
            '❌ Validate promotion error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error validating promotion',

            error:
                error.message

        });

    }

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    getPromotions,
    getPromotionById,
    validatePromotion

};