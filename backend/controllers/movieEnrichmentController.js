const axios = require('axios');
const pool = require('../config/database');


// ============================================================
// TMDB CONFIGURATION
// ============================================================

const TMDB_BASE_URL =
    process.env.TMDB_BASE_URL ||
    'https://api.themoviedb.org/3';

const TMDB_API_KEY =
    process.env.TMDB_API_KEY;

const TMDB_IMAGE_BASE_URL =
    process.env.TMDB_IMAGE_BASE_URL ||
    'https://image.tmdb.org/t/p';


// ============================================================
// HELPER - TMDB REQUEST
// ============================================================

async function getTMDBMovie(tmdbId) {

    if (!TMDB_API_KEY) {
        throw new Error('TMDB_API_KEY is not configured');
    }

    const response = await axios.get(
        `${TMDB_BASE_URL}/movie/${tmdbId}`,
        {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
                append_to_response: 'credits,videos'
            },
            timeout: 15000
        }
    );

    return response.data;
}


// ============================================================
// HELPER - GET TRAILER
// ============================================================

function getTrailerUrl(videos) {

    if (
        !videos ||
        !Array.isArray(videos.results)
    ) {
        return null;
    }

    const youtubeVideos =
        videos.results.filter(
            video =>
                video.site === 'YouTube'
        );


    // --------------------------------------------------------
    // Prefer official trailers
    // --------------------------------------------------------

    const officialTrailer =
        youtubeVideos.find(
            video =>
                video.type === 'Trailer' &&
                video.official === true
        );

    if (officialTrailer) {

        return `https://www.youtube.com/watch?v=${officialTrailer.key}`;

    }


    // --------------------------------------------------------
    // Then any trailer
    // --------------------------------------------------------

    const trailer =
        youtubeVideos.find(
            video =>
                video.type === 'Trailer'
        );

    if (trailer) {

        return `https://www.youtube.com/watch?v=${trailer.key}`;

    }


    // --------------------------------------------------------
    // Finally teaser
    // --------------------------------------------------------

    const teaser =
        youtubeVideos.find(
            video =>
                video.type === 'Teaser'
        );

    if (teaser) {

        return `https://www.youtube.com/watch?v=${teaser.key}`;

    }

    return null;
}


// ============================================================
// HELPER - BUILD IMAGE URL
// ============================================================

function buildImageUrl(path, size) {

    if (!path) {
        return null;
    }

    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}


// ============================================================
// HELPER - GET OR CREATE STUDIO
// ============================================================

async function getOrCreateStudio(client, studioName) {

    if (!studioName) {
        return null;
    }


    // --------------------------------------------------------
    // Check if studio already exists
    // --------------------------------------------------------

    const existingResult =
        await client.query(
            `
            SELECT
                studio_id
            FROM studios
            WHERE LOWER(studio_name) = LOWER($1)
            LIMIT 1
            `,
            [studioName]
        );


    if (existingResult.rows.length > 0) {

        const studioId =
            existingResult.rows[0].studio_id;


        await client.query(
            `
            UPDATE studios
            SET
                updated_at = CURRENT_TIMESTAMP
            WHERE studio_id = $1
            `,
            [studioId]
        );


        return studioId;
    }


    // --------------------------------------------------------
    // Create studio
    // --------------------------------------------------------

    const insertResult =
        await client.query(
            `
            INSERT INTO studios (
                studio_name,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            RETURNING studio_id
            `,
            [studioName]
        );


    return insertResult.rows[0].studio_id;
}


// ============================================================
// HELPER - GET OR CREATE GENRE
// ============================================================

async function getOrCreateGenre(client, genre) {

    if (
        !genre ||
        !genre.id ||
        !genre.name
    ) {
        return null;
    }


    const genreName = genre.name;
    const tmdbGenreId = genre.id;


    // --------------------------------------------------------
    // First check by TMDB genre ID
    // --------------------------------------------------------

    const tmdbResult =
        await client.query(
            `
            SELECT
                genre_id
            FROM genres
            WHERE tmdb_genre_id = $1
            LIMIT 1
            `,
            [tmdbGenreId]
        );


    if (tmdbResult.rows.length > 0) {

        const genreId =
            tmdbResult.rows[0].genre_id;


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
                genreId
            ]
        );


        return genreId;
    }


    // --------------------------------------------------------
    // Then check by genre name
    //
    // This prevents:
    //
    // duplicate key value violates
    // unique constraint "genres_genre_name_key"
    // --------------------------------------------------------

    const nameResult =
        await client.query(
            `
            SELECT
                genre_id
            FROM genres
            WHERE LOWER(genre_name) = LOWER($1)
            LIMIT 1
            `,
            [genreName]
        );


    if (nameResult.rows.length > 0) {

        const genreId =
            nameResult.rows[0].genre_id;


        // Add TMDB ID if the existing genre
        // doesn't already have one

        await client.query(
            `
            UPDATE genres
            SET
                tmdb_genre_id =
                    COALESCE(
                        tmdb_genre_id,
                        $1
                    ),
                updated_at =
                    CURRENT_TIMESTAMP
            WHERE genre_id = $2
            `,
            [
                tmdbGenreId,
                genreId
            ]
        );


        return genreId;
    }


    // --------------------------------------------------------
    // Create new genre
    // --------------------------------------------------------

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
                tmdbGenreId,
                genreName
            ]
        );


    return insertResult.rows[0].genre_id;
}


// ============================================================
// HELPER - GET OR CREATE PERSON
// ============================================================

async function getOrCreatePerson(client, person) {

    if (
        !person ||
        !person.id ||
        !person.name
    ) {
        return null;
    }


    const tmdbPersonId = person.id;
    const personName = person.name;

    const profileUrl =
        buildImageUrl(
            person.profile_path,
            'w500'
        );


    // --------------------------------------------------------
    // Check existing person
    // --------------------------------------------------------

    const existingResult =
        await client.query(
            `
            SELECT
                person_id
            FROM people
            WHERE tmdb_person_id = $1
            LIMIT 1
            `,
            [tmdbPersonId]
        );


    // --------------------------------------------------------
    // Update existing person
    // --------------------------------------------------------

    if (existingResult.rows.length > 0) {

        const personId =
            existingResult.rows[0].person_id;


        await client.query(
            `
            UPDATE people
            SET
                name = $1,

                profile_url =
                    COALESCE(
                        $2,
                        profile_url
                    ),

                updated_at =
                    CURRENT_TIMESTAMP
            WHERE person_id = $3
            `,
            [
                personName,
                profileUrl,
                personId
            ]
        );


        return personId;
    }


    // --------------------------------------------------------
    // Create person
    // --------------------------------------------------------

    const insertResult =
        await client.query(
            `
            INSERT INTO people (
                tmdb_person_id,
                name,
                profile_url,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                $2,
                $3,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            RETURNING person_id
            `,
            [
                tmdbPersonId,
                personName,
                profileUrl
            ]
        );


    return insertResult.rows[0].person_id;
}


// ============================================================
// ENRICH ONE MOVIE
// ============================================================

async function enrichMovie(client, movieId) {


    // ========================================================
    // GET EXISTING MOVIE
    // ========================================================

    const movieResult =
        await client.query(
            `
            SELECT
                movie_id,
                tmdb_id,
                title
            FROM movies
            WHERE movie_id = $1
            `,
            [movieId]
        );


    if (movieResult.rows.length === 0) {

        throw new Error(
            `Movie ${movieId} not found`
        );

    }


    const movie =
        movieResult.rows[0];

    const tmdbId =
        movie.tmdb_id;

    const currentTitle =
        movie.title;


    if (!tmdbId) {

        throw new Error(
            `Movie ${movieId} does not have a TMDB_ID`
        );

    }


    console.log(
        `🎬 Enriching movie: ${currentTitle} | TMDB ${tmdbId}`
    );


    // ========================================================
    // GET TMDB DATA
    // ========================================================

    const tmdb =
        await getTMDBMovie(tmdbId);


    // ========================================================
    // EXTRACT TRAILER
    // ========================================================

    const trailerUrl =
        getTrailerUrl(tmdb.videos);


    // ========================================================
    // HANDLE STUDIO
    //
    // MOVIES currently has one STUDIO_ID.
    // We use the first TMDB production company.
    // ========================================================

    let studioId = null;


    if (
        Array.isArray(
            tmdb.production_companies
        ) &&
        tmdb.production_companies.length > 0
    ) {

        const studio =
            tmdb.production_companies[0];


        studioId =
            await getOrCreateStudio(
                client,
                studio.name
            );

    }


    // ========================================================
    // UPDATE MOVIE
    // ========================================================

    await client.query(
        `
        UPDATE movies
        SET
            original_title = $1,

            description = $2,

            release_date =
            COALESCE(
                $3::date,
                release_date
            ),

            runtime_minutes = $4,

            poster_url = $5,

            backdrop_url = $6,

            trailer_url =
                COALESCE(
                    $7,
                    trailer_url
                ),

            rating = $8,

            studio_id =
                COALESCE(
                    $9,
                    studio_id
                ),

            updated_at =
                CURRENT_TIMESTAMP

        WHERE movie_id = $10
        `,
        [
            tmdb.original_title || null,

            tmdb.overview || null,

            tmdb.release_date || null,

            tmdb.runtime || null,

            buildImageUrl(
                tmdb.poster_path,
                'w500'
            ),

            buildImageUrl(
                tmdb.backdrop_path,
                'w1280'
            ),

            trailerUrl,

            tmdb.vote_average ?? null,

            studioId,

            movieId
        ]
    );


    // ========================================================
    // GENRES
    // ========================================================

    // Remove existing relationships

    await client.query(
        `
        DELETE FROM movie_genres
        WHERE movie_id = $1
        `,
        [movieId]
    );


    if (
        Array.isArray(tmdb.genres)
    ) {

        for (
            const genre of tmdb.genres
        ) {

            const genreId =
                await getOrCreateGenre(
                    client,
                    genre
                );


            if (!genreId) {
                continue;
            }


            await client.query(
                `
                INSERT INTO movie_genres (
                    movie_id,
                    genre_id
                )
                VALUES (
                    $1,
                    $2
                )
                ON CONFLICT DO NOTHING
                `,
                [
                    movieId,
                    genreId
                ]
            );

        }

    }


    // ========================================================
    // PEOPLE
    // ========================================================

    const credits =
        tmdb.credits || {};

    const cast =
        Array.isArray(credits.cast)
            ? credits.cast
            : [];

    const crew =
        Array.isArray(credits.crew)
            ? credits.crew
            : [];


    // ========================================================
    // CLEAR OLD CAST / CREW
    // ========================================================

    await client.query(
        `
        DELETE FROM movie_cast
        WHERE movie_id = $1
        `,
        [movieId]
    );


    await client.query(
        `
        DELETE FROM movie_crew
        WHERE movie_id = $1
        `,
        [movieId]
    );


    // ========================================================
    // CAST
    // ========================================================

    for (
        const actor of cast
    ) {

        if (
            !actor.id ||
            !actor.name
        ) {
            continue;
        }


        const personId =
            await getOrCreatePerson(
                client,
                actor
            );


        if (!personId) {
            continue;
        }


        await client.query(
            `
            INSERT INTO movie_cast (
                movie_id,
                person_id,
                character_name,
                cast_order
            )
            VALUES (
                $1,
                $2,
                $3,
                $4
            )
            `,
            [
                movieId,

                personId,

                actor.character ||
                    null,

                actor.order ??
                    null
            ]
        );

    }


    // ========================================================
    // CREW
    // ========================================================

    for (
        const member of crew
    ) {

        if (
            !member.id ||
            !member.name
        ) {
            continue;
        }


        const personId =
            await getOrCreatePerson(
                client,
                member
            );


        if (!personId) {
            continue;
        }


        await client.query(
            `
            INSERT INTO movie_crew (
                movie_id,
                person_id,
                department,
                job
            )
            VALUES (
                $1,
                $2,
                $3,
                $4
            )
            `,
            [
                movieId,

                personId,

                member.department ||
                    null,

                member.job ||
                    null
            ]
        );

    }


    // ========================================================
    // RETURN RESULT
    // ========================================================

    return {

        movieId,

        tmdbId,

        title:
            tmdb.title,

        genres:
            tmdb.genres?.length || 0,

        cast:
            cast.length,

        crew:
            crew.length,

        trailer:
            trailerUrl !== null,

        studio:
            studioId !== null

    };

}


// ============================================================
// ENRICH SINGLE MOVIE
// ============================================================

async function enrichMovieController(req, res) {

    let client;

    try {

        const movieId =
            Number(req.params.movieId);


        if (
            !Number.isInteger(movieId) ||
            movieId <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid movie ID'

            });

        }


        // ----------------------------------------------------
        // Get PostgreSQL client
        // ----------------------------------------------------

        client =
            await pool.connect();


        // ----------------------------------------------------
        // Start transaction
        // ----------------------------------------------------

        await client.query(
            'BEGIN'
        );


        // ----------------------------------------------------
        // Enrich movie
        // ----------------------------------------------------

        const result =
            await enrichMovie(
                client,
                movieId
            );


        // ----------------------------------------------------
        // Commit
        // ----------------------------------------------------

        await client.query(
            'COMMIT'
        );


        return res.status(200).json({

            success: true,

            message:
                'Movie enriched successfully',

            movie:
                result

        });

    }
    catch (error) {

        console.error(
            '❌ Movie enrichment error:',
            error
        );


        if (client) {

            try {

                await client.query(
                    'ROLLBACK'
                );

            }
            catch (rollbackError) {

                console.error(
                    '❌ Rollback error:',
                    rollbackError.message
                );

            }

        }


        return res.status(500).json({

            success: false,

            message:
                'Server error enriching movie',

            error:
                error.message

        });

    }
    finally {

        if (client) {

            client.release();

        }

    }

}


// ============================================================
// ENRICH ALL MOVIES
// ============================================================

async function enrichAllMovies(req, res) {

    let client;

    try {

        // ----------------------------------------------------
        // Get movies first
        //
        // This query doesn't need to stay inside a transaction.
        // ----------------------------------------------------

        const movieResult =
            await pool.query(
                `
                SELECT
                    movie_id,
                    tmdb_id,
                    title
                FROM movies
                WHERE tmdb_id IS NOT NULL
                ORDER BY movie_id
                `
            );


        if (
            movieResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    'No movies with TMDB IDs were found'

            });

        }


        const results = [];

        const failures = [];


        // ====================================================
        // ENRICH EACH MOVIE IN ITS OWN TRANSACTION
        // ====================================================

        for (
            const movie of movieResult.rows
        ) {

            const movieId =
                movie.movie_id;

            const title =
                movie.title;


            client = null;


            try {

                client =
                    await pool.connect();


                await client.query(
                    'BEGIN'
                );


                const result =
                    await enrichMovie(
                        client,
                        movieId
                    );


                await client.query(
                    'COMMIT'
                );


                results.push(
                    result
                );


            }
            catch (movieError) {

                console.error(
                    `❌ Failed enriching ${title}:`,
                    movieError.message
                );


                // --------------------------------------------
                // Rollback only this movie
                // --------------------------------------------

                if (client) {

                    try {

                        await client.query(
                            'ROLLBACK'
                        );

                    }
                    catch (rollbackError) {

                        console.error(
                            '❌ Movie rollback error:',
                            rollbackError.message
                        );

                    }

                }


                failures.push({

                    movieId,

                    title,

                    error:
                        movieError.message

                });

            }
            finally {

                if (client) {

                    client.release();

                }

            }

        }


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.status(200).json({

            success:
                failures.length === 0,

            message:
                `Movie enrichment completed. ${results.length} successful, ${failures.length} failed.`,

            total:
                movieResult.rows.length,

            successful:
                results.length,

            failed:
                failures.length,

            movies:
                results,

            failures

        });

    }
    catch (error) {

        console.error(
            '❌ Enrich all movies error:',
            error
        );


        if (client) {

            try {

                await client.query(
                    'ROLLBACK'
                );

            }
            catch (rollbackError) {

                console.error(
                    '❌ Rollback error:',
                    rollbackError.message
                );

            }

        }


        return res.status(500).json({

            success: false,

            message:
                'Server error enriching movies',

            error:
                error.message

        });

    }
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    enrichMovieController,

    enrichAllMovies

};