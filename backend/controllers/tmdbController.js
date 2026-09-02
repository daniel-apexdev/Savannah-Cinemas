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

const pool = require('../config/database');


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
// IMPORT GENRES
// ============================================================

async function importGenres(client, genres = []) {

    const genreIds = [];

    for (const genre of genres) {

        if (!genre.id || !genre.name) {
            continue;
        }

        const genreName =
            genre.name.trim();


        // ----------------------------------------------------
        // First check whether the TMDB genre already exists
        // ----------------------------------------------------

        const existingByTmdbId =
            await client.query(
                `
                SELECT genre_id
                FROM genres
                WHERE tmdb_genre_id = $1
                LIMIT 1
                `,
                [genre.id]
            );


        if (existingByTmdbId.rows.length > 0) {

            genreIds.push(
                existingByTmdbId.rows[0].genre_id
            );

            // Update the name in case TMDB has changed it
            await client.query(
                `
                UPDATE genres
                SET
                    genre_name = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE genre_id = $2
                `,
                [
                    genreName,
                    existingByTmdbId.rows[0].genre_id
                ]
            );

            continue;
        }


        // ----------------------------------------------------
        // If TMDB ID isn't found, check genre name
        // ----------------------------------------------------

        const existingByName =
            await client.query(
                `
                SELECT genre_id
                FROM genres
                WHERE LOWER(genre_name) = LOWER($1)
                LIMIT 1
                `,
                [genreName]
            );


        if (existingByName.rows.length > 0) {

            const genreId =
                existingByName.rows[0].genre_id;


            // ------------------------------------------------
            // Existing genre found by name.
            // Update TMDB ID if it is currently missing.
            // ------------------------------------------------

            await client.query(
                `
                UPDATE genres
                SET
                    tmdb_genre_id = COALESCE(
                        tmdb_genre_id,
                        $1
                    ),
                    updated_at = CURRENT_TIMESTAMP
                WHERE genre_id = $2
                `,
                [
                    genre.id,
                    genreId
                ]
            );


            genreIds.push(genreId);

            continue;
        }


        // ----------------------------------------------------
        // Genre doesn't exist — create it
        // ----------------------------------------------------

        const insertResult =
            await client.query(
                `
                INSERT INTO genres (
                    tmdb_genre_id,
                    genre_name,
                    created_at,
                    updated_at
                )
                VALUES (
                    $1,
                    $2,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                RETURNING genre_id
                `,
                [
                    genre.id,
                    genreName
                ]
            );


        genreIds.push(
            insertResult.rows[0].genre_id
        );
    }

    return genreIds;
}


// ============================================================
// LINK MOVIE TO GENRES
// ============================================================

async function linkMovieGenres(
    client,
    movieId,
    genreIds
) {

    for (const genreId of genreIds) {

        await client.query(
            `
            INSERT INTO movie_genres (
                movie_id,
                genre_id
            )
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [
                movieId,
                genreId
            ]
        );
    }
}


// ============================================================
// IMPORT MOVIE
// ============================================================

async function importMovie(
    client,
    tmdbMovie,
    status
) {

    const tmdbId =
        tmdbMovie.id;


    // --------------------------------------------------------
    // Get complete movie information from TMDB
    // --------------------------------------------------------

    console.log(
        `🎬 TMDB Request: /movie/${tmdbId}`
    );

    const details =
        await getMovieDetails(tmdbId);


    // --------------------------------------------------------
    // Check whether movie already exists
    // --------------------------------------------------------

    const existingResult =
        await client.query(
            `
            SELECT movie_id
            FROM movies
            WHERE tmdb_id = $1
            `,
            [tmdbId]
        );


    // --------------------------------------------------------
    // Prepare movie data
    // --------------------------------------------------------

    const title =
        details.title ||
        tmdbMovie.title ||
        'Untitled Movie';

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
        getImageUrl(
            details.poster_path,
            'w500'
        );

    const backdropUrl =
        getImageUrl(
            details.backdrop_path,
            'w1280'
        );

    const trailerUrl =
        getTrailerUrl(
            details.videos
        );

    const rating =
        details.vote_average !== undefined
            ? details.vote_average
            : null;


    // --------------------------------------------------------
    // Import genres
    // --------------------------------------------------------

    const genreIds =
        await importGenres(
            client,
            details.genres || []
        );


    // ========================================================
    // UPDATE EXISTING MOVIE
    // ========================================================

    if (existingResult.rows.length > 0) {

        const movieId =
            existingResult.rows[0].movie_id;


        await client.query(
            `
            UPDATE movies
            SET
                title = $1,
                original_title = $2,
                description = $3,
                release_date = $4,
                runtime_minutes = $5,
                poster_url = $6,
                backdrop_url = $7,
                trailer_url = $8,
                rating = $9,
                status = $10,
                updated_at = CURRENT_TIMESTAMP
            WHERE movie_id = $11
            `,
            [
                title,
                originalTitle,
                description,
                releaseDate || null,
                runtime,
                posterUrl,
                backdropUrl,
                trailerUrl,
                rating,
                status,
                movieId
            ]
        );


        // ----------------------------------------------------
        // Remove old genre relationships
        // ----------------------------------------------------

        await client.query(
            `
            DELETE FROM movie_genres
            WHERE movie_id = $1
            `,
            [movieId]
        );


        // ----------------------------------------------------
        // Add current genres
        // ----------------------------------------------------

        await linkMovieGenres(
            client,
            movieId,
            genreIds
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
        await client.query(
            `
            INSERT INTO movies (
                tmdb_id,
                title,
                original_title,
                description,
                release_date,
                runtime_minutes,
                poster_url,
                backdrop_url,
                trailer_url,
                rating,
                status
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11
            )
            RETURNING movie_id
            `,
            [
                tmdbId,
                title,
                originalTitle,
                description,
                releaseDate || null,
                runtime,
                posterUrl,
                backdropUrl,
                trailerUrl,
                rating,
                status
            ]
        );


    const movieId =
        insertResult.rows[0].movie_id;


    // --------------------------------------------------------
    // Link genres
    // --------------------------------------------------------

    await linkMovieGenres(
        client,
        movieId,
        genreIds
    );


    return {
        action: 'inserted',
        movieId,
        tmdbId,
        title
    };
}


// ============================================================
// IMPORT MOVIES FROM TMDB
// ============================================================

async function importMovies(req, res) {

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
        // Validate page
        // ----------------------------------------------------

        const moviePage =
            Math.max(
                Number(page) || 1,
                1
            );


        // ----------------------------------------------------
        // Validate limit
        // ----------------------------------------------------

        const movieLimit =
            Math.min(
                Math.max(
                    Number(limit) || 20,
                    1
                ),
                20
            );


        // ----------------------------------------------------
        // Get movies from TMDB
        // ----------------------------------------------------

        let tmdbResponse;


        switch (source) {

            case 'popular':

                console.log(
                    `🎬 TMDB Request: /movie/popular`
                );

                tmdbResponse =
                    await getPopularMovies(moviePage);

                break;


            case 'now_playing':

                console.log(
                    `🎬 TMDB Request: /movie/now_playing`
                );

                tmdbResponse =
                    await getNowPlayingMovies(moviePage);

                break;


            case 'upcoming':

                console.log(
                    `🎬 TMDB Request: /movie/upcoming`
                );

                tmdbResponse =
                    await getUpcomingMovies(moviePage);

                break;
        }


        const tmdbMovies =
            (tmdbResponse.results || [])
                .slice(0, movieLimit);


        // ----------------------------------------------------
        // Nothing returned
        // ----------------------------------------------------

        if (tmdbMovies.length === 0) {

            return res.json({

                success: true,

                message:
                    'TMDB returned no movies',

                imported: 0,

                updated: 0,

                failed: 0,

                movies: []

            });
        }


        const status =
            determineStatus(source);


        const results = [];

        let imported = 0;
        let updated = 0;
        let failed = 0;


        // ====================================================
        // IMPORT EACH MOVIE
        // ====================================================

        for (const tmdbMovie of tmdbMovies) {

            let client;

            try {

                // ------------------------------------------------
                // Each movie gets its own PostgreSQL connection
                // and transaction.
                // ------------------------------------------------

                client =
                    await pool.connect();


                await client.query('BEGIN');


                // ------------------------------------------------
                // Import movie
                // ------------------------------------------------

                const result =
                    await importMovie(
                        client,
                        tmdbMovie,
                        status
                    );


                // ------------------------------------------------
                // Commit THIS movie
                // ------------------------------------------------

                await client.query('COMMIT');


                // ------------------------------------------------
                // Record successful result
                // ------------------------------------------------

                results.push(result);


                if (
                    result.action === 'inserted'
                ) {

                    imported++;

                }


                if (
                    result.action === 'updated'
                ) {

                    updated++;

                }


            } catch (movieError) {

                failed++;


                console.error(
                    `❌ Failed to import TMDB movie ${tmdbMovie.id}:`,
                    movieError.message
                );


                // ------------------------------------------------
                // Roll back only THIS movie
                // ------------------------------------------------

                if (client) {

                    try {

                        await client.query(
                            'ROLLBACK'
                        );

                    } catch (rollbackError) {

                        console.error(
                            `❌ Rollback failed for TMDB movie ${tmdbMovie.id}:`,
                            rollbackError.message
                        );

                    }
                }


                results.push({

                    action: 'failed',

                    tmdbId:
                        tmdbMovie.id,

                    title:
                        tmdbMovie.title,

                    error:
                        movieError.message

                });


            } finally {

                // ------------------------------------------------
                // Release THIS movie's connection
                // ------------------------------------------------

                if (client) {

                    client.release();

                }
            }
        }


        // ========================================================
        // RESPONSE
        // ========================================================

        res.json({

            success:
                failed < tmdbMovies.length,

            message:
                `TMDB ${source} import completed`,

            source,

            page:
                moviePage,

            requested:
                movieLimit,

            imported,

            updated,

            failed,

            movies:
                results

        });


    } catch (error) {

        console.error(
            '❌ TMDB import error:',
            error
        );


        return res.status(500).json({

            success: false,

            message:
                'Failed to import movies from TMDB',

            error:
                process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined

        });
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    importMovies
};
