const { getConnection } = require('../config/database');

const oracledb = require('oracledb');

const {
    sendBookingConfirmation
} = require('../utils/emailService');


// ============================================================
// CREATE PAYMENT
// ============================================================

async function createPayment(req, res) {

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
            bookingId,
            paymentMethod
        } = req.body;

        const parsedBookingId =
            Number(bookingId);

        if (!Number.isInteger(parsedBookingId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID'
            });

        }

        if (!paymentMethod) {

            return res.status(400).json({
                success: false,
                message: 'Payment method is required'
            });

        }

        const allowedMethods = [
            'MOBILE_MONEY',
            'CARD',
            'BANK_TRANSFER',
            'CASH'
        ];

        if (
            !allowedMethods.includes(
                paymentMethod
            )
        ) {

            return res.status(400).json({
                success: false,
                message: 'Invalid payment method'
            });

        }

        // ----------------------------------------------------
        // Database connection
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // Get booking
        // ----------------------------------------------------

        const bookingResult =
            await connection.execute(
                `
                SELECT
                    B.BOOKING_ID,
                    B.BOOKING_REF,
                    B.USER_ID,
                    B.SHOWTIME_ID,
                    B.TICKET_QUANTITY,
                    B.TICKET_PRICE,
                    B.TOTAL_AMOUNT,
                    B.STATUS,

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
                    ST.END_TIME

                FROM BOOKINGS B

                JOIN SHOWTIMES ST
                    ON ST.SHOWTIME_ID =
                       B.SHOWTIME_ID

                JOIN MOVIES M
                    ON M.MOVIE_ID =
                       ST.MOVIE_ID

                JOIN CINEMAS C
                    ON C.CINEMA_ID =
                       ST.CINEMA_ID

                JOIN SCREENS S
                    ON S.SCREEN_ID =
                       ST.SCREEN_ID

                WHERE B.BOOKING_ID =
                      :bookingId

                  AND B.USER_ID =
                      :userId
                `,
                {
                    bookingId:
                        parsedBookingId,

                    userId
                }
            );

        if (
            bookingResult.rows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });

        }

        const booking =
            bookingResult.rows[0];

        /*
            INDEXES

            0  BOOKING_ID
            1  BOOKING_REF
            2  USER_ID
            3  SHOWTIME_ID
            4  TICKET_QUANTITY
            5  TICKET_PRICE
            6  TOTAL_AMOUNT
            7  STATUS
            8  MOVIE_ID
            9  MOVIE TITLE
            10 POSTER_URL
            11 CINEMA_ID
            12 CINEMA_NAME
            13 ADDRESS
            14 CITY
            15 SCREEN_ID
            16 SCREEN_NAME
            17 SHOW_DATE
            18 START_TIME
            19 END_TIME
        */

        const bookingStatus =
            booking[7];

        // ----------------------------------------------------
        // Make sure booking is payable
        // ----------------------------------------------------

        if (
            bookingStatus !== 'PENDING'
        ) {

            return res.status(400).json({
                success: false,
                message:
                    `Booking cannot be paid because its status is ${bookingStatus}`
            });

        }

        // ----------------------------------------------------
        // Get customer information
        // ----------------------------------------------------

        const userResult =
            await connection.execute(
                `
                SELECT
                    EMAIL,
                    FORENAMES,
                    SURNAME

                FROM USERS

                WHERE USER_ID =
                      :userId

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
        // Check for existing successful payment
        // ----------------------------------------------------

        const existingPayment =
            await connection.execute(
                `
                SELECT
                    PAYMENT_ID,
                    PAYMENT_REFERENCE,
                    STATUS

                FROM PAYMENTS

                WHERE BOOKING_ID =
                      :bookingId

                  AND STATUS = 'SUCCESS'
                `,
                {
                    bookingId:
                        parsedBookingId
                }
            );

        if (
            existingPayment.rows.length > 0
        ) {

            return res.status(409).json({
                success: false,
                message:
                    'This booking has already been paid'
            });

        }

        // ----------------------------------------------------
        // Generate payment reference
        // ----------------------------------------------------

        const paymentReference =
            'PAY-' +
            Date.now()
                .toString()
                .slice(-8) +
            '-' +
            Math.random()
                .toString(36)
                .substring(2, 6)
                .toUpperCase();

        // ----------------------------------------------------
        // Get amount
        // ----------------------------------------------------

        const amount =
            Number(booking[6]);

        // ----------------------------------------------------
        // Create payment
        // ----------------------------------------------------

        const paymentResult =
            await connection.execute(
                `
                INSERT INTO PAYMENTS (
                    BOOKING_ID,
                    PAYMENT_REFERENCE,
                    AMOUNT,
                    CURRENCY,
                    PAYMENT_METHOD,
                    STATUS
                )

                VALUES (
                    :bookingId,
                    :paymentReference,
                    :amount,
                    'GHS',
                    :paymentMethod,
                    'PENDING'
                )

                RETURNING PAYMENT_ID
                INTO :paymentId
                `,
                {
                    bookingId:
                        parsedBookingId,

                    paymentReference,

                    amount,

                    paymentMethod,

                    paymentId: {

                        dir:
                            oracledb.BIND_OUT,

                        type:
                            oracledb.NUMBER

                    }
                }
            );

        const paymentId =
            paymentResult.outBinds
                .paymentId[0];

        // ----------------------------------------------------
        // MOCK PAYMENT
        //
        // For now we automatically succeed.
        // Later this section will be replaced with
        // the actual payment provider.
        // ----------------------------------------------------

        const mockTransactionReference =
            'MOCK-' +
            Date.now()
                .toString();

        await connection.execute(
            `
            UPDATE PAYMENTS

            SET
                STATUS =
                    'SUCCESS',

                TRANSACTION_REFERENCE =
                    :transactionReference,

                PAYMENT_DATE =
                    CURRENT_TIMESTAMP,

                UPDATED_AT =
                    CURRENT_TIMESTAMP

            WHERE PAYMENT_ID =
                  :paymentId
            `,
            {
                paymentId,

                transactionReference:
                    mockTransactionReference
            }
        );

        // ----------------------------------------------------
        // Confirm booking
        // ----------------------------------------------------

        const bookingUpdate =
            await connection.execute(
                `
                UPDATE BOOKINGS

                SET
                    STATUS =
                        'CONFIRMED',

                    UPDATED_AT =
                        CURRENT_TIMESTAMP

                WHERE BOOKING_ID =
                      :bookingId

                  AND USER_ID =
                      :userId

                  AND STATUS =
                      'PENDING'
                `,
                {
                    bookingId:
                        parsedBookingId,

                    userId
                }
            );

        // ----------------------------------------------------
        // Make sure booking was actually confirmed
        // ----------------------------------------------------

        if (
            bookingUpdate.rowsAffected !== 1
        ) {

            throw new Error(
                'Unable to confirm booking after successful payment'
            );

        }

        // ----------------------------------------------------
// Create digital ticket
// ----------------------------------------------------

const ticketCode =
    'TKT-' +
    Date.now()
        .toString()
        .slice(-8) +
    '-' +
    Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

const qrCodeData =
    `SAVANNAH:TICKET:${ticketCode}`;

const ticketResult =
    await connection.execute(
        `
        INSERT INTO TICKETS (
            BOOKING_ID,
            TICKET_CODE,
            QR_CODE_DATA,
            STATUS
        )

        VALUES (
            :bookingId,
            :ticketCode,
            :qrCodeData,
            'VALID'
        )

        RETURNING TICKET_ID
        INTO :ticketId
        `,
        {
            bookingId:
                parsedBookingId,

            ticketCode,

            qrCodeData,

            ticketId: {
                dir:
                    oracledb.BIND_OUT,

                type:
                    oracledb.NUMBER
            }
        }
    );

const ticketId =
    ticketResult.outBinds
        .ticketId[0];

console.log(
    `🎟️ Ticket created: ${ticketCode}`
);

        // ----------------------------------------------------
        // Commit payment + booking
        // ----------------------------------------------------

        await connection.commit();

        console.log(
            `✅ Payment successful: ${paymentReference}`
        );

        // ----------------------------------------------------
        // Send confirmation email
        //
        // IMPORTANT:
        // Email happens AFTER COMMIT.
        //
        // If email fails, payment remains successful.
        // ----------------------------------------------------

        // ----------------------------------------------------
// Get booked seats for confirmation email
// ----------------------------------------------------

const seatsResult =
    await connection.execute(
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
            bookingId:
                parsedBookingId
        }
    );

const seats =
    seatsResult.rows.map(seat => ({

        seatId:
            seat[0],

        rowLabel:
            seat[1],

        seatNumber:
            seat[2],

        seatLabel:
            seat[3],

        seatType:
            seat[4],

        ticketPrice:
            seat[5]

    }));

// ----------------------------------------------------
// Send confirmation email
// ----------------------------------------------------

let emailSent = false;

try {

    const emailResult =
        await sendBookingConfirmation({

            to:
                userEmail,

            customerName,

            booking: {

    bookingId:
        booking[0],

    bookingRef:
        booking[1],

    showtimeId:
        booking[3],

    movie: {

        movieId:
            booking[8],

        title:
            booking[9],

        posterUrl:
            booking[10]

    },

    cinema: {

        cinemaId:
            booking[11],

        name:
            booking[12],

        address:
            booking[13],

        city:
            booking[14]

    },

    screen: {

        screenId:
            booking[15],

        name:
            booking[16]

    },

    showDate:
        booking[17],

    startTime:
        booking[18],

    endTime:
        booking[19],

    ticketQuantity:
        booking[4],

    ticketPrice:
        booking[5],

    totalAmount:
        amount,

    status:
        'CONFIRMED',

    seats,

    ticket: {

        ticketId,

        ticketCode,

        qrCodeData,

        status:
            'VALID'

    }

}

        });

    emailSent =
        emailResult?.sent === true;

    console.log(
        emailSent
            ? `📧 Booking confirmation email sent to ${userEmail}`
            : `⚠️ Booking email was not confirmed as sent to ${userEmail}`
    );

} catch (emailError) {

    console.error(
        '⚠️ Payment succeeded but confirmation email failed:',
        emailError
    );

}

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.status(201).json({

            success: true,

            message:
                'Payment successful and booking confirmed',

            payment: {

                paymentId,

                paymentReference,

                bookingId:
                    parsedBookingId,

                amount,

                currency:
                    'GHS',

                paymentMethod,

                transactionReference:
                    mockTransactionReference,

                status:
                    'SUCCESS'

            },

            booking: {

                bookingId:
                    booking[0],

                bookingRef:
                    booking[1],

                showtimeId:
                    booking[3],

                movie: {

                    movieId:
                        booking[8],

                    title:
                        booking[9],

                    posterUrl:
                        booking[10]

                },

                cinema: {

                    cinemaId:
                        booking[11],

                    name:
                        booking[12],

                    address:
                        booking[13],

                    city:
                        booking[14]

                },

                screen: {

                    screenId:
                        booking[15],

                    name:
                        booking[16]

                },

                showDate:
                    booking[17],

                startTime:
                    booking[18],

                endTime:
                    booking[19],

                ticketQuantity:
                    booking[4],

                ticketPrice:
                    booking[5],

                totalAmount:
                    amount,

                status:
                    'CONFIRMED'

            },

            ticket: {

                ticketId,

                ticketCode,

                qrCodeData,

                status: 'VALID'

            },

            email: {

                sent:
                    emailSent

            }

        });

    } catch (error) {

        console.error(
            '❌ Create payment error:',
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
                'Server error creating payment',

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
// EXPORT
// ============================================================

module.exports = {
    createPayment
};
