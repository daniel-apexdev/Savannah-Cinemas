const pool = require('../config/database');


// ============================================================
// VERIFY TICKET
// ============================================================

async function verifyTicket(req, res) {

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

        // ----------------------------------------------------
        // Request data
        // ----------------------------------------------------

        const { ticketCode } = req.body;

        if (!ticketCode) {

            return res.status(400).json({
                success: false,
                message: 'Ticket code is required'
            });

        }

        const normalizedTicketCode =
            String(ticketCode)
                .trim()
                .toUpperCase();


        // ----------------------------------------------------
        // Get ticket
        // ----------------------------------------------------

        const ticketResult = await pool.query(
            `
            SELECT
                t.ticket_id,
                t.ticket_code,
                t.qr_code_data,
                t.status AS ticket_status,

                b.booking_id,
                b.booking_ref,
                b.user_id,
                b.ticket_quantity,
                b.ticket_price,
                b.total_amount,
                b.status AS booking_status,

                st.showtime_id,
                st.show_date,
                st.start_time,
                st.end_time,
                st.status AS showtime_status,

                m.movie_id,
                m.title AS movie_title,

                c.cinema_id,
                c.cinema_name,

                s.screen_id,
                s.screen_name

            FROM tickets t

            JOIN bookings b
                ON b.booking_id = t.booking_id

            JOIN showtimes st
                ON st.showtime_id = b.showtime_id

            JOIN movies m
                ON m.movie_id = st.movie_id

            JOIN cinemas c
                ON c.cinema_id = st.cinema_id

            JOIN screens s
                ON s.screen_id = st.screen_id

            WHERE UPPER(t.ticket_code) = $1
            `,
            [normalizedTicketCode]
        );


        // ----------------------------------------------------
        // Ticket not found
        // ----------------------------------------------------

        if (ticketResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                valid: false,
                message: 'Ticket not found'
            });

        }


        const row = ticketResult.rows[0];

        const ticketId =
            row.ticket_id;

        const ticketStatus =
            row.ticket_status;

        const bookingStatus =
            row.booking_status;

        const showtimeStatus =
            row.showtime_status;


        // ----------------------------------------------------
        // Get seats
        // ----------------------------------------------------

        const seatsResult = await pool.query(
            `
            SELECT
                bs.seat_id,
                se.row_label,
                se.seat_number,
                se.seat_label,
                se.seat_type

            FROM booking_seats bs

            JOIN seats se
                ON se.seat_id = bs.seat_id

            WHERE bs.booking_id = $1

            ORDER BY
                se.row_label,
                se.seat_number
            `,
            [row.booking_id]
        );


        const seats = seatsResult.rows.map(seat => ({

            seatId:
                seat.seat_id,

            rowLabel:
                seat.row_label,

            seatNumber:
                seat.seat_number,

            seatLabel:
                seat.seat_label,

            seatType:
                seat.seat_type

        }));


        // ----------------------------------------------------
        // Ticket already used
        // ----------------------------------------------------

        if (ticketStatus === 'USED') {

            return res.status(409).json({

                success: true,

                valid: false,

                message:
                    'Ticket has already been used',

                ticket: {

                    ticketId,

                    ticketCode:
                        row.ticket_code,

                    status:
                        ticketStatus

                }

            });

        }


        // ----------------------------------------------------
        // Ticket cancelled
        // ----------------------------------------------------

        if (ticketStatus === 'CANCELLED') {

            return res.status(409).json({

                success: true,

                valid: false,

                message:
                    'Ticket has been cancelled',

                ticket: {

                    ticketId,

                    ticketCode:
                        row.ticket_code,

                    status:
                        ticketStatus

                }

            });

        }


        // ----------------------------------------------------
        // Ticket expired
        // ----------------------------------------------------

        if (ticketStatus === 'EXPIRED') {

            return res.status(409).json({

                success: true,

                valid: false,

                message:
                    'Ticket has expired',

                ticket: {

                    ticketId,

                    ticketCode:
                        row.ticket_code,

                    status:
                        ticketStatus

                }

            });

        }


        // ----------------------------------------------------
        // Booking must be confirmed
        // ----------------------------------------------------

        if (bookingStatus !== 'CONFIRMED') {

            return res.status(409).json({

                success: true,

                valid: false,

                message:
                    `Booking is not confirmed. Current status: ${bookingStatus}`,

                ticket: {

                    ticketId,

                    ticketCode:
                        row.ticket_code,

                    status:
                        ticketStatus,

                    bookingStatus

                }

            });

        }


        // ----------------------------------------------------
        // Showtime must be active
        // ----------------------------------------------------

        if (
            ![
                'SCHEDULED',
                'NOW_SHOWING'
            ].includes(showtimeStatus)
        ) {

            return res.status(409).json({

                success: true,

                valid: false,

                message:
                    `Showtime is not available. Current status: ${showtimeStatus}`,

                ticket: {

                    ticketId,

                    ticketCode:
                        row.ticket_code,

                    status:
                        ticketStatus,

                    bookingStatus,

                    showtimeStatus

                }

            });

        }


        // ----------------------------------------------------
        // Ticket is valid
        // ----------------------------------------------------

        return res.json({

            success: true,

            valid: true,

            message:
                'Ticket is valid',

            ticket: {

                ticketId,

                ticketCode:
                    row.ticket_code,

                qrCodeData:
                    row.qr_code_data,

                status:
                    ticketStatus,

                booking: {

                    bookingId:
                        row.booking_id,

                    bookingRef:
                        row.booking_ref,

                    ticketQuantity:
                        row.ticket_quantity,

                    ticketPrice:
                        row.ticket_price,

                    totalAmount:
                        row.total_amount,

                    status:
                        bookingStatus

                },

                movie: {

                    movieId:
                        row.movie_id,

                    title:
                        row.movie_title

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

                showtime: {

                    showtimeId:
                        row.showtime_id,

                    showDate:
                        row.show_date,

                    startTime:
                        row.start_time,

                    endTime:
                        row.end_time,

                    status:
                        showtimeStatus

                },

                seats

            }

        });

    } catch (error) {

        console.error(
            '❌ Verify ticket error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error verifying ticket',

            error:
                error.message

        });

    }

}


// ============================================================
// USE TICKET
// ============================================================

async function useTicket(req, res) {

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

        // ----------------------------------------------------
        // Ticket ID
        // ----------------------------------------------------

        const ticketId =
            Number(req.params.ticketId);

        if (!Number.isInteger(ticketId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid ticket ID'
            });

        }


        // ----------------------------------------------------
        // Get PostgreSQL client
        // ----------------------------------------------------

        client = await pool.connect();

        await client.query('BEGIN');


        // ----------------------------------------------------
        // Get ticket
        // ----------------------------------------------------

        const ticketResult = await client.query(
            `
            SELECT
                t.ticket_id,
                t.ticket_code,
                t.status AS ticket_status,

                b.booking_id,
                b.booking_ref,
                b.status AS booking_status,

                m.title AS movie_title,

                c.cinema_name,

                s.screen_name,

                st.show_date,
                st.start_time,
                st.status AS showtime_status

            FROM tickets t

            JOIN bookings b
                ON b.booking_id = t.booking_id

            JOIN showtimes st
                ON st.showtime_id = b.showtime_id

            JOIN movies m
                ON m.movie_id = st.movie_id

            JOIN cinemas c
                ON c.cinema_id = st.cinema_id

            JOIN screens s
                ON s.screen_id = st.screen_id

            WHERE t.ticket_id = $1
            `,
            [ticketId]
        );


        // ----------------------------------------------------
        // Ticket not found
        // ----------------------------------------------------

        if (ticketResult.rows.length === 0) {

            await client.query('ROLLBACK');

            return res.status(404).json({

                success: false,

                message:
                    'Ticket not found'

            });

        }


        const row =
            ticketResult.rows[0];


        // ----------------------------------------------------
        // Check ticket status
        // ----------------------------------------------------

        if (row.ticket_status === 'USED') {

            await client.query('ROLLBACK');

            return res.status(409).json({

                success: false,

                message:
                    'Ticket has already been used',

                ticket: {

                    ticketId:
                        row.ticket_id,

                    ticketCode:
                        row.ticket_code,

                    status:
                        row.ticket_status

                }

            });

        }


        if (row.ticket_status !== 'VALID') {

            await client.query('ROLLBACK');

            return res.status(409).json({

                success: false,

                message:
                    `Ticket cannot be used because its status is ${row.ticket_status}`,

                ticket: {

                    ticketId:
                        row.ticket_id,

                    ticketCode:
                        row.ticket_code,

                    status:
                        row.ticket_status

                }

            });

        }


        // ----------------------------------------------------
        // Booking must be confirmed
        // ----------------------------------------------------

        if (row.booking_status !== 'CONFIRMED') {

            await client.query('ROLLBACK');

            return res.status(409).json({

                success: false,

                message:
                    'Booking is not confirmed'

            });

        }


        // ----------------------------------------------------
        // Showtime must be active
        // ----------------------------------------------------

        if (
            ![
                'SCHEDULED',
                'NOW_SHOWING'
            ].includes(row.showtime_status)
        ) {

            await client.query('ROLLBACK');

            return res.status(409).json({

                success: false,

                message:
                    `Showtime is not available. Current status: ${row.showtime_status}`

            });

        }


        // ----------------------------------------------------
        // Mark ticket as used
        // ----------------------------------------------------

        const updateResult = await client.query(
            `
            UPDATE tickets

            SET
                status = 'USED',
                used_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP

            WHERE ticket_id = $1
              AND status = 'VALID'
            `,
            [ticketId]
        );


        // ----------------------------------------------------
        // Concurrency protection
        // ----------------------------------------------------

        if (updateResult.rowCount !== 1) {

            await client.query('ROLLBACK');

            return res.status(409).json({

                success: false,

                message:
                    'Ticket has already been used'

            });

        }


        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await client.query('COMMIT');


        console.log(
            `🎟️ Ticket used: ${row.ticket_code}`
        );


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            message:
                'Ticket admitted successfully',

            ticket: {

                ticketId:
                    row.ticket_id,

                ticketCode:
                    row.ticket_code,

                status:
                    'USED',

                usedAt:
                    new Date(),

                booking: {

                    bookingId:
                        row.booking_id,

                    bookingRef:
                        row.booking_ref,

                    status:
                        row.booking_status

                },

                movie:
                    row.movie_title,

                cinema:
                    row.cinema_name,

                screen:
                    row.screen_name,

                showDate:
                    row.show_date,

                startTime:
                    row.start_time

            }

        });

    } catch (error) {

        console.error(
            '❌ Use ticket error:',
            error
        );

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

        return res.status(500).json({

            success: false,

            message:
                'Server error using ticket',

            error:
                error.message

        });

    } finally {

        if (client) {

            client.release();

        }

    }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    verifyTicket,

    useTicket

};