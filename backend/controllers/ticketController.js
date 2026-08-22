const { getConnection } = require('../config/database');


// ============================================================
// VERIFY TICKET
// ============================================================

async function verifyTicket(req, res) {

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

        connection =
            await getConnection();

        // ----------------------------------------------------
        // Get ticket
        // ----------------------------------------------------

        const ticketResult =
            await connection.execute(
                `
                SELECT
                    T.TICKET_ID,
                    T.TICKET_CODE,
                    T.QR_CODE_DATA,
                    T.STATUS,

                    B.BOOKING_ID,
                    B.BOOKING_REF,
                    B.USER_ID,
                    B.TICKET_QUANTITY,
                    B.TICKET_PRICE,
                    B.TOTAL_AMOUNT,
                    B.STATUS,

                    ST.SHOWTIME_ID,
                    ST.SHOW_DATE,
                    ST.START_TIME,
                    ST.END_TIME,
                    ST.STATUS,

                    M.MOVIE_ID,
                    M.TITLE,

                    C.CINEMA_ID,
                    C.CINEMA_NAME,

                    S.SCREEN_ID,
                    S.SCREEN_NAME

                FROM TICKETS T

                JOIN BOOKINGS B
                    ON B.BOOKING_ID =
                       T.BOOKING_ID

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

                WHERE UPPER(T.TICKET_CODE) =
                      :ticketCode
                `,
                {
                    ticketCode:
                        normalizedTicketCode
                }
            );

        // ----------------------------------------------------
        // Ticket not found
        // ----------------------------------------------------

        if (
            ticketResult.rows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                valid: false,
                message: 'Ticket not found'
            });

        }

        const row =
            ticketResult.rows[0];

        /*
            INDEXES

            0  TICKET_ID
            1  TICKET_CODE
            2  QR_CODE_DATA
            3  TICKET_STATUS

            4  BOOKING_ID
            5  BOOKING_REF
            6  USER_ID
            7  TICKET_QUANTITY
            8  TICKET_PRICE
            9  TOTAL_AMOUNT
            10 BOOKING_STATUS

            11 SHOWTIME_ID
            12 SHOW_DATE
            13 START_TIME
            14 END_TIME
            15 SHOWTIME_STATUS

            16 MOVIE_ID
            17 MOVIE_TITLE

            18 CINEMA_ID
            19 CINEMA_NAME

            20 SCREEN_ID
            21 SCREEN_NAME
        */

        const ticketId =
            row[0];

        const ticketStatus =
            row[3];

        const bookingStatus =
            row[10];

        const showtimeStatus =
            row[15];


        // ----------------------------------------------------
        // Get seats
        // ----------------------------------------------------

        const seatsResult =
            await connection.execute(
                `
                SELECT
                    BS.SEAT_ID,
                    SE.ROW_LABEL,
                    SE.SEAT_NUMBER,
                    SE.SEAT_LABEL,
                    SE.SEAT_TYPE

                FROM BOOKING_SEATS BS

                JOIN SEATS SE
                    ON SE.SEAT_ID =
                       BS.SEAT_ID

                WHERE BS.BOOKING_ID =
                      :bookingId

                ORDER BY
                    SE.ROW_LABEL,
                    SE.SEAT_NUMBER
                `,
                {
                    bookingId:
                        row[4]
                }
            );

        const seats =
            seatsResult.rows.map(
                seat => ({

                    seatId:
                        seat[0],

                    rowLabel:
                        seat[1],

                    seatNumber:
                        seat[2],

                    seatLabel:
                        seat[3],

                    seatType:
                        seat[4]

                })
            );


        // ----------------------------------------------------
        // Ticket already used
        // ----------------------------------------------------

        if (
            ticketStatus === 'USED'
        ) {

            return res.status(409).json({

                success: true,

                valid: false,

                message:
                    'Ticket has already been used',

                ticket: {

                    ticketId,

                    ticketCode:
                        row[1],

                    status:
                        ticketStatus

                }

            });

        }


        // ----------------------------------------------------
        // Ticket cancelled
        // ----------------------------------------------------

        if (
            ticketStatus === 'CANCELLED'
        ) {

            return res.status(409).json({

                success: true,

                valid: false,

                message:
                    'Ticket has been cancelled',

                ticket: {

                    ticketId,

                    ticketCode:
                        row[1],

                    status:
                        ticketStatus

                }

            });

        }


        // ----------------------------------------------------
        // Ticket expired
        // ----------------------------------------------------

        if (
            ticketStatus === 'EXPIRED'
        ) {

            return res.status(409).json({

                success: true,

                valid: false,

                message:
                    'Ticket has expired',

                ticket: {

                    ticketId,

                    ticketCode:
                        row[1],

                    status:
                        ticketStatus

                }

            });

        }


        // ----------------------------------------------------
        // Booking must be confirmed
        // ----------------------------------------------------

        if (
            bookingStatus !== 'CONFIRMED'
        ) {

            return res.status(409).json({

                success: true,

                valid: false,

                message:
                    `Booking is not confirmed. Current status: ${bookingStatus}`,

                ticket: {

                    ticketId,

                    ticketCode:
                        row[1],

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
                        row[1],

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
                    row[1],

                qrCodeData:
                    row[2],

                status:
                    ticketStatus,

                booking: {

                    bookingId:
                        row[4],

                    bookingRef:
                        row[5],

                    ticketQuantity:
                        row[7],

                    ticketPrice:
                        row[8],

                    totalAmount:
                        row[9],

                    status:
                        bookingStatus

                },

                movie: {

                    movieId:
                        row[16],

                    title:
                        row[17]

                },

                cinema: {

                    cinemaId:
                        row[18],

                    name:
                        row[19]

                },

                screen: {

                    screenId:
                        row[20],

                    name:
                        row[21]

                },

                showtime: {

                    showtimeId:
                        row[11],

                    showDate:
                        row[12],

                    startTime:
                        row[13],

                    endTime:
                        row[14],

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

    } finally {

        if (connection) {

            try {

                await connection.close();

            } catch (error) {

                console.error(
                    '❌ Error closing ticket connection:',
                    error.message
                );

            }

        }

    }

}


// ============================================================
// USE TICKET
// ============================================================

async function useTicket(req, res) {

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

        // ----------------------------------------------------
        // Ticket ID
        // ----------------------------------------------------

        const ticketId =
            Number(req.params.ticketId);

        if (
            !Number.isInteger(ticketId)
        ) {

            return res.status(400).json({
                success: false,
                message: 'Invalid ticket ID'
            });

        }

        connection =
            await getConnection();

        // ----------------------------------------------------
        // Get ticket
        // ----------------------------------------------------

        const ticketResult =
            await connection.execute(
                `
                SELECT
                    T.TICKET_ID,
                    T.TICKET_CODE,
                    T.STATUS,

                    B.BOOKING_ID,
                    B.BOOKING_REF,
                    B.STATUS,

                    M.TITLE,

                    C.CINEMA_NAME,

                    S.SCREEN_NAME,

                    ST.SHOW_DATE,
                    ST.START_TIME,
                    ST.STATUS

                FROM TICKETS T

                JOIN BOOKINGS B
                    ON B.BOOKING_ID =
                       T.BOOKING_ID

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

                WHERE T.TICKET_ID =
                      :ticketId
                `,
                {
                    ticketId
                }
            );

        if (
            ticketResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Ticket not found'

            });

        }

        const row =
            ticketResult.rows[0];

        /*
            INDEXES

            0  TICKET_ID
            1  TICKET_CODE
            2  TICKET_STATUS

            3  BOOKING_ID
            4  BOOKING_REF
            5  BOOKING_STATUS

            6  MOVIE_TITLE
            7  CINEMA_NAME
            8  SCREEN_NAME

            9  SHOW_DATE
            10 START_TIME
            11 SHOWTIME_STATUS
        */


        // ----------------------------------------------------
        // Check ticket status
        // ----------------------------------------------------

        if (
            row[2] === 'USED'
        ) {

            return res.status(409).json({

                success: false,

                message:
                    'Ticket has already been used',

                ticket: {

                    ticketId:
                        row[0],

                    ticketCode:
                        row[1],

                    status:
                        row[2]

                }

            });

        }


        if (
            row[2] !== 'VALID'
        ) {

            return res.status(409).json({

                success: false,

                message:
                    `Ticket cannot be used because its status is ${row[2]}`,

                ticket: {

                    ticketId:
                        row[0],

                    ticketCode:
                        row[1],

                    status:
                        row[2]

                }

            });

        }


        // ----------------------------------------------------
        // Booking must be confirmed
        // ----------------------------------------------------

        if (
            row[5] !== 'CONFIRMED'
        ) {

            return res.status(409).json({

                success: false,

                message:
                    'Booking is not confirmed'

            });

        }


        // ----------------------------------------------------
        // Mark ticket as used
        // ----------------------------------------------------

        const updateResult =
            await connection.execute(
                `
                UPDATE TICKETS

                SET
                    STATUS = 'USED',

                    USED_AT =
                        CURRENT_TIMESTAMP,

                    UPDATED_AT =
                        CURRENT_TIMESTAMP

                WHERE TICKET_ID =
                      :ticketId

                  AND STATUS =
                      'VALID'
                `,
                {
                    ticketId
                }
            );

        // ----------------------------------------------------
        // Concurrency protection
        // ----------------------------------------------------

        if (
            updateResult.rowsAffected !== 1
        ) {

            await connection.rollback();

            return res.status(409).json({

                success: false,

                message:
                    'Ticket has already been used'

            });

        }


        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await connection.commit();


        console.log(
            `🎟️ Ticket used: ${row[1]}`
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
                    row[0],

                ticketCode:
                    row[1],

                status:
                    'USED',

                usedAt:
                    new Date(),

                booking: {

                    bookingId:
                        row[3],

                    bookingRef:
                        row[4],

                    status:
                        row[5]

                },

                movie:
                    row[6],

                cinema:
                    row[7],

                screen:
                    row[8],

                showDate:
                    row[9],

                startTime:
                    row[10]

            }

        });

    } catch (error) {

        console.error(
            '❌ Use ticket error:',
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
                'Server error using ticket',

            error:
                error.message

        });

    } finally {

        if (connection) {

            try {

                await connection.close();

            } catch (error) {

                console.error(
                    '❌ Error closing ticket connection:',
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

    verifyTicket,

    useTicket

};

