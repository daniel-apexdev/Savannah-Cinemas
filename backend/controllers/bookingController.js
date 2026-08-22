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
            seatIds
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

        const parsedShowtimeId = Number(showtimeId);

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
        // Get database connection
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // Get user information
        // ----------------------------------------------------

        const userResult = await connection.execute(
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

        if (userResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'User account not found'
            });

        }

        const userEmail = userResult.rows[0][0];

        const customerName =
            `${userResult.rows[0][1]} ${userResult.rows[0][2]}`;

        // ----------------------------------------------------
        // Start transaction
        // ----------------------------------------------------

        await connection.execute(
            `SAVEPOINT BOOKING_START`
        );

        // ----------------------------------------------------
        // Get showtime
        // ----------------------------------------------------

        const showtimeResult = await connection.execute(
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
                ON M.MOVIE_ID = ST.MOVIE_ID

            JOIN CINEMAS C
                ON C.CINEMA_ID = ST.CINEMA_ID

            JOIN SCREENS S
                ON S.SCREEN_ID = ST.SCREEN_ID

            WHERE ST.SHOWTIME_ID = :showtimeId
            `,
            {
                showtimeId: parsedShowtimeId
            }
        );

        if (showtimeResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Showtime not found'
            });

        }

        const showtime = showtimeResult.rows[0];

        /*
            SHOWTIME SELECT INDEXES

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

        const screenId = showtime[5];

        const showDate = showtime[8];
        const startTime = showtime[9];
        const endTime = showtime[10];

        const ticketPrice = Number(showtime[11]);

        const showtimeStatus = showtime[12];

        const isActive = showtime[13];

        // ----------------------------------------------------
        // Make sure showtime can be booked
        // ----------------------------------------------------

        if (
            isActive !== 'Y' ||
            !['SCHEDULED', 'NOW_SHOWING'].includes(
                showtimeStatus
            )
        ) {

            return res.status(400).json({
                success: false,
                message: 'This showtime is not available for booking'
            });

        }

        // ----------------------------------------------------
        // Validate seats belong to the screen
        // ----------------------------------------------------

        const placeholders = parsedSeatIds
            .map((_, index) => `:seat${index}`)
            .join(', ');

        const seatBinds = {};

        parsedSeatIds.forEach(
            (seatId, index) => {
                seatBinds[`seat${index}`] = seatId;
            }
        );

        const seatsResult = await connection.execute(
            `
            SELECT
                SEAT_ID,
                SEAT_LABEL,
                SEAT_TYPE

            FROM SEATS

            WHERE SCREEN_ID = :screenId
              AND IS_ACTIVE = 'Y'
              AND SEAT_ID IN (${placeholders})
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
                message: 'One or more selected seats are invalid for this screen'
            });

        }

        // ----------------------------------------------------
        // Check seats already booked
        // ----------------------------------------------------

        const bookedResult = await connection.execute(
            `
            SELECT
                BS.SEAT_ID

            FROM BOOKING_SEATS BS

            JOIN BOOKINGS B
                ON B.BOOKING_ID = BS.BOOKING_ID

            WHERE BS.SHOWTIME_ID = :showtimeId
              AND BS.SEAT_ID IN (${placeholders})
              AND B.STATUS IN ('PENDING', 'CONFIRMED')
            `,
            {
                showtimeId: parsedShowtimeId,
                ...seatBinds
            }
        );

        if (bookedResult.rows.length > 0) {

            const bookedSeatIds =
                bookedResult.rows.map(row => row[0]);

            return res.status(409).json({
                success: false,
                message: 'One or more selected seats are already booked',
                bookedSeatIds
            });

        }

        // ----------------------------------------------------
        // Calculate total
        // ----------------------------------------------------

        const ticketQuantity =
            parsedSeatIds.length;

        const totalAmount =
            ticketPrice * ticketQuantity;

        // ----------------------------------------------------
        // Generate booking reference
        // ----------------------------------------------------

        const bookingRef =
            'SC-' +
            Date.now().toString().slice(-8) +
            '-' +
            Math.random()
                .toString(36)
                .substring(2, 6)
                .toUpperCase();

        // ----------------------------------------------------
        // Create booking
        // ----------------------------------------------------

        const bookingResult = await connection.execute(
            `
            INSERT INTO BOOKINGS (
                BOOKING_REF,
                USER_ID,
                SHOWTIME_ID,
                TICKET_QUANTITY,
                TICKET_PRICE,
                TOTAL_AMOUNT,
                STATUS
            )
            VALUES (
                :bookingRef,
                :userId,
                :showtimeId,
                :ticketQuantity,
                :ticketPrice,
                :totalAmount,
                'PENDING'
            )
            RETURNING BOOKING_ID INTO :bookingId
            `,
            {
                bookingRef,
                userId,
                showtimeId: parsedShowtimeId,
                ticketQuantity,
                ticketPrice,
                totalAmount,

                bookingId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            }
        );

        const bookingId =
            bookingResult.outBinds.bookingId[0];

        // ----------------------------------------------------
        // Insert booking seats
        // ----------------------------------------------------

        for (const seatId of parsedSeatIds) {

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
                    showtimeId: parsedShowtimeId,
                    seatId,
                    ticketPrice
                }
            );

        }

        // ----------------------------------------------------
        // Commit booking
        // ----------------------------------------------------

        await connection.commit();

        console.log(
            `✅ Booking created: ${bookingRef} | User: ${userId}`
        );

        // ----------------------------------------------------
        // Build booking response
        // ----------------------------------------------------

        const bookingResponse = {

            bookingId,
            bookingRef,

            userId,

            showtimeId: parsedShowtimeId,

            movie: {
                movieId: showtime[1],
                title: showtime[2]
            },

            cinema: {
                cinemaId: showtime[3],
                name: showtime[4]
            },

            screen: {
                screenId: showtime[5],
                name: showtime[6]
            },

            showDate,
            startTime,
            endTime,

            ticketQuantity,
            ticketPrice,
            totalAmount,

            status: 'PENDING',

            seatIds: parsedSeatIds,

            seats: seatsResult.rows.map(row => ({
                seatId: row[0],
                seatLabel: row[1],
                seatType: row[2]
            }))
        };


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        res.status(201).json({

            success: true,

            message: 'Booking created successfully. Payment is required to confirm your booking.',

            booking: bookingResponse,


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

        // Oracle unique constraint violation
        // protects us against concurrent booking attempts.

        if (error.errorNum === 1) {

            return res.status(409).json({
                success: false,
                message: 'One or more selected seats were just booked by another customer'
            });

        }

        res.status(500).json({
            success: false,
            message: 'Server error creating booking',
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