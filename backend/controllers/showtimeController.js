const { getConnection } = require('../config/database');


// ============================================================
// GET ALL SHOWTIMES
// ============================================================

async function getShowtimes(req, res) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                ST.SHOWTIME_ID,
                ST.MOVIE_ID,
                M.TITLE,
                M.POSTER_URL,

                ST.CINEMA_ID,
                C.CINEMA_NAME,

                ST.SCREEN_ID,
                S.SCREEN_NAME,
                S.SCREEN_NUMBER,

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

            WHERE ST.IS_ACTIVE = 'Y'

            ORDER BY
                ST.SHOW_DATE,
                ST.START_TIME
            `
        );

        const showtimes = result.rows.map(row => ({
            showtimeId: row[0],
            movieId: row[1],
            movieTitle: row[2],
            posterUrl: row[3],

            cinemaId: row[4],
            cinemaName: row[5],

            screenId: row[6],
            screenName: row[7],
            screenNumber: row[8],

            showDate: row[9],
            startTime: row[10],
            endTime: row[11],

            ticketPrice: row[12],
            status: row[13],
            isActive: row[14] === 'Y'
        }));

        res.json({
            success: true,
            count: showtimes.length,
            showtimes
        });

    } catch (error) {

        console.error('❌ Get showtimes error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching showtimes',
            error: error.message
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing showtime connection:',
                    error.message
                );
            }
        }
    }
}


// ============================================================
// GET SHOWTIME SEATS
// ============================================================

async function getShowtimeSeats(req, res) {

    let connection;

    try {

        const showtimeId = Number(req.params.showtimeId);

        if (!Number.isInteger(showtimeId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid showtime ID'
            });

        }

        connection = await getConnection();

        // ----------------------------------------------------
        // Get showtime information
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
                showtimeId
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
            INDEXES

            0  SHOWTIME_ID
            1  MOVIE_ID
            2  MOVIE TITLE
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

        // ----------------------------------------------------
        // Get all seats for screen
        // ----------------------------------------------------

        const seatsResult = await connection.execute(
            `
            SELECT
                SEAT_ID,
                ROW_LABEL,
                SEAT_NUMBER,
                SEAT_LABEL,
                SEAT_TYPE,
                IS_ACTIVE

            FROM SEATS

            WHERE SCREEN_ID = :screenId

            ORDER BY
                ROW_LABEL,
                SEAT_NUMBER
            `,
            {
                screenId: showtime[5]
            }
        );

        // ----------------------------------------------------
        // Get booked seats
        // ----------------------------------------------------

        const bookedResult = await connection.execute(
            `
            SELECT
                BS.SEAT_ID

            FROM BOOKING_SEATS BS

            JOIN BOOKINGS B
                ON B.BOOKING_ID = BS.BOOKING_ID

            WHERE BS.SHOWTIME_ID = :showtimeId

              AND B.STATUS IN (
                  'PENDING',
                  'CONFIRMED'
              )
            `,
            {
                showtimeId
            }
        );

        const bookedSeatIds =
            new Set(
                bookedResult.rows.map(
                    row => row[0]
                )
            );

        // ----------------------------------------------------
        // Build seat map
        // ----------------------------------------------------

        const seats = seatsResult.rows.map(
            seat => {

                const seatId = seat[0];

                let status = 'AVAILABLE';

                if (seat[5] !== 'Y') {

                    status = 'INACTIVE';

                } else if (
                    bookedSeatIds.has(seatId)
                ) {

                    status = 'BOOKED';

                }

                return {

                    seatId,

                    rowLabel: seat[1],

                    seatNumber: seat[2],

                    seatLabel: seat[3],

                    seatType: seat[4],

                    status

                };

            }
        );

        // ----------------------------------------------------
        // Calculate availability
        // ----------------------------------------------------

        const activeSeats =
            seats.filter(
                seat => seat.status !== 'INACTIVE'
            );

        const availableSeats =
            seats.filter(
                seat => seat.status === 'AVAILABLE'
            );

        const bookedSeats =
            seats.filter(
                seat => seat.status === 'BOOKED'
            );

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        res.json({

            success: true,

            showtime: {

                showtimeId: showtime[0],

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
                    name: showtime[6],
                    capacity: showtime[7]
                },

                showDate: showtime[8],
                startTime: showtime[9],
                endTime: showtime[10],

                ticketPrice: showtime[11],

                status: showtime[12],

                isActive: showtime[13]

            },

            summary: {

                capacity: showtime[7],

                totalSeats: seats.length,

                activeSeats: activeSeats.length,

                availableSeats:
                    availableSeats.length,

                bookedSeats:
                    bookedSeats.length

            },

            seats

        });

    } catch (error) {

        console.error(
            '❌ Get showtime seats error:',
            error
        );

        res.status(500).json({

            success: false,

            message:
                'Server error fetching showtime seats',

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
// GET SHOWTIME BY ID
// ============================================================

async function getShowtimeById(req, res) {

    let connection;

    try {

        const showtimeId = Number(req.params.showtimeId);

        if (!Number.isInteger(showtimeId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid showtime ID'
            });

        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                ST.SHOWTIME_ID,
                ST.MOVIE_ID,
                M.TITLE,
                M.POSTER_URL,

                ST.CINEMA_ID,
                C.CINEMA_NAME,

                ST.SCREEN_ID,
                S.SCREEN_NAME,
                S.SCREEN_NUMBER,
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
                showtimeId
            }
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Showtime not found'
            });

        }

        const row = result.rows[0];

        res.json({
            success: true,

            showtime: {
                showtimeId: row[0],

                movie: {
                    movieId: row[1],
                    title: row[2],
                    posterUrl: row[3]
                },

                cinema: {
                    cinemaId: row[4],
                    name: row[5]
                },

                screen: {
                    screenId: row[6],
                    name: row[7],
                    number: row[8],
                    capacity: row[9]
                },

                showDate: row[10],
                startTime: row[11],
                endTime: row[12],

                ticketPrice: row[13],
                status: row[14],
                isActive: row[15] === 'Y'
            }
        });

    } catch (error) {

        console.error('❌ Get showtime error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching showtime',
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
// GET SHOWTIMES FOR MOVIE
// ============================================================

async function getMovieShowtimes(req, res) {

    let connection;

    try {

        const movieId = Number(req.params.movieId);

        if (!Number.isInteger(movieId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });

        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                ST.SHOWTIME_ID,
                ST.MOVIE_ID,

                ST.CINEMA_ID,
                C.CINEMA_NAME,

                ST.SCREEN_ID,
                S.SCREEN_NAME,

                ST.SHOW_DATE,
                ST.START_TIME,
                ST.END_TIME,

                ST.TICKET_PRICE,
                ST.STATUS

            FROM SHOWTIMES ST

            JOIN CINEMAS C
                ON C.CINEMA_ID = ST.CINEMA_ID

            JOIN SCREENS S
                ON S.SCREEN_ID = ST.SCREEN_ID

            WHERE ST.MOVIE_ID = :movieId
              AND ST.IS_ACTIVE = 'Y'

            ORDER BY
                ST.SHOW_DATE,
                ST.START_TIME
            `,
            {
                movieId
            }
        );

        const showtimes = result.rows.map(row => ({
            showtimeId: row[0],
            movieId: row[1],

            cinemaId: row[2],
            cinemaName: row[3],

            screenId: row[4],
            screenName: row[5],

            showDate: row[6],
            startTime: row[7],
            endTime: row[8],

            ticketPrice: row[9],
            status: row[10]
        }));

        res.json({
            success: true,
            movieId,
            count: showtimes.length,
            showtimes
        });

    } catch (error) {

        console.error(
            '❌ Get movie showtimes error:',
            error
        );

        res.status(500).json({
            success: false,
            message: 'Server error fetching movie showtimes',
            error: error.message
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {}
        }
    }
}


// ============================================================
// GET SHOWTIMES FOR CINEMA
// ============================================================

async function getCinemaShowtimes(req, res) {

    let connection;

    try {

        const cinemaId = Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid cinema ID'
            });

        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                ST.SHOWTIME_ID,
                ST.MOVIE_ID,
                M.TITLE,
                M.POSTER_URL,

                ST.CINEMA_ID,

                ST.SCREEN_ID,
                S.SCREEN_NAME,
                S.SCREEN_NUMBER,

                ST.SHOW_DATE,
                ST.START_TIME,
                ST.END_TIME,

                ST.TICKET_PRICE,
                ST.STATUS

            FROM SHOWTIMES ST

            JOIN MOVIES M
                ON M.MOVIE_ID = ST.MOVIE_ID

            JOIN SCREENS S
                ON S.SCREEN_ID = ST.SCREEN_ID

            WHERE ST.CINEMA_ID = :cinemaId
              AND ST.IS_ACTIVE = 'Y'

            ORDER BY
                ST.SHOW_DATE,
                ST.START_TIME
            `,
            {
                cinemaId
            }
        );

        const showtimes = result.rows.map(row => ({
            showtimeId: row[0],

            movieId: row[1],
            movieTitle: row[2],
            posterUrl: row[3],

            cinemaId: row[4],

            screenId: row[5],
            screenName: row[6],
            screenNumber: row[7],

            showDate: row[8],
            startTime: row[9],
            endTime: row[10],

            ticketPrice: row[11],
            status: row[12]
        }));

        res.json({
            success: true,
            cinemaId,
            count: showtimes.length,
            showtimes
        });

    } catch (error) {

        console.error(
            '❌ Get cinema showtimes error:',
            error
        );

        res.status(500).json({
            success: false,
            message: 'Server error fetching cinema showtimes',
            error: error.message
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {}
        }
    }
}


// ============================================================
// GET SHOWTIMES FOR SCREEN
// ============================================================

async function getScreenShowtimes(req, res) {

    let connection;

    try {

        const cinemaId = Number(req.params.cinemaId);
        const screenId = Number(req.params.screenId);

        if (
            !Number.isInteger(cinemaId) ||
            !Number.isInteger(screenId)
        ) {

            return res.status(400).json({
                success: false,
                message: 'Invalid cinema or screen ID'
            });

        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                ST.SHOWTIME_ID,

                ST.MOVIE_ID,
                M.TITLE,
                M.POSTER_URL,

                ST.CINEMA_ID,
                ST.SCREEN_ID,

                ST.SHOW_DATE,
                ST.START_TIME,
                ST.END_TIME,

                ST.TICKET_PRICE,
                ST.STATUS

            FROM SHOWTIMES ST

            JOIN MOVIES M
                ON M.MOVIE_ID = ST.MOVIE_ID

            WHERE ST.CINEMA_ID = :cinemaId
              AND ST.SCREEN_ID = :screenId
              AND ST.IS_ACTIVE = 'Y'

            ORDER BY
                ST.SHOW_DATE,
                ST.START_TIME
            `,
            {
                cinemaId,
                screenId
            }
        );

        const showtimes = result.rows.map(row => ({
            showtimeId: row[0],

            movieId: row[1],
            movieTitle: row[2],
            posterUrl: row[3],

            cinemaId: row[4],
            screenId: row[5],

            showDate: row[6],
            startTime: row[7],
            endTime: row[8],

            ticketPrice: row[9],
            status: row[10]
        }));

        res.json({
            success: true,
            cinemaId,
            screenId,
            count: showtimes.length,
            showtimes
        });

    } catch (error) {

        console.error(
            '❌ Get screen showtimes error:',
            error
        );

        res.status(500).json({
            success: false,
            message: 'Server error fetching screen showtimes',
            error: error.message
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {}
        }
    }
}

// ============================================================
// CREATE SHOWTIME
// ============================================================

async function createShowtime(req, res) {

    let connection;

    try {

        const {
            movieId,
            cinemaId,
            screenId,
            showDate,
            startTime,
            ticketPrice
        } = req.body;

        // ----------------------------------------------------
        // VALIDATION
        // ----------------------------------------------------

        if (
            !movieId ||
            !cinemaId ||
            !screenId ||
            !showDate ||
            !startTime ||
            ticketPrice === undefined ||
            ticketPrice === null
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Movie, cinema, screen, date, start time and ticket price are required'
            });

        }

        const parsedMovieId = Number(movieId);
        const parsedCinemaId = Number(cinemaId);
        const parsedScreenId = Number(screenId);
        const parsedTicketPrice = Number(ticketPrice);

        if (
            !Number.isInteger(parsedMovieId) ||
            !Number.isInteger(parsedCinemaId) ||
            !Number.isInteger(parsedScreenId)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Movie, cinema and screen IDs must be valid numbers'
            });

        }

        if (
            !Number.isFinite(parsedTicketPrice) ||
            parsedTicketPrice < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Ticket price must be a valid positive number'
            });

        }

        // ----------------------------------------------------
        // VALIDATE DATE
        // ----------------------------------------------------

        const datePattern = /^\d{4}-\d{2}-\d{2}$/;

        if (!datePattern.test(showDate)) {

            return res.status(400).json({
                success: false,
                message:
                    'Show date must use YYYY-MM-DD format'
            });

        }

        // ----------------------------------------------------
        // VALIDATE TIME
        // ----------------------------------------------------

        const timePattern =
            /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

        const timeMatch =
            startTime.match(timePattern);

        if (!timeMatch) {

            return res.status(400).json({
                success: false,
                message:
                    'Invalid start time. Use HH:MM or HH:MM:SS'
            });

        }

        const hours = Number(timeMatch[1]);
        const minutes = Number(timeMatch[2]);
        const seconds = Number(timeMatch[3] || 0);

        // ----------------------------------------------------
        // DATABASE CONNECTION
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // GET MOVIE RUNTIME
        // ----------------------------------------------------

        const movieResult = await connection.execute(
            `
            SELECT
                MOVIE_ID,
                TITLE,
                RUNTIME_MINUTES,
                STATUS
            FROM MOVIES
            WHERE MOVIE_ID = :movieId
            `,
            {
                movieId: parsedMovieId
            }
        );

        if (movieResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });

        }

        const movie = movieResult.rows[0];

        const movieTitle = movie[1];
        const runtimeMinutes = movie[2];

        if (
            runtimeMinutes === null ||
            runtimeMinutes === undefined ||
            Number(runtimeMinutes) <= 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    `Runtime is not available for "${movieTitle}". Update the movie runtime before creating a showtime.`
            });

        }

        // ----------------------------------------------------
        // CHECK CINEMA
        // ----------------------------------------------------

        const cinemaResult = await connection.execute(
            `
            SELECT
                CINEMA_ID,
                CINEMA_NAME,
                IS_ACTIVE
            FROM CINEMAS
            WHERE CINEMA_ID = :cinemaId
            `,
            {
                cinemaId: parsedCinemaId
            }
        );

        if (cinemaResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Cinema not found'
            });

        }

        if (cinemaResult.rows[0][2] !== 'Y') {

            return res.status(400).json({
                success: false,
                message: 'Cinema is not active'
            });

        }

        // ----------------------------------------------------
        // CHECK SCREEN
        // ----------------------------------------------------

        const screenResult = await connection.execute(
            `
            SELECT
                SCREEN_ID,
                SCREEN_NAME,
                CINEMA_ID,
                IS_ACTIVE
            FROM SCREENS
            WHERE SCREEN_ID = :screenId
            `,
            {
                screenId: parsedScreenId
            }
        );

        if (screenResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Screen not found'
            });

        }

        const screen = screenResult.rows[0];

        if (screen[2] !== parsedCinemaId) {

            return res.status(400).json({
                success: false,
                message:
                    'The selected screen does not belong to the selected cinema'
            });

        }

        if (screen[3] !== 'Y') {

            return res.status(400).json({
                success: false,
                message: 'Screen is not active'
            });

        }

        // ----------------------------------------------------
        // CALCULATE END TIME
        // ----------------------------------------------------

        const startDateTime =
            new Date(
                `${showDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            );

        if (isNaN(startDateTime.getTime())) {

            return res.status(400).json({
                success: false,
                message: 'Invalid date or start time'
            });

        }

        const endDateTime =
            new Date(startDateTime);

        endDateTime.setMinutes(
            endDateTime.getMinutes() +
            Number(runtimeMinutes)
        );

        // ----------------------------------------------------
        // FORMAT ORACLE TIMESTAMP VALUES
        // ----------------------------------------------------

        const formatOracleTimestamp =
            (date) => {

                const year =
                    date.getFullYear();

                const month =
                    String(date.getMonth() + 1)
                        .padStart(2, '0');

                const day =
                    String(date.getDate())
                        .padStart(2, '0');

                const hour =
                    String(date.getHours())
                        .padStart(2, '0');

                const minute =
                    String(date.getMinutes())
                        .padStart(2, '0');

                const second =
                    String(date.getSeconds())
                        .padStart(2, '0');

                return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
            };

        const oracleStartTime =
            formatOracleTimestamp(startDateTime);

        const oracleEndTime =
            formatOracleTimestamp(endDateTime);

        // ----------------------------------------------------
        // CHECK FOR SCREEN CONFLICT
        // ----------------------------------------------------

        const conflictResult =
            await connection.execute(
                `
                SELECT
                    SHOWTIME_ID,
                    START_TIME,
                    END_TIME
                FROM SHOWTIMES
                WHERE SCREEN_ID = :screenId
                  AND SHOW_DATE = TO_DATE(
                        :showDate,
                        'YYYY-MM-DD'
                  )
                  AND IS_ACTIVE = 'Y'
                  AND STATUS NOT IN ('CANCELLED', 'COMPLETED')
                  AND START_TIME < TO_TIMESTAMP(
                        :endTime,
                        'YYYY-MM-DD HH24:MI:SS'
                  )
                  AND NVL(
                        END_TIME,
                        START_TIME
                      ) > TO_TIMESTAMP(
                        :startTime,
                        'YYYY-MM-DD HH24:MI:SS'
                  )
                `,
                {
                    screenId: parsedScreenId,
                    showDate,
                    startTime: oracleStartTime,
                    endTime: oracleEndTime
                }
            );

        if (conflictResult.rows.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    'This screen already has a showtime that overlaps with the requested time',
                conflictingShowtimeId:
                    conflictResult.rows[0][0]
            });

        }

        // ----------------------------------------------------
        // INSERT SHOWTIME
        // ----------------------------------------------------

        const insertResult =
            await connection.execute(
                `
                INSERT INTO SHOWTIMES (
                    MOVIE_ID,
                    CINEMA_ID,
                    SCREEN_ID,
                    SHOW_DATE,
                    START_TIME,
                    END_TIME,
                    TICKET_PRICE,
                    STATUS,
                    IS_ACTIVE,
                    CREATED_AT,
                    UPDATED_AT
                )
                VALUES (
                    :movieId,
                    :cinemaId,
                    :screenId,
                    TO_DATE(
                        :showDate,
                        'YYYY-MM-DD'
                    ),
                    TO_TIMESTAMP(
                        :startTime,
                        'YYYY-MM-DD HH24:MI:SS'
                    ),
                    TO_TIMESTAMP(
                        :endTime,
                        'YYYY-MM-DD HH24:MI:SS'
                    ),
                    :ticketPrice,
                    'SCHEDULED',
                    'Y',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                RETURNING SHOWTIME_ID INTO :showtimeId
                `,
                {
                    movieId: parsedMovieId,
                    cinemaId: parsedCinemaId,
                    screenId: parsedScreenId,
                    showDate,
                    startTime: oracleStartTime,
                    endTime: oracleEndTime,
                    ticketPrice: parsedTicketPrice,

                    showtimeId: {
                        dir: require('oracledb').BIND_OUT,
                        type: require('oracledb').NUMBER
                    }
                }
            );

        const showtimeId =
            insertResult.outBinds.showtimeId[0];

        await connection.commit();

        // ----------------------------------------------------
        // RESPONSE
        // ----------------------------------------------------

        return res.status(201).json({

            success: true,

            message:
                'Showtime created successfully',

            showtime: {

                showtimeId,

                movieId: parsedMovieId,

                movieTitle,

                cinemaId:
                    parsedCinemaId,

                screenId:
                    parsedScreenId,

                showDate,

                startTime:
                    oracleStartTime,

                endTime:
                    oracleEndTime,

                runtimeMinutes:
                    Number(runtimeMinutes),

                ticketPrice:
                    parsedTicketPrice,

                status:
                    'SCHEDULED',

                isActive:
                    true

            }

        });

    } catch (error) {

        if (connection) {

            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    '❌ Rollback error:',
                    rollbackError.message
                );
            }

        }

        console.error(
            '❌ Create showtime error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error creating showtime',

            error:
                error.message

        });

    } finally {

        if (connection) {

            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing showtime connection:',
                    error.message
                );
            }

        }

    }

}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getShowtimes,
    getShowtimeById,
    getMovieShowtimes,
    getCinemaShowtimes,
    getScreenShowtimes,
    getShowtimeSeats,
    createShowtime
};