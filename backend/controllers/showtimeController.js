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
// EXPORTS
// ============================================================

module.exports = {
    getShowtimes,
    getShowtimeById,
    getMovieShowtimes,
    getCinemaShowtimes,
    getScreenShowtimes,
    getShowtimeSeats
};