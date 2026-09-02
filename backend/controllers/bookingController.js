const pool = require('../config/database');

const {
sendBookingConfirmation
} = require('../utils/emailService');

// ============================================================
// CREATE BOOKING
// ============================================================

async function createBooking(req, res) {


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
        showtimeId,
        seatIds,
        promotionCode
    } = req.body;


    if (!showtimeId) {

        return res.status(400).json({
            success: false,
            message: 'Showtime ID is required'
        });

    }


    if (
        !Array.isArray(seatIds) ||
        seatIds.length === 0
    ) {

        return res.status(400).json({
            success: false,
            message: 'At least one seat must be selected'
        });

    }


    // ----------------------------------------------------
    // Parse IDs
    // ----------------------------------------------------

    const parsedShowtimeId =
        Number(showtimeId);


    const parsedSeatIds = [
        ...new Set(
            seatIds.map(Number)
        )
    ];


    if (
        !Number.isInteger(parsedShowtimeId) ||
        parsedShowtimeId <= 0 ||
        parsedSeatIds.some(
            seatId =>
                !Number.isInteger(seatId) ||
                seatId <= 0
        )
    ) {

        return res.status(400).json({
            success: false,
            message: 'Invalid showtime or seat ID'
        });

    }


    // ====================================================
    // GET POSTGRESQL CLIENT
    // ====================================================

    client = await pool.connect();

    await client.query('BEGIN');


    // ====================================================
    // GET USER
    // ====================================================

    const userResult =
        await client.query(
            `
            SELECT
                email,
                forenames,
                surname
            FROM users
            WHERE user_id = $1
              AND is_active = 'Y'
            `,
            [userId]
        );


    if (userResult.rows.length === 0) {

        await client.query('ROLLBACK');

        return res.status(404).json({
            success: false,
            message: 'User account not found'
        });

    }


    const user =
        userResult.rows[0];


    const userEmail =
        user.email;


    const customerName =
        `${user.forenames || ''} ${user.surname || ''}`
            .trim();


    // ====================================================
    // GET SHOWTIME
    // ====================================================

    const showtimeResult =
        await client.query(
            `
            SELECT
                st.showtime_id,
                st.movie_id,
                m.title,

                st.cinema_id,
                c.cinema_name,

                st.screen_id,
                s.screen_name,
                s.capacity,

                st.show_date,
                st.start_time,
                st.end_time,

                st.ticket_price,
                st.status,
                st.is_active

            FROM showtimes st

            JOIN movies m
                ON m.movie_id =
                   st.movie_id

            JOIN cinemas c
                ON c.cinema_id =
                   st.cinema_id

            JOIN screens s
                ON s.screen_id =
                   st.screen_id

            WHERE st.showtime_id =
                  $1

            FOR UPDATE
            `,
            [parsedShowtimeId]
        );


    if (showtimeResult.rows.length === 0) {

        await client.query('ROLLBACK');

        return res.status(404).json({
            success: false,
            message: 'Showtime not found'
        });

    }


    const showtime =
        showtimeResult.rows[0];


    const movieId =
        showtime.movie_id;

    const movieTitle =
        showtime.title;

    const cinemaId =
        showtime.cinema_id;

    const cinemaName =
        showtime.cinema_name;

    const screenId =
        showtime.screen_id;

    const screenName =
        showtime.screen_name;

    const showDate =
        showtime.show_date;

    const startTime =
        showtime.start_time;

    const endTime =
        showtime.end_time;

    const fallbackTicketPrice =
        Number(showtime.ticket_price || 0);

    const showtimeStatus =
        showtime.status;

    const isActive =
        showtime.is_active;


    // ====================================================
    // CHECK SHOWTIME
    // ====================================================

    if (
        isActive !== 'Y' ||
        ![
            'SCHEDULED',
            'NOW_SHOWING'
        ].includes(showtimeStatus)
    ) {

        await client.query('ROLLBACK');

        return res.status(400).json({
            success: false,
            message:
                'This showtime is not available for booking'
        });

    }


    // ====================================================
    // VALIDATE SEATS
    // ====================================================

    const seatsResult =
        await client.query(
            `
            SELECT
                seat_id,
                seat_label,
                seat_type
            FROM seats
            WHERE screen_id = $1
              AND is_active = 'Y'
              AND seat_id = ANY($2::bigint[])
            ORDER BY
                row_label,
                seat_number
            `,
            [
                screenId,
                parsedSeatIds
            ]
        );


    if (
        seatsResult.rows.length !==
        parsedSeatIds.length
    ) {

        await client.query('ROLLBACK');

        return res.status(400).json({
            success: false,
            message:
                'One or more selected seats are invalid for this screen'
        });

    }


    // ====================================================
    // CHECK SEATS ALREADY BOOKED
    // ====================================================

    const bookedResult =
        await client.query(
            `
            SELECT
                bs.seat_id

            FROM booking_seats bs

            JOIN bookings b
                ON b.booking_id =
                   bs.booking_id

            WHERE bs.showtime_id =
                  $1

              AND bs.seat_id =
                  ANY($2::bigint[])

              AND (
                    b.status = 'CONFIRMED'

                    OR

                    (
                        b.status = 'PENDING'

                        AND (
                            b.expires_at IS NULL
                            OR
                            b.expires_at >
                                CURRENT_TIMESTAMP
                        )
                    )
              )

            FOR UPDATE
            `,
            [
                parsedShowtimeId,
                parsedSeatIds
            ]
        );


    if (bookedResult.rows.length > 0) {

        const bookedSeatIds =
            bookedResult.rows.map(
                row => row.seat_id
            );


        await client.query('ROLLBACK');

        return res.status(409).json({

            success: false,

            message:
                'One or more selected seats are already booked',

            bookedSeatIds

        });

    }


    // ====================================================
    // PRICING
    // ====================================================

    /*
        TICKET_PRICES is used as the primary
        pricing source.

        If no matching ticket price exists,
        SHOWTIMES.TICKET_PRICE is used.
    */

    const priceResult =
        await client.query(
            `
            SELECT
                price_id,
                ticket_type,
                amount,
                currency,
                day_type,
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

                    OR

                    day_type =
                    CASE
                        WHEN EXTRACT(
                            ISODOW
                            FROM $3::date
                        ) IN (6, 7)
                        THEN 'WEEKEND'
                        ELSE 'WEEKDAY'
                    END
              )

            ORDER BY
                ticket_type,

                CASE
                    WHEN screen_id = $2
                    THEN 1
                    ELSE 2
                END
            `,
            [
                cinemaId,
                screenId,
                showDate
            ]
        );


    // ====================================================
    // BUILD PRICE MAP
    // ====================================================

    const priceMap =
        new Map();


    for (
        const row of priceResult.rows
    ) {

        const ticketType =
            String(row.ticket_type)
                .toUpperCase();


        /*
            The query orders screen-specific
            prices first.
        */

        if (
            !priceMap.has(ticketType)
        ) {

            priceMap.set(
                ticketType,
                {
                    priceId:
                        row.price_id,

                    amount:
                        Number(row.amount),

                    currency:
                        row.currency
                }
            );

        }

    }


    // ====================================================
    // BUILD TICKET BREAKDOWN
    // ====================================================

    const bookingTickets = [];

    let originalAmount = 0;

    let ticketQuantity = 0;


    /*
        The current frontend sends seat IDs only.

        Therefore SEAT_TYPE is used as the
        ticket type when a matching price exists.

        If there is no matching price,
        ADULT pricing is used.
    */

    for (
        const seat
        of seatsResult.rows
    ) {

        const seatId =
            seat.seat_id;

        const seatType =
            seat.seat_type
                ? String(
                    seat.seat_type
                ).toUpperCase()
                : 'ADULT';


        let ticketType =
            seatType;


        let price =
            priceMap.get(
                ticketType
            );


        // ------------------------------------------------
        // Fall back to ADULT
        // ------------------------------------------------

        if (!price) {

            ticketType =
                'ADULT';

            price =
                priceMap.get(
                    'ADULT'
                );

        }


        // ------------------------------------------------
        // Fall back to showtime price
        // ------------------------------------------------

        const unitPrice =
            price
                ? price.amount
                : fallbackTicketPrice;


        const existingTicket =
            bookingTickets.find(
                item =>
                    item.ticketType ===
                    ticketType
            );


        if (existingTicket) {

            existingTicket.quantity += 1;

            existingTicket.subtotal +=
                unitPrice;

        }
        else {

            bookingTickets.push({

                ticketType,

                quantity: 1,

                unitPrice,

                subtotal:
                    unitPrice

            });

        }


        ticketQuantity++;

        originalAmount +=
            unitPrice;

    }


    // ====================================================
    // PROMOTION
    // ====================================================

    let promotionId = null;

    let discountAmount = 0;

    let promotion = null;


    if (
        promotionCode &&
        String(promotionCode).trim()
    ) {

        const promotionResult =
            await client.query(
                `
                SELECT
                    promotion_id,
                    promotion_name,
                    discount_type,
                    discount_value,
                    min_tickets,
                    max_discount

                FROM promotions

                WHERE UPPER(promotion_code) =
                      UPPER($1)

                  AND cinema_id =
                      $2

                  AND is_active = 'Y'

                  AND start_date <=
                      CURRENT_TIMESTAMP

                  AND end_date >=
                      CURRENT_TIMESTAMP

                FOR UPDATE
                `,
                [
                    String(
                        promotionCode
                    ).trim(),

                    cinemaId
                ]
            );


        if (
            promotionResult.rows.length === 0
        ) {

            await client.query('ROLLBACK');

            return res.status(400).json({

                success: false,

                message:
                    'Invalid or expired promotion code'

            });

        }


        const promo =
            promotionResult.rows[0];


        promotionId =
            promo.promotion_id;


        promotion = {

            promotionId:
                promo.promotion_id,

            promotionName:
                promo.promotion_name,

            discountType:
                promo.discount_type,

            discountValue:
                Number(
                    promo.discount_value
                )

        };


        const minTickets =
            promo.min_tickets === null
                ? 0
                : Number(
                    promo.min_tickets
                );


        const maxDiscount =
            promo.max_discount === null
                ? null
                : Number(
                    promo.max_discount
                );


        // ------------------------------------------------
        // Minimum ticket requirement
        // ------------------------------------------------

        if (
            ticketQuantity <
            minTickets
        ) {

            await client.query('ROLLBACK');

            return res.status(400).json({

                success: false,

                message:
                    `This promotion requires at least ${minTickets} tickets`

            });

        }


        // =================================================
        // PROMOTION TARGETS
        // =================================================

        const targetResult =
            await client.query(
                `
                SELECT
                    target_type,
                    target_value

                FROM promotion_targets

                WHERE promotion_id =
                      $1
                `,
                [promotionId]
            );


        const targets =
            targetResult.rows;


        for (
            const target
            of targets
        ) {

            const targetType =
                String(
                    target.target_type
                ).toUpperCase();


            const targetValue =
                String(
                    target.target_value
                ).toUpperCase();


            // --------------------------------------------
            // MOVIE
            // --------------------------------------------

            if (
                targetType === 'MOVIE' &&
                String(movieId) !==
                targetValue
            ) {

                await client.query(
                    'ROLLBACK'
                );

                return res.status(400).json({

                    success: false,

                    message:
                        'This promotion does not apply to this movie'

                });

            }


            // --------------------------------------------
            // CINEMA
            // --------------------------------------------

            if (
                targetType === 'CINEMA' &&
                String(cinemaId) !==
                targetValue
            ) {

                await client.query(
                    'ROLLBACK'
                );

                return res.status(400).json({

                    success: false,

                    message:
                        'This promotion does not apply to this cinema'

                });

            }


            // --------------------------------------------
            // SCREEN
            // --------------------------------------------

            if (
                targetType === 'SCREEN' &&
                String(screenId) !==
                targetValue
            ) {

                await client.query(
                    'ROLLBACK'
                );

                return res.status(400).json({

                    success: false,

                    message:
                        'This promotion does not apply to this screen'

                });

            }


            // --------------------------------------------
            // TICKET TYPE
            // --------------------------------------------

            if (
                targetType ===
                'TICKET_TYPE'
            ) {

                const matchingTicket =
                    bookingTickets.some(
                        ticket =>
                            ticket.ticketType ===
                            targetValue
                    );


                if (
                    !matchingTicket
                ) {

                    await client.query(
                        'ROLLBACK'
                    );

                    return res.status(400).json({

                        success: false,

                        message:
                            'This promotion does not apply to the selected ticket type'

                    });

                }

            }

        }


        // =================================================
        // CALCULATE DISCOUNT
        // =================================================

        const discountType =
            String(
                promo.discount_type
            ).toUpperCase();


        const discountValue =
            Number(
                promo.discount_value
            );


        if (
            discountType ===
            'PERCENTAGE'
        ) {

            discountAmount =
                originalAmount *
                (
                    discountValue /
                    100
                );

        }
        else if (
            discountType ===
            'FIXED'
        ) {

            discountAmount =
                discountValue;

        }


        // ------------------------------------------------
        // Maximum discount
        // ------------------------------------------------

        if (
            maxDiscount !== null &&
            discountAmount >
            maxDiscount
        ) {

            discountAmount =
                maxDiscount;

        }


        // ------------------------------------------------
        // Never allow negative totals
        // ------------------------------------------------

        if (
            discountAmount >
            originalAmount
        ) {

            discountAmount =
                originalAmount;

        }

    }


    // ====================================================
    // FINAL AMOUNT
    // ====================================================

    const totalAmount =
        Number(
            (
                originalAmount -
                discountAmount
            ).toFixed(2)
        );


    // ====================================================
    // BOOKING REFERENCE
    // ====================================================

    const bookingRef =
        'SC-' +
        Date.now()
            .toString()
            .slice(-8) +
        '-' +
        Math.random()
            .toString(36)
            .substring(2, 6)
            .toUpperCase();


    // ====================================================
    // CREATE BOOKING
    // ====================================================

    const averageTicketPrice =
        ticketQuantity > 0
            ? Number(
                (
                    originalAmount /
                    ticketQuantity
                ).toFixed(2)
            )
            : 0;


    const bookingResult =
        await client.query(
            `
            INSERT INTO bookings (
                booking_ref,
                user_id,
                showtime_id,
                ticket_quantity,
                ticket_price,
                total_amount,
                status,
                promotion_id,
                discount_amount,
                booking_date,
                created_at,
                expires_at
            )

            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                'PENDING',
                $7,
                $8,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP +
                    INTERVAL '15 minutes'
            )

            RETURNING booking_id
            `,
            [
                bookingRef,

                userId,

                parsedShowtimeId,

                ticketQuantity,

                averageTicketPrice,

                totalAmount,

                promotionId,

                discountAmount
            ]
        );


    const bookingId =
        bookingResult.rows[0].booking_id;


    // ====================================================
    // INSERT BOOKING TICKETS
    // ====================================================

    for (
        const ticket
        of bookingTickets
    ) {

        await client.query(
            `
            INSERT INTO booking_tickets (
                booking_id,
                ticket_type,
                quantity,
                unit_price,
                subtotal,
                created_at
            )

            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                CURRENT_TIMESTAMP
            )
            `,
            [
                bookingId,

                ticket.ticketType,

                ticket.quantity,

                ticket.unitPrice,

                ticket.subtotal
            ]
        );

    }


    // ====================================================
    // INSERT BOOKING SEATS
    // ====================================================

    for (
        const seat
        of seatsResult.rows
    ) {

        const seatId =
            seat.seat_id;

        const seatType =
            seat.seat_type
                ? String(
                    seat.seat_type
                ).toUpperCase()
                : 'ADULT';


        let price =
            priceMap.get(
                seatType
            );


        if (!price) {

            price =
                priceMap.get(
                    'ADULT'
                );

        }


        const seatTicketPrice =
            price
                ? price.amount
                : fallbackTicketPrice;


        await client.query(
            `
            INSERT INTO booking_seats (
                booking_id,
                showtime_id,
                seat_id,
                ticket_price
            )

            VALUES (
                $1,
                $2,
                $3,
                $4
            )
            `,
            [
                bookingId,

                parsedShowtimeId,

                seatId,

                seatTicketPrice
            ]
        );

    }


    // ====================================================
    // COMMIT
    // ====================================================

    await client.query(
        'COMMIT'
    );


    console.log(
        `✅ Booking created: ${bookingRef} | User: ${userId}`
    );


    // ====================================================
    // RESPONSE
    // ====================================================

    const bookingResponse = {

        bookingId,

        bookingRef,

        userId,

        showtimeId:
            parsedShowtimeId,


        movie: {

            movieId,

            title:
                movieTitle

        },


        cinema: {

            cinemaId,

            name:
                cinemaName

        },


        screen: {

            screenId,

            name:
                screenName

        },


        showDate,

        startTime,

        endTime,


        ticketQuantity,


        ticketPrice:
            averageTicketPrice,


        originalAmount:
            Number(
                originalAmount.toFixed(2)
            ),


        discountAmount:
            Number(
                discountAmount.toFixed(2)
            ),


        totalAmount,


        promotion,


        status:
            'PENDING',


        seatIds:
            parsedSeatIds,


        seats:
            seatsResult.rows.map(
                row => ({

                    seatId:
                        row.seat_id,

                    seatLabel:
                        row.seat_label,

                    seatType:
                        row.seat_type

                })
            ),


        ticketBreakdown:
            bookingTickets.map(
                ticket => ({

                    ticketType:
                        ticket.ticketType,

                    quantity:
                        ticket.quantity,

                    unitPrice:
                        ticket.unitPrice,

                    subtotal:
                        Number(
                            ticket.subtotal
                                .toFixed(2)
                        )

                })
            )

    };


    // ====================================================
    // SEND BOOKING CONFIRMATION
    // ====================================================

    /*
        Email is sent AFTER COMMIT so that an email is
        never sent for a transaction that failed.
    */

    try {

        if (
            typeof sendBookingConfirmation ===
            'function'
        ) {

            await sendBookingConfirmation({

                email:
                    userEmail,

                customerName,

                booking:
                    bookingResponse

            });

        }

    }
    catch (emailError) {

        console.error(
            '⚠️ Booking created but confirmation email failed:',
            emailError.message
        );

    }


    return res.status(201).json({

        success: true,

        message:
            'Booking created successfully. Payment is required to confirm your booking.',

        booking:
            bookingResponse

    });


}
catch (error) {

    console.error(
        '❌ Create booking error:',
        error
    );


    if (client) {

        try {

            await client.query(
                'ROLLBACK'
            );

        }
        catch (rollbackError) {

            console.error(
                '❌ Rollback error:',
                rollbackError.message
            );

        }

    }


    // ----------------------------------------------------
    // PostgreSQL unique constraint
    // ----------------------------------------------------

    if (
        error.code === '23505'
    ) {

        return res.status(409).json({

            success: false,

            message:
                'One or more selected seats were just booked by another customer'

        });

    }


    return res.status(500).json({

        success: false,

        message:
            'Server error creating booking',

        error:
            error.message

    });

}
finally {

    if (client) {

        client.release();

    }

}


}

// ============================================================
// GET MY BOOKINGS
// ============================================================

async function getMyBookings(req, res) {


try {

    if (!req.user || !req.user.userId) {

        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });

    }


    const userId =
        req.user.userId;


    const result =
        await pool.query(
            `
            SELECT
                b.booking_id,
                b.booking_ref,
                b.showtime_id,

                m.movie_id,
                m.title,
                m.poster_url,

                c.cinema_id,
                c.cinema_name,

                s.screen_id,
                s.screen_name,

                st.show_date,
                st.start_time,
                st.end_time,

                b.ticket_quantity,
                b.ticket_price,
                b.total_amount,

                b.status,
                b.booking_date

            FROM bookings b

            JOIN showtimes st
                ON st.showtime_id =
                   b.showtime_id

            JOIN movies m
                ON m.movie_id =
                   st.movie_id

            JOIN cinemas c
                ON c.cinema_id =
                   st.cinema_id

            JOIN screens s
                ON s.screen_id =
                   st.screen_id

            WHERE b.user_id =
                  $1

            ORDER BY
                b.booking_date DESC
            `,
            [userId]
        );


    const bookings = [];


    for (
        const row
        of result.rows
    ) {

        const bookingId =
            row.booking_id;


        const seatsResult =
            await pool.query(
                `
                SELECT
                    bs.seat_id,
                    se.row_label,
                    se.seat_number,
                    se.seat_label,
                    se.seat_type,
                    bs.ticket_price

                FROM booking_seats bs

                JOIN seats se
                    ON se.seat_id =
                       bs.seat_id

                WHERE bs.booking_id =
                      $1

                ORDER BY
                    se.row_label,
                    se.seat_number
                `,
                [bookingId]
            );


        const seats =
            seatsResult.rows.map(
                seat => ({

                    seatId:
                        seat.seat_id,

                    rowLabel:
                        seat.row_label,

                    seatNumber:
                        seat.seat_number,

                    seatLabel:
                        seat.seat_label,

                    seatType:
                        seat.seat_type,

                    ticketPrice:
                        seat.ticket_price

                })
            );


        bookings.push({

            bookingId:
                row.booking_id,

            bookingRef:
                row.booking_ref,

            showtimeId:
                row.showtime_id,


            movie: {

                movieId:
                    row.movie_id,

                title:
                    row.title,

                posterUrl:
                    row.poster_url

            },


            cinema: {

                cinemaId:
                    row.cinema_id,

                name:
                    row.cinema_name

            },


            screen: {

                screenId:
                    row.screen_id,

                name:
                    row.screen_name

            },


            showDate:
                row.show_date,

            startTime:
                row.start_time,

            endTime:
                row.end_time,


            ticketQuantity:
                row.ticket_quantity,

            ticketPrice:
                row.ticket_price,

            totalAmount:
                row.total_amount,


            status:
                row.status,

            bookingDate:
                row.booking_date,


            seats

        });

    }


    return res.json({

        success: true,

        count:
            bookings.length,

        bookings

    });


}
catch (error) {

    console.error(
        '❌ Get my bookings error:',
        error
    );


    return res.status(500).json({

        success: false,

        message:
            'Server error fetching bookings',

        error:
            error.message

    });

}


}

// ============================================================
// GET BOOKING BY ID
// ============================================================

async function getBookingById(req, res) {


try {

    if (!req.user || !req.user.userId) {

        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });

    }


    const userId =
        req.user.userId;


    const bookingId =
        Number(
            req.params.bookingId
        );


    if (
        !Number.isInteger(bookingId) ||
        bookingId <= 0
    ) {

        return res.status(400).json({
            success: false,
            message: 'Invalid booking ID'
        });

    }


    const result =
        await pool.query(
            `
            SELECT
                b.booking_id,
                b.booking_ref,
                b.user_id,
                b.showtime_id,

                m.movie_id,
                m.title,
                m.poster_url,

                c.cinema_id,
                c.cinema_name,
                c.address,
                c.city,

                s.screen_id,
                s.screen_name,

                st.show_date,
                st.start_time,
                st.end_time,

                b.ticket_quantity,
                b.ticket_price,
                b.total_amount,

                b.status,
                b.booking_date,
                b.created_at,
                b.updated_at

            FROM bookings b

            JOIN showtimes st
                ON st.showtime_id =
                   b.showtime_id

            JOIN movies m
                ON m.movie_id =
                   st.movie_id

            JOIN cinemas c
                ON c.cinema_id =
                   st.cinema_id

            JOIN screens s
                ON s.screen_id =
                   st.screen_id

            WHERE b.booking_id =
                  $1

              AND b.user_id =
                  $2
            `,
            [
                bookingId,
                userId
            ]
        );


    if (
        result.rows.length === 0
    ) {

        return res.status(404).json({

            success: false,

            message:
                'Booking not found'

        });

    }


    const row =
        result.rows[0];


    const seatsResult =
        await pool.query(
            `
            SELECT
                bs.seat_id,
                se.row_label,
                se.seat_number,
                se.seat_label,
                se.seat_type,
                bs.ticket_price

            FROM booking_seats bs

            JOIN seats se
                ON se.seat_id =
                   bs.seat_id

            WHERE bs.booking_id =
                  $1

            ORDER BY
                se.row_label,
                se.seat_number
            `,
            [bookingId]
        );


    const seats =
        seatsResult.rows.map(
            seat => ({

                seatId:
                    seat.seat_id,

                rowLabel:
                    seat.row_label,

                seatNumber:
                    seat.seat_number,

                seatLabel:
                    seat.seat_label,

                seatType:
                    seat.seat_type,

                ticketPrice:
                    seat.ticket_price

            })
        );


    return res.json({

        success: true,

        booking: {

            bookingId:
                row.booking_id,

            bookingRef:
                row.booking_ref,

            userId:
                row.user_id,

            showtimeId:
                row.showtime_id,


            movie: {

                movieId:
                    row.movie_id,

                title:
                    row.title,

                posterUrl:
                    row.poster_url

            },


            cinema: {

                cinemaId:
                    row.cinema_id,

                name:
                    row.cinema_name,

                address:
                    row.address,

                city:
                    row.city

            },


            screen: {

                screenId:
                    row.screen_id,

                name:
                    row.screen_name

            },


            showDate:
                row.show_date,

            startTime:
                row.start_time,

            endTime:
                row.end_time,


            ticketQuantity:
                row.ticket_quantity,

            ticketPrice:
                row.ticket_price,

            totalAmount:
                row.total_amount,


            status:
                row.status,


            bookingDate:
                row.booking_date,

            createdAt:
                row.created_at,

            updatedAt:
                row.updated_at,


            seats

        }

    });

}
catch (error) {

    console.error(
        '❌ Get booking by ID error:',
        error
    );


    return res.status(500).json({

        success: false,

        message:
            'Server error fetching booking',

        error:
            error.message

    });

}


}

// ============================================================
// CANCEL BOOKING
// ============================================================

async function cancelBooking(req, res) {


let client;

try {

    if (!req.user || !req.user.userId) {

        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });

    }


    const userId =
        req.user.userId;


    const bookingId =
        Number(
            req.params.bookingId
        );


    if (
        !Number.isInteger(bookingId) ||
        bookingId <= 0
    ) {

        return res.status(400).json({
            success: false,
            message: 'Invalid booking ID'
        });

    }


    client =
        await pool.connect();


    await client.query(
        'BEGIN'
    );


    // ====================================================
    // GET BOOKING
    // ====================================================

    const bookingResult =
        await client.query(
            `
            SELECT
                booking_id,
                booking_ref,
                showtime_id,
                status

            FROM bookings

            WHERE booking_id =
                  $1

              AND user_id =
                  $2

            FOR UPDATE
            `,
            [
                bookingId,
                userId
            ]
        );


    if (
        bookingResult.rows.length === 0
    ) {

        await client.query(
            'ROLLBACK'
        );

        return res.status(404).json({

            success: false,

            message:
                'Booking not found'

        });

    }


    const booking =
        bookingResult.rows[0];


    const bookingStatus =
        booking.status;


    if (
        bookingStatus ===
        'CANCELLED'
    ) {

        await client.query(
            'ROLLBACK'
        );

        return res.status(400).json({

            success: false,

            message:
                'Booking has already been cancelled'

        });

    }


    if (
        bookingStatus ===
        'COMPLETED'
    ) {

        await client.query(
            'ROLLBACK'
        );

        return res.status(400).json({

            success: false,

            message:
                'Completed bookings cannot be cancelled'

        });

    }


    // ====================================================
    // CANCEL BOOKING
    // ====================================================

    await client.query(
        `
        UPDATE bookings

        SET
            status = 'CANCELLED',

            updated_at =
                CURRENT_TIMESTAMP

        WHERE booking_id =
              $1

          AND user_id =
              $2
        `,
        [
            bookingId,
            userId
        ]
    );


    await client.query(
        'COMMIT'
    );


    console.log(
        `✅ Booking cancelled: ${booking.booking_ref} | User: ${userId}`
    );


    return res.json({

        success: true,

        message:
            'Booking cancelled successfully',

        booking: {

            bookingId:
                booking.booking_id,

            bookingRef:
                booking.booking_ref,

            showtimeId:
                booking.showtime_id,

            status:
                'CANCELLED'

        }

    });


}
catch (error) {

    console.error(
        '❌ Cancel booking error:',
        error
    );


    if (client) {

        try {

            await client.query(
                'ROLLBACK'
            );

        }
        catch (rollbackError) {

            console.error(
                '❌ Rollback error:',
                rollbackError.message
            );

        }

    }


    return res.status(500).json({

        success: false,

        message:
            'Server error cancelling booking',

        error:
            error.message

    });

}
finally {

    if (client) {

        client.release();

    }

}


}

// ============================================================
// EXPORT
// ============================================================

module.exports = {

createBooking,

getMyBookings,

getBookingById,

cancelBooking


};
