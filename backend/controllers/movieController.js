// backend/controllers/movieController.js

const oracledb = require('oracledb');
const { getConnection } = require('../config/database');

// ============================================================
// GET ALL MOVIES
// GET /api/movies
// ============================================================

async function getMovies(req, res) {
    let connection;

    try {
        connection = await getConnection();

        const movieResult = await connection.execute(
    `
    SELECT
        m.MOVIE_ID,
        m.TITLE,
        m.ORIGINAL_TITLE,
        DBMS_LOB.SUBSTR(m.DESCRIPTION, 4000, 1) AS DESCRIPTION,
        m.RELEASE_DATE,
        m.RUNTIME_MINUTES,
        m.AGE_RATING,
        m.POSTER_URL,
        m.BACKDROP_URL,
        m.TRAILER_URL,
        m.RATING,
        m.STATUS,
        m.CREATED_AT,
        m.UPDATED_AT,

        s.STUDIO_ID,
        s.STUDIO_NAME,
        s.COUNTRY AS STUDIO_COUNTRY,
        s.WEBSITE_URL AS STUDIO_WEBSITE

    FROM MOVIES m

    LEFT JOIN STUDIOS s
        ON s.STUDIO_ID = m.STUDIO_ID

    WHERE m.MOVIE_ID = :movieId
    `,
    { movieId },
    {
        outFormat: oracledb.OUT_FORMAT_OBJECT
    }
);

        const movies = result.rows.map(movie => ({
            movieId: movie.MOVIE_ID,
            title: movie.TITLE,
            originalTitle: movie.ORIGINAL_TITLE,
            description: movie.DESCRIPTION,
            releaseDate: movie.RELEASE_DATE,
            runtimeMinutes: movie.RUNTIME_MINUTES,
            ageRating: movie.AGE_RATING,
            posterUrl: movie.POSTER_URL,
            backdropUrl: movie.BACKDROP_URL,
            trailerUrl: movie.TRAILER_URL,
            rating: movie.RATING,
            status: movie.STATUS,
            createdAt: movie.CREATED_AT,
            updatedAt: movie.UPDATED_AT,

            studio: movie.STUDIO_ID
                ? {
                    studioId: movie.STUDIO_ID,
                    studioName: movie.STUDIO_NAME,
                    country: movie.STUDIO_COUNTRY,
                    websiteUrl: movie.STUDIO_WEBSITE
                }
                : null,

            genres: []
        }));

        // ----------------------------------------------------
        // GET GENRES FOR ALL MOVIES
        // ----------------------------------------------------

        if (movies.length > 0) {

            const movieIds = movies.map(movie => movie.movieId);

            const genreResult = await connection.execute(
                `
                SELECT
                    mg.MOVIE_ID,
                    g.GENRE_ID,
                    g.GENRE_NAME
                FROM MOVIE_GENRES mg
                JOIN GENRES g
                    ON g.GENRE_ID = mg.GENRE_ID
                WHERE mg.MOVIE_ID IN (
                    SELECT COLUMN_VALUE
                    FROM TABLE(
                        SYS.ODCINUMBERLIST(${movieIds.join(',')})
                    )
                )
                ORDER BY g.GENRE_NAME
                `,
                {},
                {
                    outFormat: oracledb.OUT_FORMAT_OBJECT
                }
            );

            // ------------------------------------------------
            // ATTACH GENRES TO THEIR MOVIES
            // ------------------------------------------------

            genreResult.rows.forEach(genre => {

                const movie = movies.find(
                    movie => movie.movieId === genre.MOVIE_ID
                );

                if (movie) {
                    movie.genres.push({
                        genreId: genre.GENRE_ID,
                        genreName: genre.GENRE_NAME
                    });
                }
            });
        }

        res.json({
            success: true,
            count: movies.length,
            movies
        });

    } catch (error) {

        console.error('❌ Get movies error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching movies',
            error: error.message
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing movie connection:',
                    error.message
                );
            }
        }
    }
}


// ============================================================
// GET SINGLE MOVIE
// GET /api/movies/:id
// ============================================================

async function getMovieById(req, res) {

    let connection;

    try {

        const movieId = Number(req.params.id);

        if (!Number.isInteger(movieId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });
        }

        connection = await getConnection();

        // ----------------------------------------------------
        // MOVIE + STUDIO
        // ----------------------------------------------------

        const movieResult = await connection.execute(
            `
            SELECT
                m.MOVIE_ID,
                m.TITLE,
                m.ORIGINAL_TITLE,
                DBMS_LOB.SUBSTR(m.DESCRIPTION, 4000, 1) AS DESCRIPTION,
                m.RELEASE_DATE,
                m.RUNTIME_MINUTES,
                m.AGE_RATING,
                m.POSTER_URL,
                m.BACKDROP_URL,
                m.TRAILER_URL,
                m.RATING,
                m.STATUS,
                m.CREATED_AT,
                m.UPDATED_AT,

                s.STUDIO_ID,
                s.STUDIO_NAME,
                s.COUNTRY AS STUDIO_COUNTRY,
                s.WEBSITE_URL AS STUDIO_WEBSITE

            FROM MOVIES m

            LEFT JOIN STUDIOS s
                ON s.STUDIO_ID = m.STUDIO_ID

            WHERE m.MOVIE_ID = :movieId
            `,
            { movieId },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        if (movieResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });
        }

        const movie = movieResult.rows[0];

        // ----------------------------------------------------
        // GET GENRES
        // ----------------------------------------------------

        const genreResult = await connection.execute(
            `
            SELECT
                g.GENRE_ID,
                g.GENRE_NAME
            FROM MOVIE_GENRES mg
            JOIN GENRES g
                ON g.GENRE_ID = mg.GENRE_ID
            WHERE mg.MOVIE_ID = :movieId
            ORDER BY g.GENRE_NAME
            `,
            { movieId },
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        // ----------------------------------------------------
        // BUILD RESPONSE
        // ----------------------------------------------------

        res.json({
            success: true,

            movie: {
                movieId: movie.MOVIE_ID,
                title: movie.TITLE,
                originalTitle: movie.ORIGINAL_TITLE,
                description: movie.DESCRIPTION,
                releaseDate: movie.RELEASE_DATE,
                runtimeMinutes: movie.RUNTIME_MINUTES,
                ageRating: movie.AGE_RATING,
                posterUrl: movie.POSTER_URL,
                backdropUrl: movie.BACKDROP_URL,
                trailerUrl: movie.TRAILER_URL,
                rating: movie.RATING,
                status: movie.STATUS,
                createdAt: movie.CREATED_AT,
                updatedAt: movie.UPDATED_AT,

                studio: movie.STUDIO_ID
                    ? {
                        studioId: movie.STUDIO_ID,
                        studioName: movie.STUDIO_NAME,
                        country: movie.STUDIO_COUNTRY,
                        websiteUrl: movie.STUDIO_WEBSITE
                    }
                    : null,

                genres: genreResult.rows.map(genre => ({
                    genreId: genre.GENRE_ID,
                    genreName: genre.GENRE_NAME
                }))
            }
        });

    } catch (error) {

        console.error('❌ Get movie error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching movie',
            error: error.message
        });

    } finally {

        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error(
                    '❌ Error closing movie connection:',
                    error.message
                );
            }
        }
    }
}


// ============================================================
// GET NOW SHOWING
// GET /api/movies/now-showing
// ============================================================

async function getNowShowing(req, res) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                m.MOVIE_ID,
                m.TITLE,
                m.ORIGINAL_TITLE,
                DBMS_LOB.SUBSTR(m.DESCRIPTION, 4000, 1) AS DESCRIPTION,
                m.RELEASE_DATE,
                m.RUNTIME_MINUTES,
                m.AGE_RATING,
                m.POSTER_URL,
                m.BACKDROP_URL,
                m.TRAILER_URL,
                m.RATING,
                m.STATUS,
                s.STUDIO_ID,
                s.STUDIO_NAME

            FROM MOVIES m

            LEFT JOIN STUDIOS s
                ON s.STUDIO_ID = m.STUDIO_ID

            WHERE m.STATUS = 'NOW_SHOWING'

            ORDER BY m.TITLE
            `,
            {},
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        res.json({
            success: true,
            count: result.rows.length,

            movies: result.rows.map(movie => ({
                movieId: movie.MOVIE_ID,
                title: movie.TITLE,
                originalTitle: movie.ORIGINAL_TITLE,
                description: movie.DESCRIPTION,
                releaseDate: movie.RELEASE_DATE,
                runtimeMinutes: movie.RUNTIME_MINUTES,
                ageRating: movie.AGE_RATING,
                posterUrl: movie.POSTER_URL,
                backdropUrl: movie.BACKDROP_URL,
                trailerUrl: movie.TRAILER_URL,
                rating: movie.RATING,
                status: movie.STATUS,

                studio: movie.STUDIO_ID
                    ? {
                        studioId: movie.STUDIO_ID,
                        studioName: movie.STUDIO_NAME
                    }
                    : null
            }))
        });

    } catch (error) {

        console.error('❌ Get now showing error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching now showing movies',
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
// GET UPCOMING MOVIES
// GET /api/movies/upcoming
// ============================================================

async function getUpcomingMovies(req, res) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                m.MOVIE_ID,
                m.TITLE,
                m.ORIGINAL_TITLE,
                DBMS_LOB.SUBSTR(m.DESCRIPTION, 4000, 1) AS DESCRIPTION,
                m.RELEASE_DATE,
                m.RUNTIME_MINUTES,
                m.AGE_RATING,
                m.POSTER_URL,
                m.BACKDROP_URL,
                m.TRAILER_URL,
                m.RATING,
                m.STATUS,
                s.STUDIO_ID,
                s.STUDIO_NAME

            FROM MOVIES m

            LEFT JOIN STUDIOS s
                ON s.STUDIO_ID = m.STUDIO_ID

            WHERE m.STATUS = 'UPCOMING'

            ORDER BY m.RELEASE_DATE
            `,
            {},
            {
                outFormat: oracledb.OUT_FORMAT_OBJECT
            }
        );

        res.json({
            success: true,
            count: result.rows.length,

            movies: result.rows.map(movie => ({
                movieId: movie.MOVIE_ID,
                title: movie.TITLE,
                originalTitle: movie.ORIGINAL_TITLE,
                description: movie.DESCRIPTION,
                releaseDate: movie.RELEASE_DATE,
                runtimeMinutes: movie.RUNTIME_MINUTES,
                ageRating: movie.AGE_RATING,
                posterUrl: movie.POSTER_URL,
                backdropUrl: movie.BACKDROP_URL,
                trailerUrl: movie.TRAILER_URL,
                rating: movie.RATING,
                status: movie.STATUS,

                studio: movie.STUDIO_ID
                    ? {
                        studioId: movie.STUDIO_ID,
                        studioName: movie.STUDIO_NAME
                    }
                    : null
            }))
        });

    } catch (error) {

        console.error('❌ Get upcoming movies error:', error);

        res.status(500).json({
            success: false,
            message: 'Server error fetching upcoming movies',
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
// GET MOVIE SHOWTIMES
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

        // ----------------------------------------------------
        // Check movie exists
        // ----------------------------------------------------

        const movieResult = await connection.execute(
            `
            SELECT
                MOVIE_ID,
                TITLE,
                POSTER_URL,
                STATUS
            FROM MOVIES
            WHERE MOVIE_ID = :movieId
            `,
            {
                movieId
            }
        );

        if (movieResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });

        }

        const movie = movieResult.rows[0];

        // ----------------------------------------------------
        // Get upcoming showtimes
        // ----------------------------------------------------

        const result = await connection.execute(
            `
            SELECT
                ST.SHOWTIME_ID,

                ST.CINEMA_ID,
                C.CINEMA_NAME,
                C.CITY,

                ST.SCREEN_ID,
                S.SCREEN_NAME,
                S.SCREEN_TYPE,

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

              AND ST.STATUS IN (
                  'SCHEDULED',
                  'NOW_SHOWING'
              )

              AND (
                  ST.SHOW_DATE > TRUNC(SYSDATE)
                  OR (
                      ST.SHOW_DATE = TRUNC(SYSDATE)
                      AND ST.START_TIME >= CURRENT_TIMESTAMP
                  )
              )

            ORDER BY
                ST.SHOW_DATE,
                ST.START_TIME
            `,
            {
                movieId
            }
        );

        // ----------------------------------------------------
        // Format response
        // ----------------------------------------------------

        const showtimes = result.rows.map(row => ({

            showtimeId: row[0],

            cinema: {
                cinemaId: row[1],
                name: row[2],
                city: row[3]
            },

            screen: {
                screenId: row[4],
                name: row[5],
                type: row[6]
            },

            showDate: row[7],
            startTime: row[8],
            endTime: row[9],

            ticketPrice: row[10],

            status: row[11]

        }));

        res.json({

            success: true,

            movie: {
                movieId: movie[0],
                title: movie[1],
                posterUrl: movie[2],
                status: movie[3]
            },

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
            } catch (error) {

                console.error(
                    '❌ Error closing connection:',
                    error.message
                );

            }
        }
    }
}

module.exports = {
    getMovies,
    getMovieById,
    getNowShowing,
    getUpcomingMovies,
    getMovieShowtimes
};