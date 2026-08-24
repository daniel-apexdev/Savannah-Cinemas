// ============================================================
// SAVANNAH CINEMAS - TMDB IMPORT CONTROLLER
// controllers/tmdbController.js
// ============================================================

const {
    getPopularMovies,
    getNowPlayingMovies,
    getUpcomingMovies,
    getMovieDetails,
    getImageUrl,
    getTrailerUrl
} = require('../services/tmdbService');

const {
    getConnection
} = require('../config/database');


// ============================================================
// DETERMINE SAVANNAH STATUS
// ============================================================

function determineStatus(source) {

    switch (source) {

        case 'now_playing':
            return 'NOW_SHOWING';

        case 'upcoming':
            return 'UPCOMING';

        case 'popular':
        default:
            return 'UPCOMING';
    }
}


// ============================================================
// IMPORT MOVIE
// ============================================================

async function importMovie(connection, tmdbMovie, status) {

    const tmdbId = tmdbMovie.id;

    // --------------------------------------------------------
    // Get complete movie information
    // --------------------------------------------------------

    const details =
        await getMovieDetails(tmdbId);

    // --------------------------------------------------------
    // Check whether movie already exists
    // --------------------------------------------------------

    const existingResult =
        await connection.execute(
            `
            SELECT MOVIE_ID
            FROM MOVIES
            WHERE TMDB_ID = :tmdbId
            `,
            {
                tmdbId
            }
        );

    // --------------------------------------------------------
    // Prepare movie data
    // --------------------------------------------------------

    const title =
        details.title || tmdbMovie.title;

    const originalTitle =
        details.original_title ||
        tmdbMovie.original_title ||
        null;

    const description =
        details.overview ||
        tmdbMovie.overview ||
        null;

    const releaseDate =
        details.release_date || null;

    const runtime =
        details.runtime || null;

    const posterUrl =
        getImageUrl(details.poster_path, 'w500');

    const backdropUrl =
        getImageUrl(details.backdrop_path, 'w1280');

    const trailerUrl =
        getTrailerUrl(details.videos);

    const rating =
        details.vote_average !== undefined
            ? details.vote_average
            : null;


    // ========================================================
    // UPDATE EXISTING MOVIE
    // ========================================================

    if (existingResult.rows.length > 0) {

        const movieId =
            existingResult.rows[0][0];

        await connection.execute(
            `
            UPDATE MOVIES
            SET
                TITLE = :title,
                ORIGINAL_TITLE = :originalTitle,
                DESCRIPTION = :description,
                RELEASE_DATE = CASE
                    WHEN :releaseDate IS NULL
                    THEN RELEASE_DATE
                    ELSE TO_DATE(:releaseDate, 'YYYY-MM-DD')
                END,
                RUNTIME_MINUTES = :runtime,
                POSTER_URL = :posterUrl,
                BACKDROP_URL = :backdropUrl,
                TRAILER_URL = :trailerUrl,
                RATING = :rating,
                UPDATED_AT = CURRENT_TIMESTAMP
            WHERE MOVIE_ID = :movieId
            `,
            {
                title,
                originalTitle,
                description,
                releaseDate,
                runtime,
                posterUrl,
                backdropUrl,
                trailerUrl,
                rating,
                movieId
            }
        );

        return {
            action: 'updated',
            movieId,
            tmdbId,
            title
        };
    }


    // ========================================================
    // INSERT NEW MOVIE
    // ========================================================

    const insertResult =
        await connection.execute(
            `
            INSERT INTO MOVIES (
                TMDB_ID,
                TITLE,
                ORIGINAL_TITLE,
                DESCRIPTION,
                RELEASE_DATE,
                RUNTIME_MINUTES,
                POSTER_URL,
                BACKDROP_URL,
                TRAILER_URL,
                RATING,
                STATUS
            )
            VALUES (
                :tmdbId,
                :title,
                :originalTitle,
                :description,
                CASE
                    WHEN :releaseDate IS NULL
                    THEN NULL
                    ELSE TO_DATE(:releaseDate, 'YYYY-MM-DD')
                END,
                :runtime,
                :posterUrl,
                :backdropUrl,
                :trailerUrl,
                :rating,
                :status
            )
            RETURNING MOVIE_ID INTO :movieId
            `,
            {
                tmdbId,
                title,
                originalTitle,
                description,
                releaseDate,
                runtime,
                posterUrl,
                backdropUrl,
                trailerUrl,
                rating,
                status,

                movieId: {
                    dir: require('oracledb').BIND_OUT,
                    type: require('oracledb').NUMBER
                }
            }
        );

    return {
        action: 'inserted',
        movieId: insertResult.outBinds.movieId[0],
        tmdbId,
        title
    };
}


// ============================================================
// IMPORT MOVIES FROM TMDB
// ============================================================

async function importMovies(req, res) {

    let connection;

    try {

        const {
            source = 'now_playing',
            page = 1,
            limit = 20
        } = req.body;


        // ----------------------------------------------------
        // Validate source
        // ----------------------------------------------------

        const validSources = [
            'popular',
            'now_playing',
            'upcoming'
        ];

        if (!validSources.includes(source)) {

            return res.status(400).json({
                success: false,
                message:
                    'Invalid source. Use popular, now_playing or upcoming.'
            });
        }


        // ----------------------------------------------------
        // Validate limit
        // ----------------------------------------------------

        const movieLimit =
            Math.min(Math.max(Number(limit) || 20, 1), 20);


        // ----------------------------------------------------
        // Get movies from TMDB
        // ----------------------------------------------------

        let tmdbResponse;

        switch (source) {

            case 'popular':

                tmdbResponse =
                    await getPopularMovies(page);

                break;

            case 'now_playing':

                tmdbResponse =
                    await getNowPlayingMovies(page);

                break;

            case 'upcoming':

                tmdbResponse =
                    await getUpcomingMovies(page);

                break;
        }


        const tmdbMovies =
            (tmdbResponse.results || [])
                .slice(0, movieLimit);


        if (tmdbMovies.length === 0) {

            return res.json({
                success: true,
                message: 'TMDB returned no movies',
                imported: 0,
                updated: 0
            });
        }


        // ----------------------------------------------------
        // Connect to Oracle
        // ----------------------------------------------------

        connection =
            await getConnection();


        const status =
            determineStatus(source);


        const results = [];

        let imported = 0;
        let updated = 0;


        // ----------------------------------------------------
        // Import each movie
        // ----------------------------------------------------

        for (const tmdbMovie of tmdbMovies) {

            try {

                const result =
                    await importMovie(
                        connection,
                        tmdbMovie,
                        status
                    );

                results.push(result);

                if (result.action === 'inserted') {
                    imported++;
                }

                if (result.action === 'updated') {
                    updated++;
                }

            } catch (movieError) {

                console.error(
                    `❌ Failed to import TMDB movie ${tmdbMovie.id}:`,
                    movieError.message
                );

                results.push({
                    action: 'failed',
                    tmdbId: tmdbMovie.id,
                    title: tmdbMovie.title,
                    error: movieError.message
                });
            }
        }


        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await connection.commit();


        // ----------------------------------------------------
        // Response
        // ----------------------------------------------------

        res.json({

            success: true,

            message:
                `TMDB ${source} movies imported successfully`,

            source,

            page,

            requested: movieLimit,

            imported,

            updated,

            failed:
                results.filter(
                    movie => movie.action === 'failed'
                ).length,

            movies: results

        });

    } catch (error) {

        console.error(
            '❌ TMDB import error:',
            error
        );


        if (connection) {

            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    'Rollback error:',
                    rollbackError.message
                );
            }
        }


        res.status(500).json({

            success: false,

            message:
                'Failed to import movies from TMDB',

            error:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined

        });

    } finally {

        if (connection) {

            try {
                await connection.close();
            } catch (closeError) {

                console.error(
                    'Connection close error:',
                    closeError.message
                );

            }
        }
    }
}


module.exports = {
    importMovies
};