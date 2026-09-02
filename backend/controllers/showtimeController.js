const pool = require('../config/database');


// ============================================================
// GET ALL SHOWTIMES
// ============================================================

async function getShowtimes(req, res) {

    try {

        const result = await pool.query(
            `
            SELECT
                st.showtime_id,
                st.movie_id,
                m.title,
                m.poster_url,

                st.cinema_id,
                c.cinema_name,

                st.screen_id,
                s.screen_name,
                s.screen_number,

                st.show_date,
                st.start_time,
                st.end_time,

                st.ticket_price,
                st.status,
                st.is_active

            FROM showtimes st

            JOIN movies m
                ON m.movie_id = st.movie_id

            JOIN cinemas c
                ON c.cinema_id = st.cinema_id

            JOIN screens s
                ON s.screen_id = st.screen_id

            WHERE st.is_active = 'Y'

            ORDER BY
                st.show_date,
                st.start_time
            `
        );

        const showtimes =
            result.rows.map(row => ({

                showtimeId:
                    row.showtime_id,

                movieId:
                    row.movie_id,

                movieTitle:
                    row.title,

                posterUrl:
                    row.poster_url,

                cinemaId:
                    row.cinema_id,

                cinemaName:
                    row.cinema_name,

                screenId:
                    row.screen_id,

                screenName:
                    row.screen_name,

                screenNumber:
                    row.screen_number,

                showDate:
                    row.show_date,

                startTime:
                    row.start_time,

                endTime:
                    row.end_time,

                ticketPrice:
                    row.ticket_price,

                status:
                    row.status,

                isActive:
                    row.is_active === 'Y'

            }));

        return res.json({

            success: true,

            count:
                showtimes.length,

            showtimes

        });

    } catch (error) {

        console.error(
            '❌ Get showtimes error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching showtimes',

            error:
                error.message

        });

    }

}


// ============================================================
// GET SHOWTIME SEATS
// ============================================================

async function getShowtimeSeats(req, res) {

    try {

        const showtimeId =
            Number(req.params.showtimeId);

        if (!Number.isInteger(showtimeId)) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid showtime ID'

            });

        }


        // ----------------------------------------------------
        // Get showtime information
        // ----------------------------------------------------

        const showtimeResult =
            await pool.query(
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
                    ON m.movie_id = st.movie_id

                JOIN cinemas c
                    ON c.cinema_id = st.cinema_id

                JOIN screens s
                    ON s.screen_id = st.screen_id

                WHERE st.showtime_id = $1
                `,
                [showtimeId]
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


        // ----------------------------------------------------
        // Get all seats for screen
        // ----------------------------------------------------

        const seatsResult =
            await pool.query(
                `
                SELECT
                    seat_id,
                    row_label,
                    seat_number,
                    seat_label,
                    seat_type,
                    is_active

                FROM seats

                WHERE screen_id = $1

                ORDER BY
                    row_label,
                    seat_number
                `,
                [showtime.screen_id]
            );


        // ----------------------------------------------------
        // Get booked seats
        // ----------------------------------------------------

        const bookedResult =
            await pool.query(
                `
                SELECT
                    bs.seat_id

                FROM booking_seats bs

                JOIN bookings b
                    ON b.booking_id = bs.booking_id

                WHERE bs.showtime_id = $1

                  AND b.status IN (
                      'PENDING',
                      'CONFIRMED'
                  )
                `,
                [showtimeId]
            );

        const bookedSeatIds =
            new Set(
                bookedResult.rows.map(
                    row => row.seat_id
                )
            );


        // ----------------------------------------------------
        // Build seat map
        // ----------------------------------------------------

        const seats =
            seatsResult.rows.map(
                seat => {

                    const seatId =
                        seat.seat_id;

                    let status =
                        'AVAILABLE';

                    if (
                        seat.is_active !== 'Y'
                    ) {

                        status =
                            'INACTIVE';

                    } else if (
                        bookedSeatIds.has(seatId)
                    ) {

                        status =
                            'BOOKED';

                    }

                    return {

                        seatId,

                        rowLabel:
                            seat.row_label,

                        seatNumber:
                            seat.seat_number,

                        seatLabel:
                            seat.seat_label,

                        seatType:
                            seat.seat_type,

                        status

                    };

                }
            );


        // ----------------------------------------------------
        // Calculate availability
        // ----------------------------------------------------

        const activeSeats =
            seats.filter(
                seat =>
                    seat.status !== 'INACTIVE'
            );

        const availableSeats =
            seats.filter(
                seat =>
                    seat.status === 'AVAILABLE'
            );

        const bookedSeats =
            seats.filter(
                seat =>
                    seat.status === 'BOOKED'
            );


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            showtime: {

                showtimeId:
                    showtime.showtime_id,

                movie: {

                    movieId:
                        showtime.movie_id,

                    title:
                        showtime.title

                },

                cinema: {

                    cinemaId:
                        showtime.cinema_id,

                    name:
                        showtime.cinema_name

                },

                screen: {

                    screenId:
                        showtime.screen_id,

                    name:
                        showtime.screen_name,

                    capacity:
                        showtime.capacity

                },

                showDate:
                    showtime.show_date,

                startTime:
                    showtime.start_time,

                endTime:
                    showtime.end_time,

                ticketPrice:
                    showtime.ticket_price,

                status:
                    showtime.status,

                isActive:
                    showtime.is_active === 'Y'

            },

            summary: {

                capacity:
                    showtime.capacity,

                totalSeats:
                    seats.length,

                activeSeats:
                    activeSeats.length,

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

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching showtime seats',

            error:
                error.message

        });

    }

}


// ============================================================
// GET SHOWTIME BY ID
// ============================================================

async function getShowtimeById(req, res) {

    try {

        const showtimeId =
            Number(req.params.showtimeId);

        if (!Number.isInteger(showtimeId)) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid showtime ID'

            });

        }

        const result =
            await pool.query(
                `
                SELECT
                    st.showtime_id,
                    st.movie_id,
                    m.title,
                    m.poster_url,

                    st.cinema_id,
                    c.cinema_name,

                    st.screen_id,
                    s.screen_name,
                    s.screen_number,
                    s.capacity,

                    st.show_date,
                    st.start_time,
                    st.end_time,

                    st.ticket_price,
                    st.status,
                    st.is_active

                FROM showtimes st

                JOIN movies m
                    ON m.movie_id = st.movie_id

                JOIN cinemas c
                    ON c.cinema_id = st.cinema_id

                JOIN screens s
                    ON s.screen_id = st.screen_id

                WHERE st.showtime_id = $1
                `,
                [showtimeId]
            );

        if (result.rows.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    'Showtime not found'

            });

        }

        const row =
            result.rows[0];

        return res.json({

            success: true,

            showtime: {

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
                        row.screen_name,

                    number:
                        row.screen_number,

                    capacity:
                        row.capacity

                },

                showDate:
                    row.show_date,

                startTime:
                    row.start_time,

                endTime:
                    row.end_time,

                ticketPrice:
                    row.ticket_price,

                status:
                    row.status,

                isActive:
                    row.is_active === 'Y'

            }

        });

    } catch (error) {

        console.error(
            '❌ Get showtime error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching showtime',

            error:
                error.message

        });

    }

}


// ============================================================
// GET SHOWTIMES FOR MOVIE
// ============================================================

async function getMovieShowtimes(req, res) {

    try {

        const movieId =
            Number(req.params.movieId);

        if (!Number.isInteger(movieId)) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid movie ID'

            });

        }

        const result =
            await pool.query(
                `
                SELECT
                    st.showtime_id,
                    st.movie_id,

                    st.cinema_id,
                    c.cinema_name,

                    st.screen_id,
                    s.screen_name,

                    st.show_date,
                    st.start_time,
                    st.end_time,

                    st.ticket_price,
                    st.status

                FROM showtimes st

                JOIN cinemas c
                    ON c.cinema_id = st.cinema_id

                JOIN screens s
                    ON s.screen_id = st.screen_id

                WHERE st.movie_id = $1

                  AND st.is_active = 'Y'

                ORDER BY
                    st.show_date,
                    st.start_time
                `,
                [movieId]
            );

        const showtimes =
            result.rows.map(row => ({

                showtimeId:
                    row.showtime_id,

                movieId:
                    row.movie_id,

                cinemaId:
                    row.cinema_id,

                cinemaName:
                    row.cinema_name,

                screenId:
                    row.screen_id,

                screenName:
                    row.screen_name,

                showDate:
                    row.show_date,

                startTime:
                    row.start_time,

                endTime:
                    row.end_time,

                ticketPrice:
                    row.ticket_price,

                status:
                    row.status

            }));

        return res.json({

            success: true,

            movieId,

            count:
                showtimes.length,

            showtimes

        });

    } catch (error) {

        console.error(
            '❌ Get movie showtimes error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching movie showtimes',

            error:
                error.message

        });

    }

}


// ============================================================
// GET SHOWTIMES FOR CINEMA
// ============================================================

async function getCinemaShowtimes(req, res) {

    try {

        const cinemaId =
            Number(req.params.cinemaId);

        if (!Number.isInteger(cinemaId)) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid cinema ID'

            });

        }

        const result =
            await pool.query(
                `
                SELECT
                    st.showtime_id,
                    st.movie_id,
                    m.title,
                    m.poster_url,

                    st.cinema_id,

                    st.screen_id,
                    s.screen_name,
                    s.screen_number,

                    st.show_date,
                    st.start_time,
                    st.end_time,

                    st.ticket_price,
                    st.status

                FROM showtimes st

                JOIN movies m
                    ON m.movie_id = st.movie_id

                JOIN screens s
                    ON s.screen_id = st.screen_id

                WHERE st.cinema_id = $1

                  AND st.is_active = 'Y'

                ORDER BY
                    st.show_date,
                    st.start_time
                `,
                [cinemaId]
            );

        const showtimes =
            result.rows.map(row => ({

                showtimeId:
                    row.showtime_id,

                movieId:
                    row.movie_id,

                movieTitle:
                    row.title,

                posterUrl:
                    row.poster_url,

                cinemaId:
                    row.cinema_id,

                screenId:
                    row.screen_id,

                screenName:
                    row.screen_name,

                screenNumber:
                    row.screen_number,

                showDate:
                    row.show_date,

                startTime:
                    row.start_time,

                endTime:
                    row.end_time,

                ticketPrice:
                    row.ticket_price,

                status:
                    row.status

            }));

        return res.json({

            success: true,

            cinemaId,

            count:
                showtimes.length,

            showtimes

        });

    } catch (error) {

        console.error(
            '❌ Get cinema showtimes error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching cinema showtimes',

            error:
                error.message

        });

    }

}


// ============================================================
// GET SHOWTIMES FOR SCREEN
// ============================================================

async function getScreenShowtimes(req, res) {

    try {

        const cinemaId =
            Number(req.params.cinemaId);

        const screenId =
            Number(req.params.screenId);

        if (
            !Number.isInteger(cinemaId) ||
            !Number.isInteger(screenId)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid cinema or screen ID'

            });

        }

        const result =
            await pool.query(
                `
                SELECT
                    st.showtime_id,

                    st.movie_id,
                    m.title,
                    m.poster_url,

                    st.cinema_id,
                    st.screen_id,

                    st.show_date,
                    st.start_time,
                    st.end_time,

                    st.ticket_price,
                    st.status

                FROM showtimes st

                JOIN movies m
                    ON m.movie_id = st.movie_id

                WHERE st.cinema_id = $1

                  AND st.screen_id = $2

                  AND st.is_active = 'Y'

                ORDER BY
                    st.show_date,
                    st.start_time
                `,
                [
                    cinemaId,
                    screenId
                ]
            );

        const showtimes =
            result.rows.map(row => ({

                showtimeId:
                    row.showtime_id,

                movieId:
                    row.movie_id,

                movieTitle:
                    row.title,

                posterUrl:
                    row.poster_url,

                cinemaId:
                    row.cinema_id,

                screenId:
                    row.screen_id,

                showDate:
                    row.show_date,

                startTime:
                    row.start_time,

                endTime:
                    row.end_time,

                ticketPrice:
                    row.ticket_price,

                status:
                    row.status

            }));

        return res.json({

            success: true,

            cinemaId,

            screenId,

            count:
                showtimes.length,

            showtimes

        });

    } catch (error) {

        console.error(
            '❌ Get screen showtimes error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching screen showtimes',

            error:
                error.message

        });

    }

}


// ============================================================
// CREATE SHOWTIME
// ============================================================

async function createShowtime(req, res) {

    const client =
        await pool.connect();

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

        const parsedMovieId =
            Number(movieId);

        const parsedCinemaId =
            Number(cinemaId);

        const parsedScreenId =
            Number(screenId);

        const parsedTicketPrice =
            Number(ticketPrice);


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

        const datePattern =
            /^\d{4}-\d{2}-\d{2}$/;

        if (
            !datePattern.test(showDate)
        ) {

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

        const hours =
            Number(timeMatch[1]);

        const minutes =
            Number(timeMatch[2]);

        const seconds =
            Number(timeMatch[3] || 0);


        // ----------------------------------------------------
        // GET MOVIE RUNTIME
        // ----------------------------------------------------

        const movieResult =
            await client.query(
                `
                SELECT
                    movie_id,
                    title,
                    runtime_minutes,
                    status

                FROM movies

                WHERE movie_id = $1
                `,
                [parsedMovieId]
            );

        if (
            movieResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Movie not found'

            });

        }

        const movie =
            movieResult.rows[0];

        const movieTitle =
            movie.title;

        const runtimeMinutes =
            movie.runtime_minutes;

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

        const cinemaResult =
            await client.query(
                `
                SELECT
                    cinema_id,
                    cinema_name,
                    is_active

                FROM cinemas

                WHERE cinema_id = $1
                `,
                [parsedCinemaId]
            );

        if (
            cinemaResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Cinema not found'

            });

        }

        if (
            cinemaResult.rows[0].is_active !== 'Y'
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Cinema is not active'

            });

        }


        // ----------------------------------------------------
        // CHECK SCREEN
        // ----------------------------------------------------

        const screenResult =
            await client.query(
                `
                SELECT
                    screen_id,
                    screen_name,
                    cinema_id,
                    is_active

                FROM screens

                WHERE screen_id = $1
                `,
                [parsedScreenId]
            );

        if (
            screenResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'Screen not found'

            });

        }

        const screen =
            screenResult.rows[0];

        if (
            screen.cinema_id !== parsedCinemaId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'The selected screen does not belong to the selected cinema'

            });

        }

        if (
            screen.is_active !== 'Y'
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Screen is not active'

            });

        }


        // ----------------------------------------------------
        // BUILD START AND END TIMESTAMP
        // ----------------------------------------------------
        //
        // PostgreSQL can calculate the end timestamp directly
        // from the date, time and movie runtime.
        // ----------------------------------------------------

        const formattedStartTime =
            `${showDate} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        const startDateTime =
            new Date(
                `${showDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            );

        if (
            Number.isNaN(
                startDateTime.getTime()
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid date or start time'

            });

        }

        const endDateTime =
            new Date(startDateTime);

        endDateTime.setMinutes(
            endDateTime.getMinutes() +
            Number(runtimeMinutes)
        );


        // ----------------------------------------------------
        // FORMAT END TIME
        // ----------------------------------------------------

        const formatTimestamp =
            date => {

                const year =
                    date.getFullYear();

                const month =
                    String(
                        date.getMonth() + 1
                    ).padStart(2, '0');

                const day =
                    String(
                        date.getDate()
                    ).padStart(2, '0');

                const hour =
                    String(
                        date.getHours()
                    ).padStart(2, '0');

                const minute =
                    String(
                        date.getMinutes()
                    ).padStart(2, '0');

                const second =
                    String(
                        date.getSeconds()
                    ).padStart(2, '0');

                return `${year}-${month}-${day} ${hour}:${minute}:${second}`;

            };

        const formattedEndTime =
            formatTimestamp(endDateTime);


        // ----------------------------------------------------
        // START TRANSACTION
        // ----------------------------------------------------

        await client.query('BEGIN');


        // ----------------------------------------------------
        // CHECK FOR SCREEN CONFLICT
        // ----------------------------------------------------
        //
        // Two showtimes overlap when:
        //
        // existing start < requested end
        // AND
        // existing end > requested start
        //
        // This is the same overlap logic as the Oracle version.
        // ----------------------------------------------------

        const conflictResult =
            await client.query(
                `
                SELECT
                    showtime_id,
                    start_time,
                    end_time

                FROM showtimes

                WHERE screen_id = $1

                  AND show_date = $2::date

                  AND is_active = 'Y'

                  AND status NOT IN (
                      'CANCELLED',
                      'COMPLETED'
                  )

                  AND start_time < $3::timestamp

                  AND COALESCE(
                        end_time,
                        start_time
                      ) > $4::timestamp

                LIMIT 1
                `,
                [
                    parsedScreenId,
                    showDate,
                    formattedEndTime,
                    formattedStartTime
                ]
            );

        if (
            conflictResult.rows.length > 0
        ) {

            await client.query(
                'ROLLBACK'
            );

            return res.status(409).json({

                success: false,

                message:
                    'This screen already has a showtime that overlaps with the requested time',

                conflictingShowtimeId:
                    conflictResult.rows[0].showtime_id

            });

        }


        // ----------------------------------------------------
        // INSERT SHOWTIME
        // ----------------------------------------------------

        const insertResult =
            await client.query(
                `
                INSERT INTO showtimes (
                    movie_id,
                    cinema_id,
                    screen_id,
                    show_date,
                    start_time,
                    end_time,
                    ticket_price,
                    status,
                    is_active,
                    created_at,
                    updated_at
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4::date,
                    $5::timestamp,
                    $6::timestamp,
                    $7,
                    'SCHEDULED',
                    'Y',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )

                RETURNING showtime_id
                `,
                [
                    parsedMovieId,
                    parsedCinemaId,
                    parsedScreenId,
                    showDate,
                    formattedStartTime,
                    formattedEndTime,
                    parsedTicketPrice
                ]
            );

        const showtimeId =
            insertResult.rows[0].showtime_id;


        // ----------------------------------------------------
        // COMMIT
        // ----------------------------------------------------

        await client.query(
            'COMMIT'
        );


        // ----------------------------------------------------
        // RESPONSE
        // ----------------------------------------------------

        return res.status(201).json({

            success: true,

            message:
                'Showtime created successfully',

            showtime: {

                showtimeId,

                movieId:
                    parsedMovieId,

                movieTitle,

                cinemaId:
                    parsedCinemaId,

                screenId:
                    parsedScreenId,

                showDate,

                startTime:
                    formattedStartTime,

                endTime:
                    formattedEndTime,

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

        try {
            await client.query(
                'ROLLBACK'
            );
        } catch (rollbackError) {

            console.error(
                '❌ Rollback error:',
                rollbackError.message
            );

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

        client.release();

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