const pool = require('../config/database');

const {
    sendBookingConfirmation
} = require('../utils/emailService');


// ============================================================
// CREATE PAYMENT
// ============================================================

async function createPayment(req, res) {

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
        // Get database client
        // ----------------------------------------------------

        client = await pool.connect();

        // ----------------------------------------------------
        // Start transaction
        // ----------------------------------------------------

        await client.query('BEGIN');

        // ----------------------------------------------------
        // Get booking
        // ----------------------------------------------------

        const bookingResult =
            await client.query(
                `
                SELECT
                    b.booking_id,
                    b.booking_ref,
                    b.user_id,
                    b.showtime_id,
                    b.ticket_quantity,
                    b.ticket_price,
                    b.total_amount,
                    b.status,

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
                    st.end_time

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

                WHERE b.booking_id = $1
                  AND b.user_id = $2
                `,
                [
                    parsedBookingId,
                    userId
                ]
            );

        if (
            bookingResult.rows.length === 0
        ) {

            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });

        }

        const booking =
            bookingResult.rows[0];

        // ----------------------------------------------------
        // Make sure booking is payable
        // ----------------------------------------------------

        const bookingStatus =
            booking.status;

        if (
            bookingStatus !== 'PENDING'
        ) {

            await client.query('ROLLBACK');

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

        if (
            userResult.rows.length === 0
        ) {

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
            `${user.forenames} ${user.surname}`;

        // ----------------------------------------------------
        // Check for existing successful payment
        // ----------------------------------------------------

        const existingPayment =
            await client.query(
                `
                SELECT
                    payment_id,
                    payment_reference,
                    status

                FROM payments

                WHERE booking_id = $1
                  AND status = 'SUCCESS'
                `,
                [parsedBookingId]
            );

        if (
            existingPayment.rows.length > 0
        ) {

            await client.query('ROLLBACK');

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
            Number(booking.total_amount);

        if (
            !Number.isFinite(amount) ||
            amount < 0
        ) {

            await client.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message:
                    'Invalid booking amount'
            });

        }

        // ----------------------------------------------------
        // Create payment
        // ----------------------------------------------------

        const paymentResult =
            await client.query(
                `
                INSERT INTO payments (
                    booking_id,
                    payment_reference,
                    amount,
                    currency,
                    payment_method,
                    status
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    'GHS',
                    $4,
                    'PENDING'
                )

                RETURNING payment_id
                `,
                [
                    parsedBookingId,
                    paymentReference,
                    amount,
                    paymentMethod
                ]
            );

        const paymentId =
            paymentResult.rows[0].payment_id;

        // ----------------------------------------------------
        // MOCK PAYMENT
        //
        // For now we automatically succeed.
        //
        // Later this section can be replaced with
        // the actual payment provider.
        // ----------------------------------------------------

        const mockTransactionReference =
            'MOCK-' +
            Date.now()
                .toString();

        await client.query(
            `
            UPDATE payments

            SET
                status = 'SUCCESS',
                transaction_reference = $1,
                payment_date = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP

            WHERE payment_id = $2
            `,
            [
                mockTransactionReference,
                paymentId
            ]
        );

        // ----------------------------------------------------
        // Confirm booking
        // ----------------------------------------------------

        const bookingUpdate =
            await client.query(
                `
                UPDATE bookings

                SET
                    status = 'CONFIRMED',
                    updated_at = CURRENT_TIMESTAMP

                WHERE booking_id = $1
                  AND user_id = $2
                  AND status = 'PENDING'
                `,
                [
                    parsedBookingId,
                    userId
                ]
            );

        // ----------------------------------------------------
        // Make sure booking was actually confirmed
        // ----------------------------------------------------

        if (
            bookingUpdate.rowCount !== 1
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
            await client.query(
                `
                INSERT INTO tickets (
                    booking_id,
                    ticket_code,
                    qr_code_data,
                    status
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    'VALID'
                )

                RETURNING ticket_id
                `,
                [
                    parsedBookingId,
                    ticketCode,
                    qrCodeData
                ]
            );

        const ticketId =
            ticketResult.rows[0].ticket_id;

        console.log(
            `🎟️ Ticket created: ${ticketCode}`
        );

        // ----------------------------------------------------
        // Get booked seats
        //
        // Still inside the transaction so we have the
        // exact seats associated with this booking.
        // ----------------------------------------------------

        const seatsResult =
            await client.query(
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
                    ON se.seat_id = bs.seat_id

                WHERE bs.booking_id = $1

                ORDER BY
                    se.row_label,
                    se.seat_number
                `,
                [parsedBookingId]
            );

        const seats =
            seatsResult.rows.map(seat => ({

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

            }));

        // ----------------------------------------------------
        // Commit payment + booking + ticket
        // ----------------------------------------------------

        await client.query('COMMIT');

        console.log(
            `✅ Payment successful: ${paymentReference}`
        );

        // ----------------------------------------------------
        // Release database client
        //
        // Email happens AFTER COMMIT.
        // ----------------------------------------------------

        client.release();
        client = null;

        // ----------------------------------------------------
        // Send confirmation email
        //
        // IMPORTANT:
        //
        // If email fails, payment remains successful.
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
                            booking.booking_id,

                        bookingRef:
                            booking.booking_ref,

                        showtimeId:
                            booking.showtime_id,

                        movie: {

                            movieId:
                                booking.movie_id,

                            title:
                                booking.title,

                            posterUrl:
                                booking.poster_url

                        },

                        cinema: {

                            cinemaId:
                                booking.cinema_id,

                            name:
                                booking.cinema_name,

                            address:
                                booking.address,

                            city:
                                booking.city

                        },

                        screen: {

                            screenId:
                                booking.screen_id,

                            name:
                                booking.screen_name

                        },

                        showDate:
                            booking.show_date,

                        startTime:
                            booking.start_time,

                        endTime:
                            booking.end_time,

                        ticketQuantity:
                            booking.ticket_quantity,

                        ticketPrice:
                            booking.ticket_price,

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
                    booking.booking_id,

                bookingRef:
                    booking.booking_ref,

                showtimeId:
                    booking.showtime_id,

                movie: {

                    movieId:
                        booking.movie_id,

                    title:
                        booking.title,

                    posterUrl:
                        booking.poster_url

                },

                cinema: {

                    cinemaId:
                        booking.cinema_id,

                    name:
                        booking.cinema_name,

                    address:
                        booking.address,

                    city:
                        booking.city

                },

                screen: {

                    screenId:
                        booking.screen_id,

                    name:
                        booking.screen_name

                },

                showDate:
                    booking.show_date,

                startTime:
                    booking.start_time,

                endTime:
                    booking.end_time,

                ticketQuantity:
                    booking.ticket_quantity,

                ticketPrice:
                    booking.ticket_price,

                totalAmount:
                    amount,

                status:
                    'CONFIRMED'

            },

            ticket: {

                ticketId,

                ticketCode,

                qrCodeData,

                status:
                    'VALID'

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

        // ----------------------------------------------------
        // Rollback transaction
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

        // ----------------------------------------------------
        // PostgreSQL duplicate constraint
        // ----------------------------------------------------

        if (error.code === '23505') {

            return res.status(409).json({

                success: false,

                message:
                    'A payment or ticket already exists for this booking'

            });

        }

        return res.status(500).json({

            success: false,

            message:
                'Server error creating payment',

            error:
                error.message

        });

    } finally {

        // ----------------------------------------------------
        // Release client if it has not already been released
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
    createPayment
};