const { getConnection } = require('../config/database');
const axios = require('axios');


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

    // Prefer official trailers
    const officialTrailer =
        youtubeVideos.find(
            video =>
                video.type === 'Trailer' &&
                video.official === true
        );

    if (officialTrailer) {

        return `https://www.youtube.com/watch?v=${officialTrailer.key}`;

    }

    // Then any trailer
    const trailer =
        youtubeVideos.find(
            video =>
                video.type === 'Trailer'
        );

    if (trailer) {

        return `https://www.youtube.com/watch?v=${trailer.key}`;

    }

    // Finally teaser
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
// ENRICH ONE MOVIE
// ============================================================

async function enrichMovie(connection, movieId) {

    // --------------------------------------------------------
    // Get existing movie
    // --------------------------------------------------------

    const movieResult =
        await connection.execute(
            `
            SELECT
                MOVIE_ID,
                TMDB_ID,
                TITLE
            FROM MOVIES
            WHERE MOVIE_ID = :movieId
            `,
            {
                movieId
            }
        );

    if (
        movieResult.rows.length === 0
    ) {

        throw new Error(
            `Movie ${movieId} not found`
        );

    }

    const movie =
        movieResult.rows[0];

    const tmdbId =
        movie[1];

    const currentTitle =
        movie[2];

    if (!tmdbId) {

        throw new Error(
            `Movie ${movieId} does not have a TMDB_ID`
        );

    }

    console.log(
        `🎬 Enriching movie: ${currentTitle} | TMDB ${tmdbId}`
    );


    // --------------------------------------------------------
    // Get TMDB data
    // --------------------------------------------------------

    const tmdb =
        await getTMDBMovie(tmdbId);


    // --------------------------------------------------------
    // Extract trailer
    // --------------------------------------------------------

    const trailerUrl =
        getTrailerUrl(tmdb.videos);


    // --------------------------------------------------------
    // Update MOVIES
    // --------------------------------------------------------

    let studioId = null;


    // --------------------------------------------------------
    // Handle studio
    //
    // MOVIES currently has one STUDIO_ID.
    // We use the first TMDB production company.
    // --------------------------------------------------------

    if (
        Array.isArray(tmdb.production_companies) &&
        tmdb.production_companies.length > 0
    ) {

        const studio =
            tmdb.production_companies[0];

        await connection.execute(
            `
            MERGE INTO STUDIOS s

            USING (
                SELECT
                    :studioName AS STUDIO_NAME
                FROM dual
            ) incoming

            ON (
                UPPER(s.STUDIO_NAME) =
                UPPER(incoming.STUDIO_NAME)
            )

            WHEN MATCHED THEN
                UPDATE SET
                    s.UPDATED_AT =
                        CURRENT_TIMESTAMP

            WHEN NOT MATCHED THEN
                INSERT (
                    STUDIO_NAME,
                    CREATED_AT,
                    UPDATED_AT
                )
                VALUES (
                    incoming.STUDIO_NAME,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
            `,
            {
                studioName:
                    studio.name
            }
        );


        const studioResult =
            await connection.execute(
                `
                SELECT
                    STUDIO_ID
                FROM STUDIOS
                WHERE UPPER(STUDIO_NAME) =
                      UPPER(:studioName)
                `,
                {
                    studioName:
                        studio.name
                }
            );

        if (
            studioResult.rows.length > 0
        ) {

            studioId =
                studioResult.rows[0][0];

        }

    }


    await connection.execute(
        `
        UPDATE MOVIES

        SET
            ORIGINAL_TITLE =
                :originalTitle,

            DESCRIPTION =
                :description,

            RELEASE_DATE =
                CASE
                    WHEN :releaseDate IS NOT NULL
                    THEN TO_DATE(
                        :releaseDate,
                        'YYYY-MM-DD'
                    )
                    ELSE RELEASE_DATE
                END,

            RUNTIME_MINUTES =
                :runtime,

            POSTER_URL =
                :posterUrl,

            BACKDROP_URL =
                :backdropUrl,

            TRAILER_URL =
                COALESCE(
                    :trailerUrl,
                    TRAILER_URL
                ),

            RATING =
                :rating,

            STUDIO_ID =
                COALESCE(
                    :studioId,
                    STUDIO_ID
                ),

            UPDATED_AT =
                CURRENT_TIMESTAMP

        WHERE MOVIE_ID =
              :movieId
        `,
        {
            originalTitle:
                tmdb.original_title,

            description:
                tmdb.overview,

            releaseDate:
                tmdb.release_date || null,

            runtime:
                tmdb.runtime || null,

            posterUrl:
                buildImageUrl(
                    tmdb.poster_path,
                    'w500'
                ),

            backdropUrl:
                buildImageUrl(
                    tmdb.backdrop_path,
                    'w1280'
                ),

            trailerUrl,

            rating:
                tmdb.vote_average ?? null,

            studioId,

            movieId
        }
    );


    // ========================================================
    // GENRES
    // ========================================================

    // Remove existing movie/genre relationships
    await connection.execute(
        `
        DELETE FROM MOVIE_GENRES
        WHERE MOVIE_ID = :movieId
        `,
        {
            movieId
        }
    );


    if (
        Array.isArray(tmdb.genres)
    ) {

        for (
            const genre of tmdb.genres
        ) {

            // Create genre if it doesn't exist
            await connection.execute(
                `
                MERGE INTO GENRES g

                USING (
                    SELECT
                        :genreName AS GENRE_NAME
                    FROM dual
                ) incoming

                ON (
                    UPPER(g.GENRE_NAME) =
                    UPPER(incoming.GENRE_NAME)
                )

                WHEN NOT MATCHED THEN

                    INSERT (
                        GENRE_NAME
                    )

                    VALUES (
                        incoming.GENRE_NAME
                    )
                `,
                {
                    genreName:
                        genre.name
                }
            );


            // Get genre ID
            const genreResult =
                await connection.execute(
                    `
                    SELECT
                        GENRE_ID

                    FROM GENRES

                    WHERE UPPER(GENRE_NAME) =
                          UPPER(:genreName)
                    `,
                    {
                        genreName:
                            genre.name
                    }
                );


            if (
                genreResult.rows.length > 0
            ) {

                const genreId =
                    genreResult.rows[0][0];


                await connection.execute(
                    `
                    INSERT INTO MOVIE_GENRES (
                        MOVIE_ID,
                        GENRE_ID
                    )

                    VALUES (
                        :movieId,
                        :genreId
                    )
                    `,
                    {
                        movieId,
                        genreId
                    }
                );

            }

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


    // --------------------------------------------------------
    // Clear old cast/crew relationships
    // --------------------------------------------------------

    await connection.execute(
        `
        DELETE FROM MOVIE_CAST
        WHERE MOVIE_ID = :movieId
        `,
        {
            movieId
        }
    );


    await connection.execute(
        `
        DELETE FROM MOVIE_CREW
        WHERE MOVIE_ID = :movieId
        `,
        {
            movieId
        }
    );


    // ========================================================
    // CAST
    // ========================================================

    for (
        const actor of cast
    ) {

        if (!actor.id || !actor.name) {
            continue;
        }


        // ----------------------------------------------------
        // Create person if necessary
        // ----------------------------------------------------

        await connection.execute(
            `
            MERGE INTO PEOPLE p

            USING (
                SELECT
                    :tmdbPersonId AS TMDB_PERSON_ID,
                    :personName AS NAME,
                    :profileUrl AS PROFILE_URL
                FROM dual
            ) incoming

            ON (
                p.TMDB_PERSON_ID =
                incoming.TMDB_PERSON_ID
            )

            WHEN MATCHED THEN

                UPDATE SET
                    p.NAME =
                        incoming.NAME,

                    p.PROFILE_URL =
                        COALESCE(
                            incoming.PROFILE_URL,
                            p.PROFILE_URL
                        ),

                    p.UPDATED_AT =
                        CURRENT_TIMESTAMP

            WHEN NOT MATCHED THEN

                INSERT (
                    TMDB_PERSON_ID,
                    NAME,
                    PROFILE_URL,
                    CREATED_AT,
                    UPDATED_AT
                )

                VALUES (
                    incoming.TMDB_PERSON_ID,
                    incoming.NAME,
                    incoming.PROFILE_URL,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
            `,
            {
                tmdbPersonId:
                    actor.id,

                personName:
                    actor.name,

                profileUrl:
                    buildImageUrl(
                        actor.profile_path,
                        'w500'
                    )
            }
        );


        // ----------------------------------------------------
        // Get person ID
        // ----------------------------------------------------

        const personResult =
            await connection.execute(
                `
                SELECT
                    PERSON_ID

                FROM PEOPLE

                WHERE TMDB_PERSON_ID =
                      :tmdbPersonId
                `,
                {
                    tmdbPersonId:
                        actor.id
                }
            );


        if (
            personResult.rows.length === 0
        ) {
            continue;
        }


        const personId =
            personResult.rows[0][0];


        // ----------------------------------------------------
        // Insert cast
        // ----------------------------------------------------

        await connection.execute(
            `
            INSERT INTO MOVIE_CAST (
                MOVIE_ID,
                PERSON_ID,
                CHARACTER_NAME,
                CAST_ORDER
            )

            VALUES (
                :movieId,
                :personId,
                :characterName,
                :castOrder
            )
            `,
            {
                movieId,

                personId,

                characterName:
                    actor.character || null,

                castOrder:
                    actor.order ?? null
            }
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


        // ----------------------------------------------------
        // Create/update person
        // ----------------------------------------------------

        await connection.execute(
            `
            MERGE INTO PEOPLE p

            USING (
                SELECT
                    :tmdbPersonId AS TMDB_PERSON_ID,
                    :personName AS NAME,
                    :profileUrl AS PROFILE_URL
                FROM dual
            ) incoming

            ON (
                p.TMDB_PERSON_ID =
                incoming.TMDB_PERSON_ID
            )

            WHEN MATCHED THEN

                UPDATE SET
                    p.NAME =
                        incoming.NAME,

                    p.PROFILE_URL =
                        COALESCE(
                            incoming.PROFILE_URL,
                            p.PROFILE_URL
                        ),

                    p.UPDATED_AT =
                        CURRENT_TIMESTAMP

            WHEN NOT MATCHED THEN

                INSERT (
                    TMDB_PERSON_ID,
                    NAME,
                    PROFILE_URL,
                    CREATED_AT,
                    UPDATED_AT
                )

                VALUES (
                    incoming.TMDB_PERSON_ID,
                    incoming.NAME,
                    incoming.PROFILE_URL,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
            `,
            {
                tmdbPersonId:
                    member.id,

                personName:
                    member.name,

                profileUrl:
                    buildImageUrl(
                        member.profile_path,
                        'w500'
                    )
            }
        );


        const personResult =
            await connection.execute(
                `
                SELECT
                    PERSON_ID

                FROM PEOPLE

                WHERE TMDB_PERSON_ID =
                      :tmdbPersonId
                `,
                {
                    tmdbPersonId:
                        member.id
                }
            );


        if (
            personResult.rows.length === 0
        ) {
            continue;
        }


        const personId =
            personResult.rows[0][0];


        // ----------------------------------------------------
        // Insert crew
        // ----------------------------------------------------

        await connection.execute(
            `
            INSERT INTO MOVIE_CREW (
                MOVIE_ID,
                PERSON_ID,
                DEPARTMENT,
                JOB
            )

            VALUES (
                :movieId,
                :personId,
                :department,
                :job
            )
            `,
            {
                movieId,

                personId,

                department:
                    member.department ||
                    null,

                job:
                    member.job ||
                    null
            }
        );

    }


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

    let connection;

    try {

        const movieId =
            Number(req.params.movieId);


        if (
            !Number.isInteger(movieId)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    'Invalid movie ID'

            });

        }


        connection =
            await getConnection();


        const result =
            await enrichMovie(
                connection,
                movieId
            );


        await connection.commit();


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


        if (connection) {

            try {
                await connection.rollback();
            }
            catch (rollbackError) {

                console.error(
                    '❌ Rollback error:',
                    rollbackError
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

        if (connection) {

            try {
                await connection.close();
            }
            catch (error) {

                console.error(
                    '❌ Error closing connection:',
                    error.message
                );

            }

        }

    }

}


// ============================================================
// ENRICH ALL MOVIES
// ============================================================

async function enrichAllMovies(req, res) {

    let connection;

    try {

        connection =
            await getConnection();


        const movieResult =
            await connection.execute(
                `
                SELECT
                    MOVIE_ID,
                    TMDB_ID,
                    TITLE

                FROM MOVIES

                WHERE TMDB_ID IS NOT NULL

                ORDER BY MOVIE_ID
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


        for (
            const row of movieResult.rows
        ) {

            const movieId =
                row[0];

            const title =
                row[2];


            try {

                const result =
                    await enrichMovie(
                        connection,
                        movieId
                    );


                results.push(result);


            }
            catch (movieError) {

                console.error(
                    `❌ Failed enriching ${title}:`,
                    movieError.message
                );


                failures.push({

                    movieId,

                    title,

                    error:
                        movieError.message

                });

            }

        }


        // ----------------------------------------------------
        // Commit all successful enrichments
        // ----------------------------------------------------

        await connection.commit();


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


        if (connection) {

            try {
                await connection.rollback();
            }
            catch (rollbackError) {

                console.error(
                    '❌ Rollback error:',
                    rollbackError
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
    finally {

        if (connection) {

            try {
                await connection.close();
            }
            catch (error) {

                console.error(
                    '❌ Error closing connection:',
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

    enrichMovieController,

    enrichAllMovies

};