const { getConnection } = require('../config/database');
const oracledb = require('oracledb');

const {
    sendBookingConfirmation
} = require('../utils/emailService');


// ============================================================
// CREATE BOOKING
// ============================================================

async function createBooking(req, res) {

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


        const parsedShowtimeId =
            Number(showtimeId);


        const parsedSeatIds = [
            ...new Set(
                seatIds.map(Number)
            )
        ];


        if (
            !Number.isInteger(parsedShowtimeId) ||
            parsedSeatIds.some(
                seatId => !Number.isInteger(seatId)
            )
        ) {

            return res.status(400).json({
                success: false,
                message: 'Invalid showtime or seat ID'
            });

        }


        // ----------------------------------------------------
        // Get connection
        // ----------------------------------------------------

        connection =
            await getConnection();


        // ----------------------------------------------------
        // Get user
        // ----------------------------------------------------

        const userResult =
            await connection.execute(
                `
                SELECT
                    EMAIL,
                    FORENAMES,
                    SURNAME

                FROM USERS

                WHERE USER_ID = :userId
                  AND IS_ACTIVE = 'Y'
                `,
                {
                    userId
                }
            );


        if (
            userResult.rows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message: 'User account not found'
            });

        }


        const userEmail =
            userResult.rows[0][0];


        const customerName =
            `${userResult.rows[0][1]} ${userResult.rows[0][2]}`;


        // ----------------------------------------------------
        // Build seat placeholders
        // ----------------------------------------------------

        const placeholders =
            parsedSeatIds
                .map(
                    (_, index) =>
                        `:seat${index}`
                )
                .join(', ');


        const seatBinds = {};


        parsedSeatIds.forEach(
            (seatId, index) => {

                seatBinds[
                    `seat${index}`
                ] = seatId;

            }
        );


        // ----------------------------------------------------
        // Get showtime
        // ----------------------------------------------------

        const showtimeResult =
            await connection.execute(
                `
                SELECT
                    ST.SHOWTIME_ID,
                    ST.MOVIE_ID,
                    M.TITLE,

                    ST.CINEMA_ID,
                    C.CINEMA_NAME,

                    ST.SCREEN_ID,
                    S.SCREEN_NAME,
                    S.CAPACITY,

                    ST.SHOW_DATE,
                    ST.START_TIME,
                    ST.END_TIME,

                    ST.TICKET_PRICE,
                    ST.STATUS,
                    ST.IS_ACTIVE

                FROM SHOWTIMES ST

                JOIN MOVIES M
                    ON M.MOVIE_ID =
                       ST.MOVIE_ID

                JOIN CINEMAS C
                    ON C.CINEMA_ID =
                       ST.CINEMA_ID

                JOIN SCREENS S
                    ON S.SCREEN_ID =
                       ST.SCREEN_ID

                WHERE ST.SHOWTIME_ID =
                      :showtimeId

                FOR UPDATE
                `,
                {
                    showtimeId:
                        parsedShowtimeId
                }
            );


        if (
            showtimeResult.rows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message: 'Showtime not found'
            });

        }


        const showtime =
            showtimeResult.rows[0];


        /*
            SHOWTIME INDEXES

            0  SHOWTIME_ID
            1  MOVIE_ID
            2  TITLE
            3  CINEMA_ID
            4  CINEMA_NAME
            5  SCREEN_ID
            6  SCREEN_NAME
            7  CAPACITY
            8  SHOW_DATE
            9  START_TIME
            10 END_TIME
            11 TICKET_PRICE
            12 STATUS
            13 IS_ACTIVE
        */


        const movieId =
            showtime[1];

        const movieTitle =
            showtime[2];

        const cinemaId =
            showtime[3];

        const cinemaName =
            showtime[4];

        const screenId =
            showtime[5];

        const screenName =
            showtime[6];

        const showDate =
            showtime[8];

        const startTime =
            showtime[9];

        const endTime =
            showtime[10];

        const fallbackTicketPrice =
            Number(showtime[11]);

        const showtimeStatus =
            showtime[12];

        const isActive =
            showtime[13];


        // ----------------------------------------------------
        // Check showtime
        // ----------------------------------------------------

        if (
            isActive !== 'Y' ||
            ![
                'SCHEDULED',
                'NOW_SHOWING'
            ].includes(showtimeStatus)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'This showtime is not available for booking'
            });

        }


        // ----------------------------------------------------
        // Validate seats
        // ----------------------------------------------------

        const seatsResult =
            await connection.execute(
                `
                SELECT
                    SEAT_ID,
                    SEAT_LABEL,
                    SEAT_TYPE

                FROM SEATS

                WHERE SCREEN_ID =
                      :screenId

                  AND IS_ACTIVE = 'Y'

                  AND SEAT_ID IN (
                      ${placeholders}
                  )
                `,
                {
                    screenId,
                    ...seatBinds
                }
            );


        if (
            seatsResult.rows.length !==
            parsedSeatIds.length
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'One or more selected seats are invalid for this screen'
            });

        }


        // ----------------------------------------------------
        // Check seats already booked
        // ----------------------------------------------------

        const bookedResult =
            await connection.execute(
                `
                SELECT
                    BS.SEAT_ID

                FROM BOOKING_SEATS BS

                JOIN BOOKINGS B
                    ON B.BOOKING_ID =
                       BS.BOOKING_ID

                WHERE BS.SHOWTIME_ID =
                      :showtimeId

                  AND BS.SEAT_ID IN (
                      ${placeholders}
                  )

                  AND (
                      B.STATUS = 'CONFIRMED'

                      OR

                      (
                          B.STATUS = 'PENDING'

                          AND (
                              B.EXPIRES_AT IS NULL
                              OR
                              B.EXPIRES_AT >
                                  CURRENT_TIMESTAMP
                          )
                      )
                  )
                `,
                {
                    showtimeId:
                        parsedShowtimeId,
                    ...seatBinds
                }
            );


        if (
            bookedResult.rows.length > 0
        ) {

            const bookedSeatIds =
                bookedResult.rows.map(
                    row => row[0]
                );


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
            We use TICKET_PRICES as the pricing source.

            If no matching ticket price exists,
            we fall back to SHOWTIMES.TICKET_PRICE.

            This keeps your existing bookings working
            while we transition to the pricing engine.
        */


        const priceResult =
            await connection.execute(
                `
                SELECT
                    PRICE_ID,
                    TICKET_TYPE,
                    AMOUNT,
                    CURRENCY,
                    DAY_TYPE,
                    SCREEN_ID

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

                      OR

                      DAY_TYPE =
                      CASE

                          WHEN TO_CHAR(
                              :showDate,
                              'DY',
                              'NLS_DATE_LANGUAGE=ENGLISH'
                          ) IN ('SAT', 'SUN')

                          THEN 'WEEKEND'

                          ELSE 'WEEKDAY'

                      END
                  )

                ORDER BY
                    TICKET_TYPE,

                    CASE
                        WHEN SCREEN_ID =
                             :screenId
                        THEN 1
                        ELSE 2
                    END
                `,
                {
                    cinemaId,
                    screenId,
                    showDate
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

            const ticketType =
                String(row[1])
                    .toUpperCase();


            /*
                Prefer the first matching
                price because the query
                orders screen-specific prices first.
            */

            if (
                !priceMap.has(ticketType)
            ) {

                priceMap.set(
                    ticketType,
                    {
                        priceId: row[0],
                        amount: Number(row[2]),
                        currency: row[3]
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
            At the moment the booking API only receives
            seatIds.

            Therefore we use the SEAT_TYPE as the ticket
            type when a matching price exists.

            If the seat type does not have a corresponding
            ticket price, we use ADULT.

            This allows the current frontend to continue
            working.
        */


        for (
            const seat
            of seatsResult.rows
        ) {

            const seatId =
                seat[0];

            const seatType =
                seat[2]
                    ? String(seat[2])
                        .toUpperCase()
                    : 'ADULT';


            let ticketType =
                seatType;


            let price =
                priceMap.get(
                    ticketType
                );


            /*
                If seat type isn't a ticket type,
                use ADULT pricing.
            */

            if (!price) {

                ticketType =
                    'ADULT';

                price =
                    priceMap.get(
                        'ADULT'
                    );

            }


            /*
                If there is still no price,
                fall back to SHOWTIMES price.
            */

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

            } else {

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
                await connection.execute(
                    `
                    SELECT
                        PROMOTION_ID,
                        PROMOTION_NAME,
                        DISCOUNT_TYPE,
                        DISCOUNT_VALUE,
                        MIN_TICKETS,
                        MAX_DISCOUNT

                    FROM PROMOTIONS

                    WHERE UPPER(PROMOTION_CODE) =
                          UPPER(:promotionCode)

                      AND CINEMA_ID =
                          :cinemaId

                      AND IS_ACTIVE = 'Y'

                      AND START_DATE <=
                          CURRENT_TIMESTAMP

                      AND END_DATE >=
                          CURRENT_TIMESTAMP

                    FOR UPDATE
                    `,
                    {
                        promotionCode:
                            String(
                                promotionCode
                            ).trim(),

                        cinemaId
                    }
                );


            if (
                promotionResult.rows.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Invalid or expired promotion code'

                });

            }


            const promo =
                promotionResult.rows[0];


            promotionId =
                promo[0];


            promotion = {

                promotionId:
                    promo[0],

                promotionName:
                    promo[1],

                discountType:
                    promo[2],

                discountValue:
                    Number(promo[3])

            };


            const minTickets =
                promo[4] === null
                    ? 0
                    : Number(promo[4]);


            const maxDiscount =
                promo[5] === null
                    ? null
                    : Number(promo[5]);


            // ------------------------------------------------
            // Minimum ticket requirement
            // ------------------------------------------------

            if (
                ticketQuantity <
                minTickets
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `This promotion requires at least ${minTickets} tickets`

                });

            }


            // ------------------------------------------------
            // Promotion targets
            // ------------------------------------------------

            const targetResult =
                await connection.execute(
                    `
                    SELECT
                        TARGET_TYPE,
                        TARGET_VALUE

                    FROM PROMOTION_TARGETS

                    WHERE PROMOTION_ID =
                          :promotionId
                    `,
                    {
                        promotionId
                    }
                );


            const targets =
                targetResult.rows;


            /*
                Validate each target.

                If your promotion system later supports
                more target types, we can extend this.
            */

            for (
                const target
                of targets
            ) {

                const targetType =
                    String(target[0])
                        .toUpperCase();

                const targetValue =
                    String(target[1])
                        .toUpperCase();


                if (
                    targetType ===
                    'MOVIE' &&
                    String(movieId) !==
                    targetValue
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            'This promotion does not apply to this movie'

                    });

                }


                if (
                    targetType ===
                    'CINEMA' &&
                    String(cinemaId) !==
                    targetValue
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            'This promotion does not apply to this cinema'

                    });

                }


                if (
                    targetType ===
                    'SCREEN' &&
                    String(screenId) !==
                    targetValue
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            'This promotion does not apply to this screen'

                    });

                }


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

                        return res.status(400).json({

                            success: false,

                            message:
                                'This promotion does not apply to the selected ticket type'

                        });

                    }

                }

            }


            // ------------------------------------------------
            // Calculate discount
            // ------------------------------------------------

            const discountType =
                String(promo[2])
                    .toUpperCase();


            const discountValue =
                Number(promo[3]);


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


            // Never allow negative totals

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

        const bookingResult =
            await connection.execute(
                `
                INSERT INTO BOOKINGS (
                    BOOKING_REF,
                    USER_ID,
                    SHOWTIME_ID,
                    TICKET_QUANTITY,
                    TICKET_PRICE,
                    TOTAL_AMOUNT,
                    STATUS,
                    PROMOTION_ID,
                    DISCOUNT_AMOUNT,
                    BOOKING_DATE,
                    CREATED_AT,
                    EXPIRES_AT
                )

                VALUES (
                    :bookingRef,
                    :userId,
                    :showtimeId,
                    :ticketQuantity,
                    :ticketPrice,
                    :totalAmount,
                    'PENDING',
                    :promotionId,
                    :discountAmount,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP +
                        INTERVAL '15' MINUTE
                )

                RETURNING
                    BOOKING_ID
                INTO
                    :bookingId
                `,
                {

                    bookingRef,

                    userId,

                    showtimeId:
                        parsedShowtimeId,

                    ticketQuantity,

                    /*
                        Keep the existing column populated.

                        Since individual prices may differ,
                        this is the average ticket price.
                    */

                    ticketPrice:
                        ticketQuantity > 0
                            ? Number(
                                (
                                    originalAmount /
                                    ticketQuantity
                                ).toFixed(2)
                            )
                            : 0,

                    totalAmount,

                    promotionId,

                    discountAmount,

                    bookingId: {

                        dir:
                            oracledb.BIND_OUT,

                        type:
                            oracledb.NUMBER

                    }

                }
            );


        const bookingId =
            bookingResult
                .outBinds
                .bookingId[0];


        // ====================================================
        // INSERT BOOKING TICKETS
        // ====================================================

        for (
            const ticket
            of bookingTickets
        ) {

            await connection.execute(
                `
                INSERT INTO BOOKING_TICKETS (
                    BOOKING_TICKET_ID,
                    BOOKING_ID,
                    TICKET_TYPE,
                    QUANTITY,
                    UNIT_PRICE,
                    SUBTOTAL,
                    CREATED_AT
                )

                VALUES (
                    SEQ_BOOKING_TICKETS.NEXTVAL,
                    :bookingId,
                    :ticketType,
                    :quantity,
                    :unitPrice,
                    :subtotal,
                    CURRENT_TIMESTAMP
                )
                `,
                {

                    bookingId,

                    ticketType:
                        ticket.ticketType,

                    quantity:
                        ticket.quantity,

                    unitPrice:
                        ticket.unitPrice,

                    subtotal:
                        ticket.subtotal

                }
            );

        }


        // ====================================================
        // INSERT BOOKING SEATS
        // ====================================================

        /*
            Each physical seat still gets its own
            BOOKING_SEATS record.

            We use the calculated price for that
            seat's ticket type.
        */

        for (
            const seat
            of seatsResult.rows
        ) {

            const seatId =
                seat[0];

            const seatType =
                seat[2]
                    ? String(seat[2])
                        .toUpperCase()
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


            await connection.execute(
                `
                INSERT INTO BOOKING_SEATS (
                    BOOKING_ID,
                    SHOWTIME_ID,
                    SEAT_ID,
                    TICKET_PRICE
                )

                VALUES (
                    :bookingId,
                    :showtimeId,
                    :seatId,
                    :ticketPrice
                )
                `,
                {

                    bookingId,

                    showtimeId:
                        parsedShowtimeId,

                    seatId,

                    ticketPrice:
                        seatTicketPrice

                }
            );

        }


        // ====================================================
        // COMMIT
        // ====================================================

        await connection.commit();


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


            /*
                Keep the old field for frontend
                compatibility.
            */

            ticketPrice:
                ticketQuantity > 0
                    ? Number(
                        (
                            originalAmount /
                            ticketQuantity
                        ).toFixed(2)
                    )
                    : 0,


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
                            row[0],

                        seatLabel:
                            row[1],

                        seatType:
                            row[2]

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


        return res.status(201).json({

            success: true,

            message:
                'Booking created successfully. Payment is required to confirm your booking.',

            booking:
                bookingResponse

        });


    } catch (error) {

        console.error(
            '❌ Create booking error:',
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


        // Oracle unique constraint

        if (
            error.errorNum === 1
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


    } finally {

        if (connection) {

            try {

                await connection.close();

            } catch (error) {

                console.error(
                    '❌ Error closing booking connection:',
                    error.message
                );

            }

        }

    }

}


// ============================================================
// GET MY BOOKINGS
// ============================================================

async function getMyBookings(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                B.BOOKING_ID,
                B.BOOKING_REF,
                B.SHOWTIME_ID,

                M.MOVIE_ID,
                M.TITLE,

                C.CINEMA_ID,
                C.CINEMA_NAME,

                S.SCREEN_ID,
                S.SCREEN_NAME,

                ST.SHOW_DATE,
                ST.START_TIME,
                ST.END_TIME,

                B.TICKET_QUANTITY,
                B.TICKET_PRICE,
                B.TOTAL_AMOUNT,

                B.STATUS,
                B.BOOKING_DATE

            FROM BOOKINGS B

            JOIN SHOWTIMES ST
                ON ST.SHOWTIME_ID = B.SHOWTIME_ID

            JOIN MOVIES M
                ON M.MOVIE_ID = ST.MOVIE_ID

            JOIN CINEMAS C
                ON C.CINEMA_ID = ST.CINEMA_ID

            JOIN SCREENS S
                ON S.SCREEN_ID = ST.SCREEN_ID

            WHERE B.USER_ID = :userId

            ORDER BY B.BOOKING_DATE DESC
            `,
            {
                userId
            }
        );

        const bookings = [];

        for (const row of result.rows) {

            const bookingId = row[0];

            const seatsResult = await connection.execute(
                `
                SELECT
                    BS.SEAT_ID,
                    SE.ROW_LABEL,
                    SE.SEAT_NUMBER,
                    SE.SEAT_LABEL,
                    SE.SEAT_TYPE,
                    BS.TICKET_PRICE

                FROM BOOKING_SEATS BS

                JOIN SEATS SE
                    ON SE.SEAT_ID = BS.SEAT_ID

                WHERE BS.BOOKING_ID = :bookingId

                ORDER BY
                    SE.ROW_LABEL,
                    SE.SEAT_NUMBER
                `,
                {
                    bookingId
                }
            );

            const seats = seatsResult.rows.map(seat => ({
                seatId: seat[0],
                rowLabel: seat[1],
                seatNumber: seat[2],
                seatLabel: seat[3],
                seatType: seat[4],
                ticketPrice: seat[5]
            }));

            bookings.push({

                bookingId: row[0],
                bookingRef: row[1],

                showtimeId: row[2],

                movie: {
                    movieId: row[3],
                    title: row[4]
                },

                cinema: {
                    cinemaId: row[5],
                    name: row[6]
                },

                screen: {
                    screenId: row[7],
                    name: row[8]
                },

                showDate: row[9],
                startTime: row[10],
                endTime: row[11],

                ticketQuantity: row[12],
                ticketPrice: row[13],
                totalAmount: row[14],

                status: row[15],

                bookingDate: row[16],

                seats
            });
        }

        res.json({
            success: true,
            count: bookings.length,
            bookings
        });

    } catch (error) {

        console.error(
            '❌ Get my bookings error:',
            error
        );

        res.status(500).json({
            success: false,
            message: 'Server error fetching bookings',
            error: error.message
        });

    } finally {

        if (connection) {

            try {
                await connection.close();
            } catch (error) {

                console.error(
                    '❌ Error closing booking connection:',
                    error.message
                );

            }
        }
    }
}


// ============================================================
// GET BOOKING BY ID
// ============================================================

async function getBookingById(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;
        const bookingId = Number(req.params.bookingId);

        if (!Number.isInteger(bookingId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID'
            });

        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                B.BOOKING_ID,
                B.BOOKING_REF,
                B.USER_ID,
                B.SHOWTIME_ID,

                M.MOVIE_ID,
                M.TITLE,
                M.POSTER_URL,

                C.CINEMA_ID,
                C.CINEMA_NAME,
                C.ADDRESS,
                C.CITY,

                S.SCREEN_ID,
                S.SCREEN_NAME,

                ST.SHOW_DATE,
                ST.START_TIME,
                ST.END_TIME,

                B.TICKET_QUANTITY,
                B.TICKET_PRICE,
                B.TOTAL_AMOUNT,

                B.STATUS,
                B.BOOKING_DATE,
                B.CREATED_AT,
                B.UPDATED_AT

            FROM BOOKINGS B

            JOIN SHOWTIMES ST
                ON ST.SHOWTIME_ID = B.SHOWTIME_ID

            JOIN MOVIES M
                ON M.MOVIE_ID = ST.MOVIE_ID

            JOIN CINEMAS C
                ON C.CINEMA_ID = ST.CINEMA_ID

            JOIN SCREENS S
                ON S.SCREEN_ID = ST.SCREEN_ID

            WHERE B.BOOKING_ID = :bookingId
              AND B.USER_ID = :userId
            `,
            {
                bookingId,
                userId
            }
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });

        }

        const row = result.rows[0];

        const seatsResult = await connection.execute(
            `
            SELECT
                BS.SEAT_ID,
                SE.ROW_LABEL,
                SE.SEAT_NUMBER,
                SE.SEAT_LABEL,
                SE.SEAT_TYPE,
                BS.TICKET_PRICE

            FROM BOOKING_SEATS BS

            JOIN SEATS SE
                ON SE.SEAT_ID = BS.SEAT_ID

            WHERE BS.BOOKING_ID = :bookingId

            ORDER BY
                SE.ROW_LABEL,
                SE.SEAT_NUMBER
            `,
            {
                bookingId
            }
        );

        const seats = seatsResult.rows.map(seat => ({
            seatId: seat[0],
            rowLabel: seat[1],
            seatNumber: seat[2],
            seatLabel: seat[3],
            seatType: seat[4],
            ticketPrice: seat[5]
        }));

        res.json({

            success: true,

            booking: {

                bookingId: row[0],
                bookingRef: row[1],

                userId: row[2],

                showtimeId: row[3],

                movie: {
                    movieId: row[4],
                    title: row[5],
                    posterUrl: row[6]
                },

                cinema: {
                    cinemaId: row[7],
                    name: row[8],
                    address: row[9],
                    city: row[10]
                },

                screen: {
                    screenId: row[11],
                    name: row[12]
                },

                showDate: row[13],
                startTime: row[14],
                endTime: row[15],

                ticketQuantity: row[16],
                ticketPrice: row[17],
                totalAmount: row[18],

                status: row[19],

                bookingDate: row[20],
                createdAt: row[21],
                updatedAt: row[22],

                seats
            }

        });

    } catch (error) {

        console.error(
            '❌ Get booking by ID error:',
            error
        );

        res.status(500).json({
            success: false,
            message: 'Server error fetching booking',
            error: error.message
        });

    } finally {

        if (connection) {

            try {
                await connection.close();
            } catch (error) {

                console.error(
                    '❌ Error closing booking connection:',
                    error.message
                );
            }
        }
    }
}


// ============================================================
// CANCEL BOOKING
// ============================================================

async function cancelBooking(req, res) {

    let connection;

    try {

        if (!req.user || !req.user.userId) {

            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });

        }

        const userId = req.user.userId;
        const bookingId = Number(req.params.bookingId);

        if (!Number.isInteger(bookingId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID'
            });

        }

        connection = await getConnection();

        const bookingResult = await connection.execute(
            `
            SELECT
                BOOKING_ID,
                BOOKING_REF,
                SHOWTIME_ID,
                STATUS
            FROM BOOKINGS
            WHERE BOOKING_ID = :bookingId
              AND USER_ID = :userId
            `,
            {
                bookingId,
                userId
            }
        );

        if (bookingResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });

        }

        const booking = bookingResult.rows[0];

        const bookingStatus = booking[3];

        if (bookingStatus === 'CANCELLED') {

            return res.status(400).json({
                success: false,
                message: 'Booking has already been cancelled'
            });

        }

        if (bookingStatus === 'COMPLETED') {

            return res.status(400).json({
                success: false,
                message: 'Completed bookings cannot be cancelled'
            });

        }

        await connection.execute(
            `
            UPDATE BOOKINGS
            SET
                STATUS = 'CANCELLED',
                UPDATED_AT = CURRENT_TIMESTAMP
            WHERE BOOKING_ID = :bookingId
              AND USER_ID = :userId
            `,
            {
                bookingId,
                userId
            }
        );

        await connection.commit();

        console.log(
            `✅ Booking cancelled: ${booking[1]} | User: ${userId}`
        );

        res.json({

            success: true,

            message: 'Booking cancelled successfully',

            booking: {
                bookingId: booking[0],
                bookingRef: booking[1],
                showtimeId: booking[2],
                status: 'CANCELLED'
            }

        });

    } catch (error) {

        console.error(
            '❌ Cancel booking error:',
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

        res.status(500).json({
            success: false,
            message: 'Server error cancelling booking',
            error: error.message
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
    createBooking,
    getMyBookings,
    getBookingById,
    cancelBooking
};