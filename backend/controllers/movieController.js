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

// ============================================================
// SEARCH MOVIES
// ============================================================

async function searchMovies(req, res) {

    let connection;

    try {

        const { q } = req.query;

        // ----------------------------------------------------
        // Validate search query
        // ----------------------------------------------------

        if (!q || !q.trim()) {

            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });

        }

        const searchQuery = q.trim();

        if (searchQuery.length < 2) {

            return res.status(400).json({
                success: false,
                message: 'Search query must contain at least 2 characters'
            });

        }

        // ----------------------------------------------------
        // Database connection
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // Search movies
        // ----------------------------------------------------

        const result = await connection.execute(
    `
    SELECT
        MOVIE_ID,
        TMDB_ID,
        TITLE,
        ORIGINAL_TITLE,
        DBMS_LOB.SUBSTR(DESCRIPTION, 4000, 1) AS DESCRIPTION,
        RELEASE_DATE,
        RUNTIME_MINUTES,
        AGE_RATING,
        POSTER_URL,
        BACKDROP_URL,
        TRAILER_URL,
        RATING,
        STATUS
    FROM MOVIES
    WHERE
        UPPER(TITLE) LIKE '%' || UPPER(:searchQuery) || '%'
        OR
        UPPER(ORIGINAL_TITLE) LIKE '%' || UPPER(:searchQuery) || '%'
        OR
        UPPER(DBMS_LOB.SUBSTR(DESCRIPTION, 4000, 1))
            LIKE '%' || UPPER(:searchQuery) || '%'
    ORDER BY
        CASE
            WHEN UPPER(TITLE) = UPPER(:exactQuery)
                THEN 1

            WHEN UPPER(TITLE) LIKE
                 UPPER(:prefixQuery) || '%'
                THEN 2

            WHEN UPPER(TITLE) LIKE
                 '%' || UPPER(:searchQuery) || '%'
                THEN 3

            ELSE 4
        END,
        RATING DESC NULLS LAST,
        RELEASE_DATE DESC NULLS LAST
    `,
    {
        searchQuery,
        exactQuery: searchQuery,
        prefixQuery: searchQuery
    }
);

        // ----------------------------------------------------
        // Format results
        // ----------------------------------------------------

        const movies = result.rows.map(row => ({

            movieId: row[0],

            tmdbId: row[1],

            title: row[2],

            originalTitle: row[3],

            description: row[4],

            releaseDate: row[5],

            runtimeMinutes: row[6],

            ageRating: row[7],

            posterUrl: row[8],

            backdropUrl: row[9],

            trailerUrl: row[10],

            rating: row[11],

            status: row[12]

        }));

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            query: searchQuery,

            count: movies.length,

            movies

        });

    } catch (error) {

        console.error(
            '❌ Search movies error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: 'Server error searching movies',

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
// GET COMING SOON MOVIES
// ============================================================

async function getComingSoonMovies(req, res) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
    M.MOVIE_ID,
    M.TMDB_ID,
    M.TITLE,
    M.ORIGINAL_TITLE,

    DBMS_LOB.SUBSTR(
        M.DESCRIPTION,
        4000,
        1
    ) AS DESCRIPTION,

    M.RELEASE_DATE,
    M.RUNTIME_MINUTES,
    M.AGE_RATING,

    M.POSTER_URL,
    M.BACKDROP_URL,
    M.TRAILER_URL,

    M.RATING,
    M.STATUS

FROM MOVIES M

WHERE
    M.RELEASE_DATE > TRUNC(CURRENT_DATE)

ORDER BY
    M.RELEASE_DATE ASC,
    M.TITLE ASC
            `
        );

        // ----------------------------------------------------
        // Format movies
        // ----------------------------------------------------

        const movies = result.rows.map(row => ({

            movieId: row[0],

            tmdbId: row[1],

            title: row[2],

            originalTitle: row[3],

            description: row[4],

            releaseDate: row[5],

            runtimeMinutes: row[6],

            ageRating: row[7],

            posterUrl: row[8],

            backdropUrl: row[9],

            trailerUrl: row[10],

            rating: row[11],

            status: row[12]

        }));

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            count: movies.length,

            movies

        });

    } catch (error) {

        console.error(
            '❌ Get coming soon movies error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching coming soon movies',

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

async function getMovieDetails(req, res) {

    let connection;

    try {

        const movieId = Number(req.params.movieId);

        // ----------------------------------------------------
        // Validate movie ID
        // ----------------------------------------------------

        if (!Number.isInteger(movieId)) {

            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });

        }

        // ----------------------------------------------------
        // Database connection
        // ----------------------------------------------------

        connection = await getConnection();

        // ----------------------------------------------------
        // Get movie
        // ----------------------------------------------------

        const movieResult = await connection.execute(
            `
            SELECT
                M.MOVIE_ID,
                M.TMDB_ID,
                M.TITLE,
                M.ORIGINAL_TITLE,

                DBMS_LOB.SUBSTR(
                    M.DESCRIPTION,
                    4000,
                    1
                ) AS DESCRIPTION,

                M.RELEASE_DATE,
                M.RUNTIME_MINUTES,
                M.AGE_RATING,

                M.POSTER_URL,
                M.BACKDROP_URL,
                M.TRAILER_URL,

                M.RATING,
                M.STATUS,

                M.STUDIO_ID,

                ST.STUDIO_NAME

            FROM MOVIES M

            LEFT JOIN STUDIOS ST
                ON ST.STUDIO_ID = M.STUDIO_ID

            WHERE M.MOVIE_ID = :movieId
            `,
            {
                movieId
            }
        );

        // ----------------------------------------------------
        // Movie not found
        // ----------------------------------------------------

        if (movieResult.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });

        }

        const movie = movieResult.rows[0];

        /*
            INDEXES

            0  MOVIE_ID
            1  TMDB_ID
            2  TITLE
            3  ORIGINAL_TITLE
            4  DESCRIPTION
            5  RELEASE_DATE
            6  RUNTIME_MINUTES
            7  AGE_RATING
            8  POSTER_URL
            9  BACKDROP_URL
            10 TRAILER_URL
            11 RATING
            12 STATUS
            13 STUDIO_ID
            14 STUDIO_NAME
        */

        // ----------------------------------------------------
        // Get genres
        // ----------------------------------------------------

        const genresResult = await connection.execute(
            `
            SELECT
                G.GENRE_ID,
                G.GENRE_NAME

            FROM MOVIE_GENRES MG

            JOIN GENRES G
                ON G.GENRE_ID = MG.GENRE_ID

            WHERE MG.MOVIE_ID = :movieId

            ORDER BY G.GENRE_NAME
            `,
            {
                movieId
            }
        );

        // ----------------------------------------------------
        // Get images
        // ----------------------------------------------------

        const imagesResult = await connection.execute(
            `
            SELECT
                IMAGE_ID,
                IMAGE_TYPE,
                IMAGE_URL

            FROM MOVIE_IMAGES

            WHERE MOVIE_ID = :movieId

            ORDER BY
                IMAGE_TYPE,
                IMAGE_ID
            `,
            {
                movieId
            }
        );

        // ----------------------------------------------------
        // Get cast
        // ----------------------------------------------------

        const castResult = await connection.execute(
            `
            SELECT
                P.PERSON_ID,
                P.NAME,
                MC.CHARACTER_NAME,
                P.PROFILE_URL

            FROM MOVIE_CAST MC

            JOIN PEOPLE P
                ON P.PERSON_ID = MC.PERSON_ID

            WHERE MC.MOVIE_ID = :movieId

            ORDER BY MC.CAST_ORDER
            `,
            {
                movieId
            }
        );

        // ----------------------------------------------------
        // Get crew
        // ----------------------------------------------------

        const crewResult = await connection.execute(
            `
            SELECT
                P.PERSON_ID,
                P.NAME,
                MC.JOB,
                MC.DEPARTMENT,
                P.PROFILE_URL

            FROM MOVIE_CREW MC

            JOIN PEOPLE P
                ON P.PERSON_ID = MC.PERSON_ID

            WHERE MC.MOVIE_ID = :movieId

            ORDER BY
                MC.DEPARTMENT,
                MC.JOB,
                P.NAME
            `,
            {
                movieId
            }
        );

        // ----------------------------------------------------
        // Get upcoming showtimes
        // ----------------------------------------------------

        const showtimesResult = await connection.execute(
            `
            SELECT
                ST.SHOWTIME_ID,

                C.CINEMA_ID,
                C.CINEMA_NAME,

                S.SCREEN_ID,
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

              AND ST.STATUS IN (
                  'SCHEDULED',
                  'NOW_SHOWING'
              )

              AND (
                  ST.SHOW_DATE > TRUNC(CURRENT_DATE)

                  OR

                  (
                      ST.SHOW_DATE = TRUNC(CURRENT_DATE)

                      AND ST.START_TIME > CURRENT_TIMESTAMP
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
        // Build response
        // ----------------------------------------------------

        const response = {

            movieId: movie[0],
            tmdbId: movie[1],
            title: movie[2],
            originalTitle: movie[3],
            description: movie[4],

            releaseDate: movie[5],

            runtimeMinutes: movie[6],

            ageRating: movie[7],

            posterUrl: movie[8],
            backdropUrl: movie[9],
            trailerUrl: movie[10],

            rating: movie[11],

            status: movie[12],

            studio: movie[13]
                ? {
                    studioId: movie[13],
                    name: movie[14]
                }
                : null,

            genres:
                genresResult.rows.map(row => ({
                    genreId: row[0],
                    name: row[1]
                })),

            images:
                imagesResult.rows.map(row => ({
                    imageId: row[0],
                    imageType: row[1],
                    imageUrl: row[2]
                })),

            cast:
                castResult.rows.map(row => ({
                    personId: row[0],
                    name: row[1],
                    characterName: row[2],
                    profileUrl: row[3]
                })),

            crew:
                crewResult.rows.map(row => ({
                    personId: row[0],
                    name: row[1],
                    job: row[2],
                    department: row[3],
                    profileUrl: row[4]
                })),

            showtimes:
                showtimesResult.rows.map(row => ({

                    showtimeId: row[0],

                    cinema: {
                        cinemaId: row[1],
                        name: row[2]
                    },

                    screen: {
                        screenId: row[3],
                        name: row[4]
                    },

                    showDate: row[5],
                    startTime: row[6],
                    endTime: row[7],

                    ticketPrice: row[8],

                    status: row[9]

                }))

        };

        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        return res.json({

            success: true,

            movie: response

        });

    } catch (error) {

        console.error(
            '❌ Get movie details error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching movie details',

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
// GET TOP RATED MOVIES
// ============================================================

async function getTopRatedMovies(req, res) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                M.MOVIE_ID,
                M.TMDB_ID,
                M.TITLE,
                M.ORIGINAL_TITLE,

                DBMS_LOB.SUBSTR(
                    M.DESCRIPTION,
                    4000,
                    1
                ) AS DESCRIPTION,

                M.RELEASE_DATE,
                M.RUNTIME_MINUTES,
                M.AGE_RATING,

                M.POSTER_URL,
                M.BACKDROP_URL,
                M.TRAILER_URL,

                M.RATING,
                M.STATUS

            FROM MOVIES M

            WHERE M.RATING IS NOT NULL

            ORDER BY
                M.RATING DESC,
                M.TITLE ASC

            FETCH FIRST 20 ROWS ONLY
            `
        );

        const movies = result.rows.map(row => ({

            movieId: row[0],

            tmdbId: row[1],

            title: row[2],

            originalTitle: row[3],

            description: row[4],

            releaseDate: row[5],

            runtimeMinutes: row[6],

            ageRating: row[7],

            posterUrl: row[8],

            backdropUrl: row[9],

            trailerUrl: row[10],

            rating: row[11],

            status: row[12]

        }));

        return res.json({

            success: true,

            count: movies.length,

            movies

        });

    } catch (error) {

        console.error(
            '❌ Get top rated movies error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching top rated movies',

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
// GET POPULAR MOVIES
// ============================================================

async function getPopularMovies(req, res) {

    let connection;

    try {

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                M.MOVIE_ID,
                M.TMDB_ID,
                M.TITLE,
                M.ORIGINAL_TITLE,

                DBMS_LOB.SUBSTR(
                    M.DESCRIPTION,
                    4000,
                    1
                ) AS DESCRIPTION,

                M.RELEASE_DATE,
                M.RUNTIME_MINUTES,
                M.AGE_RATING,

                M.POSTER_URL,
                M.BACKDROP_URL,
                M.TRAILER_URL,

                M.RATING,
                M.STATUS,

                COUNT(
    CASE
        WHEN B.BOOKING_ID IS NOT NULL
        THEN BS.BOOKING_SEAT_ID
    END
) AS TICKETS_SOLD

            FROM MOVIES M

            LEFT JOIN SHOWTIMES ST
                ON ST.MOVIE_ID = M.MOVIE_ID

            LEFT JOIN BOOKING_SEATS BS
                ON BS.SHOWTIME_ID = ST.SHOWTIME_ID

            LEFT JOIN BOOKINGS B
                ON B.BOOKING_ID = BS.BOOKING_ID

                AND B.STATUS IN (
                    'CONFIRMED',
                    'COMPLETED'
                )

            WHERE
                M.STATUS IN (
                    'NOW_SHOWING',
                    'COMING_SOON'
                )

            GROUP BY
                M.MOVIE_ID,
                M.TMDB_ID,
                M.TITLE,
                M.ORIGINAL_TITLE,

                DBMS_LOB.SUBSTR(
                    M.DESCRIPTION,
                    4000,
                    1
                ),

                M.RELEASE_DATE,
                M.RUNTIME_MINUTES,
                M.AGE_RATING,

                M.POSTER_URL,
                M.BACKDROP_URL,
                M.TRAILER_URL,

                M.RATING,
                M.STATUS

            ORDER BY
                TICKETS_SOLD DESC,
                M.RATING DESC,
                M.TITLE ASC

            FETCH FIRST 20 ROWS ONLY
            `
        );

        const movies = result.rows.map(row => ({

            movieId: row[0],

            tmdbId: row[1],

            title: row[2],

            originalTitle: row[3],

            description: row[4],

            releaseDate: row[5],

            runtimeMinutes: row[6],

            ageRating: row[7],

            posterUrl: row[8],

            backdropUrl: row[9],

            trailerUrl: row[10],

            rating: row[11],

            status: row[12],

            ticketsSold: Number(row[13])

        }));

        return res.json({

            success: true,

            count: movies.length,

            movies

        });

    } catch (error) {

        console.error(
            '❌ Get popular movies error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching popular movies',

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
// GET RECOMMENDED MOVIES
// ============================================================

async function getRecommendedMovies(req, res) {

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
    WITH

    -- =========================================================
    -- USER'S PREFERRED GENRES
    -- =========================================================

    PREFERRED_GENRES AS (

        SELECT
            G.GENRE_ID

        FROM USER_PREFERENCES UP

        JOIN GENRES G
            ON UPPER(G.GENRE_NAME) =
               UPPER(UP.PREFERENCE_VALUE)

        WHERE UP.USER_ID = :userId

          AND UP.PREFERENCE_TYPE = 'GENRE'
    ),

    -- =========================================================
    -- GENRES FROM MOVIES THE USER HAS WATCHED
    -- =========================================================

    VIEWED_GENRES AS (

        SELECT DISTINCT
            MG.GENRE_ID

        FROM USER_MOVIE_VIEWS UMV

        JOIN MOVIE_GENRES MG
            ON MG.MOVIE_ID = UMV.MOVIE_ID

        WHERE UMV.USER_ID = :userId
    ),

    -- =========================================================
    -- MOVIES ALREADY WATCHED
    -- =========================================================

    WATCHED_MOVIES AS (

        SELECT
            MOVIE_ID

        FROM USER_MOVIE_VIEWS

        WHERE USER_ID = :userId
    ),

    -- =========================================================
    -- SCORE MOVIES
    -- =========================================================

    SCORED_MOVIES AS (

        SELECT

            M.MOVIE_ID,
            M.TMDB_ID,
            M.TITLE,
            M.ORIGINAL_TITLE,

            DBMS_LOB.SUBSTR(
                M.DESCRIPTION,
                4000,
                1
            ) AS DESCRIPTION,

            M.RELEASE_DATE,
            M.RUNTIME_MINUTES,
            M.AGE_RATING,

            M.POSTER_URL,
            M.BACKDROP_URL,
            M.TRAILER_URL,

            M.RATING,
            M.STATUS,

            (
                -- =============================================
                -- PREFERRED GENRE
                -- =============================================

                NVL(
                    (
                        SELECT COUNT(*)

                        FROM MOVIE_GENRES MG

                        JOIN PREFERRED_GENRES PG
                            ON PG.GENRE_ID =
                               MG.GENRE_ID

                        WHERE MG.MOVIE_ID =
                              M.MOVIE_ID

                    ) * 30,

                    0
                )

                +

                -- =============================================
                -- SIMILAR TO WATCHED MOVIES
                -- =============================================

                NVL(
                    (
                        SELECT COUNT(*)

                        FROM MOVIE_GENRES MG

                        JOIN VIEWED_GENRES VG
                            ON VG.GENRE_ID =
                               MG.GENRE_ID

                        WHERE MG.MOVIE_ID =
                              M.MOVIE_ID

                    ) * 20,

                    0
                )

                +

                -- =============================================
                -- RATING BOOST
                -- =============================================

                CASE

                    WHEN M.RATING >= 8
                        THEN 10

                    WHEN M.RATING >= 7
                        THEN 5

                    ELSE 0

                END

            ) AS RECOMMENDATION_SCORE

        FROM MOVIES M

        WHERE M.STATUS IN (
            'NOW_SHOWING',
            'COMING_SOON'
        )

        -- =============================================
        -- DON'T RECOMMEND ALREADY WATCHED MOVIES
        -- =============================================

        AND NOT EXISTS (

            SELECT 1

            FROM WATCHED_MOVIES W

            WHERE W.MOVIE_ID =
                  M.MOVIE_ID
        )
    )

    -- =========================================================
    -- FINAL RESULTS
    -- =========================================================

    SELECT *

    FROM SCORED_MOVIES

    WHERE RECOMMENDATION_SCORE > 0

    ORDER BY

        RECOMMENDATION_SCORE DESC,

        RATING DESC NULLS LAST,

        RELEASE_DATE DESC NULLS LAST

    FETCH FIRST 20 ROWS ONLY
    `,
    {
        userId
    }
);

        // =====================================================
        // FORMAT RESPONSE
        // =====================================================

        const movies = result.rows.map(row => ({

            movieId: row[0],

            tmdbId: row[1],

            title: row[2],

            originalTitle: row[3],

            description: row[4],

            releaseDate: row[5],

            runtimeMinutes: row[6],

            ageRating: row[7],

            posterUrl: row[8],

            backdropUrl: row[9],

            trailerUrl: row[10],

            rating: row[11],

            status: row[12],

            recommendationScore: row[13]

        }));

        return res.json({

            success: true,

            count: movies.length,

            movies

        });

    } catch (error) {

        console.error(
            '❌ Get recommended movies error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error fetching recommended movies',

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


module.exports = {
    getMovies,
    getMovieById,
    getNowShowing,
    getUpcomingMovies,
    getMovieShowtimes,
    searchMovies,
    getComingSoonMovies,
    getMovieDetails,
    getTopRatedMovies,
    getPopularMovies,
    getRecommendedMovies
};