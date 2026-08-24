const { getConnection } = require('../config/database');


// ============================================================
// GET ACTIVE PROMOTIONS
// ============================================================

async function getPromotions(req, res) {

    let connection;

    try {

        connection = await getConnection();

        const {
            cinemaId,
            code
        } = req.query;

        let sql = `
            SELECT
                PROMOTION_ID,
                CINEMA_ID,
                PROMOTION_NAME,
                PROMOTION_CODE,
                DESCRIPTION,
                DISCOUNT_TYPE,
                DISCOUNT_VALUE,
                MIN_TICKETS,
                MAX_DISCOUNT,
                START_DATE,
                END_DATE,
                IS_ACTIVE,
                CREATED_AT,
                UPDATED_AT

            FROM PROMOTIONS

            WHERE IS_ACTIVE = 'Y'

              AND START_DATE <= CURRENT_TIMESTAMP

              AND END_DATE >= CURRENT_TIMESTAMP
        `;

        const binds = {};

        if (cinemaId) {

            sql += `
                AND CINEMA_ID = :cinemaId
            `;

            binds.cinemaId =
                Number(cinemaId);
        }

        if (code) {

            sql += `
                AND UPPER(PROMOTION_CODE)
                    = UPPER(:code)
            `;

            binds.code = code;
        }

        sql += `
            ORDER BY START_DATE DESC,
                     PROMOTION_ID
        `;

        const result =
            await connection.execute(
                sql,
                binds
            );

        const promotions =
            result.rows.map(row => ({

                promotionId: row[0],

                cinemaId: row[1],

                promotionName: row[2],

                promotionCode: row[3],

                description: row[4],

                discountType: row[5],

                discountValue: row[6],

                minTickets: row[7],

                maxDiscount: row[8],

                startDate: row[9],

                endDate: row[10],

                isActive: row[11],

                createdAt: row[12],

                updatedAt: row[13]

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
// GET PROMOTION BY ID
// ============================================================

async function getPromotionById(req, res) {

    let connection;

    try {

        const promotionId =
            Number(req.params.promotionId);

        if (!Number.isInteger(promotionId)) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid promotion ID'

            });

        }

        connection =
            await getConnection();

        const result =
            await connection.execute(
                `
                SELECT
                    PROMOTION_ID,
                    CINEMA_ID,
                    PROMOTION_NAME,
                    PROMOTION_CODE,
                    DESCRIPTION,
                    DISCOUNT_TYPE,
                    DISCOUNT_VALUE,
                    MIN_TICKETS,
                    MAX_DISCOUNT,
                    START_DATE,
                    END_DATE,
                    IS_ACTIVE,
                    CREATED_AT,
                    UPDATED_AT

                FROM PROMOTIONS

                WHERE PROMOTION_ID =
                      :promotionId
                `,
                {
                    promotionId
                }
            );

        if (result.rows.length === 0) {

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

                promotionId: row[0],

                cinemaId: row[1],

                promotionName: row[2],

                promotionCode: row[3],

                description: row[4],

                discountType: row[5],

                discountValue: row[6],

                minTickets: row[7],

                maxDiscount: row[8],

                startDate: row[9],

                endDate: row[10],

                isActive: row[11],

                createdAt: row[12],

                updatedAt: row[13]

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
// VALIDATE PROMOTION
// ============================================================

async function validatePromotion(req, res) {

    let connection;

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
                    START_TIME
                FROM SHOWTIMES
                WHERE SHOWTIME_ID =
                      :showtimeId
                `,
                {
                    showtimeId:
                        Number(showtimeId)
                }
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
            showtime[1];

        // ----------------------------------------------------
        // Find promotion
        // ----------------------------------------------------

        const promotionResult =
            await connection.execute(
                `
                SELECT
                    PROMOTION_ID,
                    PROMOTION_NAME,
                    PROMOTION_CODE,
                    DISCOUNT_TYPE,
                    DISCOUNT_VALUE,
                    MIN_TICKETS,
                    MAX_DISCOUNT

                FROM PROMOTIONS

                WHERE UPPER(PROMOTION_CODE)
                      = UPPER(:promotionCode)

                  AND CINEMA_ID =
                      :cinemaId

                  AND IS_ACTIVE = 'Y'

                  AND START_DATE <= CURRENT_TIMESTAMP

                  AND END_DATE >= CURRENT_TIMESTAMP
                `,
                {
                    promotionCode,
                    cinemaId
                }
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
            promotion[0];

        const promotionName =
            promotion[1];

        const discountType =
            promotion[3];

        const discountValue =
            Number(promotion[4]);

        const minTickets =
            promotion[5] || 0;

        const maxDiscount =
            promotion[6] !== null
                ? Number(promotion[6])
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
        // Get pricing
        // ----------------------------------------------------

        const priceResult =
            await connection.execute(
                `
                SELECT
                    PRICE_ID,
                    TICKET_TYPE,
                    AMOUNT
                FROM TICKET_PRICES
                WHERE CINEMA_ID =
                      :cinemaId

                  AND IS_ACTIVE = 'Y'

                  AND (
                        SCREEN_ID IS NULL
                        OR SCREEN_ID = :screenId
                  )

                  AND (
                        DAY_TYPE IS NULL

                        OR DAY_TYPE =
                            CASE

                                WHEN TO_CHAR(
                                    :showDate,
                                    'DY',
                                    'NLS_DATE_LANGUAGE=ENGLISH'
                                )
                                IN ('SAT', 'SUN')

                                THEN 'WEEKEND'

                                ELSE 'WEEKDAY'

                            END
                  )
                `,
                {
                    cinemaId,

                    screenId:
                        showtime[2],

                    showDate:
                        showtime[3]
                }
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

            if (
                !priceMap.has(row[1])
            ) {

                priceMap.set(
                    row[1],
                    Number(row[2])
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
                (discountValue / 100);

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

        // Never discount below zero

        if (
            discountAmount > originalAmount
        ) {

            discountAmount =
                originalAmount;

        }

        const finalAmount =
            originalAmount -
            discountAmount;

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

    getPromotions,
    getPromotionById,
    validatePromotion

};