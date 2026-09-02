const pool = require('../config/database');

// ============================================================
// GET ALL MOVIES
// GET /api/movies
// ============================================================

async function getMovies(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                m.movie_id,
                m.tmdb_id,
                m.title,
                m.original_title,
                m.description,
                m.release_date,
                m.runtime_minutes,
                m.age_rating,
                m.poster_url,
                m.backdrop_url,
                m.trailer_url,
                m.rating,
                m.status,
                m.created_at,
                m.updated_at,
                m.studio_id,
                s.studio_name,
                s.country AS studio_country,
                s.website_url AS studio_website
            FROM movies m
            LEFT JOIN studios s
                ON s.studio_id = m.studio_id
            ORDER BY
                CASE m.status
                    WHEN 'NOW_SHOWING' THEN 1
                    WHEN 'UPCOMING' THEN 2
                    WHEN 'COMING_SOON' THEN 3
                    WHEN 'ENDED' THEN 4
                    WHEN 'ARCHIVED' THEN 5
                    ELSE 6
                END,
                m.release_date DESC NULLS LAST
        `);

        const movies = result.rows.map(movie => ({
            movieId: movie.movie_id,
            tmdbId: movie.tmdb_id,
            title: movie.title || 'Untitled',
            originalTitle: movie.original_title || movie.title || 'Untitled',
            description: movie.description || '',
            releaseDate: movie.release_date,
            runtimeMinutes: movie.runtime_minutes,
            ageRating: movie.age_rating,
            posterUrl: movie.poster_url,
            backdropUrl: movie.backdrop_url,
            trailerUrl: movie.trailer_url,
            rating: movie.rating,
            status: movie.status || 'UNKNOWN',
            createdAt: movie.created_at,
            updatedAt: movie.updated_at,

            studio: movie.studio_id
                ? {
                    studioId: movie.studio_id,
                    studioName: movie.studio_name,
                    country: movie.studio_country,
                    websiteUrl: movie.studio_website
                }
                : null
        }));

        return res.json({
            success: true,
            count: movies.length,
            movies
        });

    } catch (error) {
        console.error('❌ Get movies error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching movies',
            error: error.message
        });
    }
}


// ============================================================
// GET SINGLE MOVIE
// GET /api/movies/:movieId
// ============================================================

async function getMovieById(req, res) {
    try {
        const movieId = Number(req.params.movieId);

        if (!Number.isInteger(movieId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });
        }

        const result = await pool.query(`
            SELECT
                m.movie_id,
                m.tmdb_id,
                m.title,
                m.original_title,
                m.description,
                m.release_date,
                m.runtime_minutes,
                m.age_rating,
                m.poster_url,
                m.backdrop_url,
                m.trailer_url,
                m.rating,
                m.status,
                m.created_at,
                m.updated_at,
                m.studio_id,
                s.studio_name,
                s.country AS studio_country,
                s.website_url AS studio_website
            FROM movies m
            LEFT JOIN studios s
                ON s.studio_id = m.studio_id
            WHERE m.movie_id = $1
        `, [movieId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });
        }

        const movie = result.rows[0];

        // ----------------------------------------------------
        // GET GENRES
        // ----------------------------------------------------

        const genreResult = await pool.query(`
            SELECT
                g.genre_id,
                g.genre_name
            FROM movie_genres mg
            JOIN genres g
                ON g.genre_id = mg.genre_id
            WHERE mg.movie_id = $1
            ORDER BY g.genre_name
        `, [movieId]);

        return res.json({
            success: true,

            movie: {
                movieId: movie.movie_id,
                tmdbId: movie.tmdb_id,
                title: movie.title,
                originalTitle: movie.original_title,
                description: movie.description,
                releaseDate: movie.release_date,
                runtimeMinutes: movie.runtime_minutes,
                ageRating: movie.age_rating,
                posterUrl: movie.poster_url,
                backdropUrl: movie.backdrop_url,
                trailerUrl: movie.trailer_url,
                rating: movie.rating,
                status: movie.status,
                createdAt: movie.created_at,
                updatedAt: movie.updated_at,

                studio: movie.studio_id
                    ? {
                        studioId: movie.studio_id,
                        studioName: movie.studio_name,
                        country: movie.studio_country,
                        websiteUrl: movie.studio_website
                    }
                    : null,

                genres: genreResult.rows.map(genre => ({
                    genreId: genre.genre_id,
                    genreName: genre.genre_name
                }))
            }
        });

    } catch (error) {
        console.error('❌ Get movie error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching movie',
            error: error.message
        });
    }
}


// ============================================================
// GET NOW SHOWING
// GET /api/movies/now-showing
// ============================================================

async function getNowShowing(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                m.movie_id,
                m.tmdb_id,
                m.title,
                m.original_title,
                m.description,
                m.release_date,
                m.runtime_minutes,
                m.age_rating,
                m.poster_url,
                m.backdrop_url,
                m.trailer_url,
                m.rating,
                m.status,
                m.studio_id,
                s.studio_name
            FROM movies m
            LEFT JOIN studios s
                ON s.studio_id = m.studio_id
            WHERE m.status = 'NOW_SHOWING'
            ORDER BY m.title
        `);

        const movies = result.rows.map(movie => ({
            movieId: movie.movie_id,
            tmdbId: movie.tmdb_id,
            title: movie.title,
            originalTitle: movie.original_title,
            description: movie.description,
            releaseDate: movie.release_date,
            runtimeMinutes: movie.runtime_minutes,
            ageRating: movie.age_rating,
            posterUrl: movie.poster_url,
            backdropUrl: movie.backdrop_url,
            trailerUrl: movie.trailer_url,
            rating: movie.rating,
            status: movie.status,

            studio: movie.studio_id
                ? {
                    studioId: movie.studio_id,
                    studioName: movie.studio_name
                }
                : null
        }));

        return res.json({
            success: true,
            count: movies.length,
            movies
        });

    } catch (error) {
        console.error('❌ Get now showing error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching now showing movies',
            error: error.message
        });
    }
}


// ============================================================
// GET UPCOMING MOVIES
// GET /api/movies/upcoming
// ============================================================

async function getUpcomingMovies(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                m.movie_id,
                m.tmdb_id,
                m.title,
                m.original_title,
                m.description,
                m.release_date,
                m.runtime_minutes,
                m.age_rating,
                m.poster_url,
                m.backdrop_url,
                m.trailer_url,
                m.rating,
                m.status,
                m.studio_id,
                s.studio_name
            FROM movies m
            LEFT JOIN studios s
                ON s.studio_id = m.studio_id
            WHERE m.status IN ('UPCOMING', 'COMING_SOON')
            ORDER BY m.release_date ASC NULLS LAST
        `);

        const movies = result.rows.map(movie => ({
            movieId: movie.movie_id,
            tmdbId: movie.tmdb_id,
            title: movie.title,
            originalTitle: movie.original_title,
            description: movie.description,
            releaseDate: movie.release_date,
            runtimeMinutes: movie.runtime_minutes,
            ageRating: movie.age_rating,
            posterUrl: movie.poster_url,
            backdropUrl: movie.backdrop_url,
            trailerUrl: movie.trailer_url,
            rating: movie.rating,
            status: movie.status,

            studio: movie.studio_id
                ? {
                    studioId: movie.studio_id,
                    studioName: movie.studio_name
                }
                : null
        }));

        return res.json({
            success: true,
            count: movies.length,
            movies
        });

    } catch (error) {
        console.error('❌ Get upcoming movies error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching upcoming movies',
            error: error.message
        });
    }
}


// ============================================================
// SEARCH MOVIES
// GET /api/movies/search?q=batman
// ============================================================

async function searchMovies(req, res) {
    try {
        const { q } = req.query;

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

        const result = await pool.query(`
            SELECT
                movie_id,
                tmdb_id,
                title,
                original_title,
                description,
                release_date,
                runtime_minutes,
                age_rating,
                poster_url,
                backdrop_url,
                trailer_url,
                rating,
                status
            FROM movies
            WHERE
                title ILIKE '%' || $1 || '%'
                OR original_title ILIKE '%' || $1 || '%'
                OR description ILIKE '%' || $1 || '%'
            ORDER BY
                CASE
                    WHEN title ILIKE $1 THEN 1
                    WHEN title ILIKE $1 || '%' THEN 2
                    ELSE 3
                END,
                rating DESC NULLS LAST,
                release_date DESC NULLS LAST
        `, [searchQuery]);

        const movies = result.rows.map(movie => ({
            movieId: movie.movie_id,
            tmdbId: movie.tmdb_id,
            title: movie.title,
            originalTitle: movie.original_title,
            description: movie.description,
            releaseDate: movie.release_date,
            runtimeMinutes: movie.runtime_minutes,
            ageRating: movie.age_rating,
            posterUrl: movie.poster_url,
            backdropUrl: movie.backdrop_url,
            trailerUrl: movie.trailer_url,
            rating: movie.rating,
            status: movie.status
        }));

        return res.json({
            success: true,
            query: searchQuery,
            count: movies.length,
            movies
        });

    } catch (error) {
        console.error('❌ Search movies error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error searching movies',
            error: error.message
        });
    }
}


// ============================================================
// GET COMING SOON MOVIES
// GET /api/movies/coming-soon
// ============================================================

async function getComingSoonMovies(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                movie_id,
                tmdb_id,
                title,
                original_title,
                description,
                release_date,
                runtime_minutes,
                age_rating,
                poster_url,
                backdrop_url,
                trailer_url,
                rating,
                status
            FROM movies
            WHERE release_date > CURRENT_DATE
            ORDER BY release_date ASC, title ASC
        `);

        const movies = result.rows.map(movie => ({
            movieId: movie.movie_id,
            tmdbId: movie.tmdb_id,
            title: movie.title,
            originalTitle: movie.original_title,
            description: movie.description,
            releaseDate: movie.release_date,
            runtimeMinutes: movie.runtime_minutes,
            ageRating: movie.age_rating,
            posterUrl: movie.poster_url,
            backdropUrl: movie.backdrop_url,
            trailerUrl: movie.trailer_url,
            rating: movie.rating,
            status: movie.status
        }));

        return res.json({
            success: true,
            count: movies.length,
            movies
        });

    } catch (error) {
        console.error('❌ Get coming soon movies error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching coming soon movies',
            error: error.message
        });
    }
}


// ============================================================
// GET MOVIE SHOWTIMES
// GET /api/movies/:movieId/showtimes
// ============================================================

async function getMovieShowtimes(req, res) {
    try {
        const movieId = Number(req.params.movieId);

        if (!Number.isInteger(movieId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });
        }

        const movieResult = await pool.query(`
            SELECT
                movie_id,
                title,
                poster_url,
                status
            FROM movies
            WHERE movie_id = $1
        `, [movieId]);

        if (movieResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });
        }

        const result = await pool.query(`
            SELECT
                st.showtime_id,
                c.cinema_id,
                c.cinema_name,
                c.city,
                s.screen_id,
                s.screen_name,
                s.screen_type,
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
              AND st.status IN ('SCHEDULED', 'NOW_SHOWING')
              AND (
                    st.show_date > CURRENT_DATE
                    OR (
                        st.show_date = CURRENT_DATE
                        AND st.start_time >= CURRENT_TIMESTAMP
                    )
              )
            ORDER BY st.show_date, st.start_time
        `, [movieId]);

        const movie = movieResult.rows[0];

        const showtimes = result.rows.map(row => ({
            showtimeId: row.showtime_id,

            cinema: {
                cinemaId: row.cinema_id,
                name: row.cinema_name,
                city: row.city
            },

            screen: {
                screenId: row.screen_id,
                name: row.screen_name,
                type: row.screen_type
            },

            showDate: row.show_date,
            startTime: row.start_time,
            endTime: row.end_time,
            ticketPrice: row.ticket_price,
            status: row.status
        }));

        return res.json({
            success: true,

            movie: {
                movieId: movie.movie_id,
                title: movie.title,
                posterUrl: movie.poster_url,
                status: movie.status
            },

            count: showtimes.length,
            showtimes
        });

    } catch (error) {
        console.error('❌ Get movie showtimes error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching movie showtimes',
            error: error.message
        });
    }
}


// ============================================================
// GET FULL MOVIE DETAILS
// GET /api/movies/details/:movieId
// ============================================================

async function getMovieDetails(req, res) {
    try {
        const movieId = Number(req.params.movieId);

        if (!Number.isInteger(movieId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid movie ID'
            });
        }

        const movieResult = await pool.query(`
            SELECT
                m.movie_id,
                m.tmdb_id,
                m.title,
                m.original_title,
                m.description,
                m.release_date,
                m.runtime_minutes,
                m.age_rating,
                m.poster_url,
                m.backdrop_url,
                m.trailer_url,
                m.rating,
                m.status,
                m.studio_id,
                s.studio_name
            FROM movies m
            LEFT JOIN studios s
                ON s.studio_id = m.studio_id
            WHERE m.movie_id = $1
        `, [movieId]);

        if (movieResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Movie not found'
            });
        }

        const movie = movieResult.rows[0];

        // ----------------------------------------------------
        // GENRES
        // ----------------------------------------------------

        const genresResult = await pool.query(`
            SELECT
                g.genre_id,
                g.genre_name
            FROM movie_genres mg
            JOIN genres g
                ON g.genre_id = mg.genre_id
            WHERE mg.movie_id = $1
            ORDER BY g.genre_name
        `, [movieId]);

        // ----------------------------------------------------
        // IMAGES
        // ----------------------------------------------------

        const imagesResult = await pool.query(`
            SELECT
                image_id,
                image_type,
                file_path,
                image_url,
                width,
                height,
                aspect_ratio,
                language
            FROM movie_images
            WHERE movie_id = $1
            ORDER BY image_type, image_id
        `, [movieId]);

        // ----------------------------------------------------
        // CAST
        // ----------------------------------------------------

        const castResult = await pool.query(`
            SELECT
                p.person_id,
                p.name,
                mc.character_name,
                p.profile_url
            FROM movie_cast mc
            JOIN people p
                ON p.person_id = mc.person_id
            WHERE mc.movie_id = $1
            ORDER BY mc.cast_order NULLS LAST
        `, [movieId]);

        // ----------------------------------------------------
        // CREW
        // ----------------------------------------------------

        const crewResult = await pool.query(`
            SELECT
                p.person_id,
                p.name,
                mc.job,
                mc.department,
                p.profile_url
            FROM movie_crew mc
            JOIN people p
                ON p.person_id = mc.person_id
            WHERE mc.movie_id = $1
            ORDER BY mc.department, mc.job, p.name
        `, [movieId]);

        // ----------------------------------------------------
        // SHOWTIMES
        // ----------------------------------------------------

        const showtimesResult = await pool.query(`
            SELECT
                st.showtime_id,
                c.cinema_id,
                c.cinema_name,
                s.screen_id,
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
              AND st.status IN ('SCHEDULED', 'NOW_SHOWING')
              AND (
                    st.show_date > CURRENT_DATE
                    OR (
                        st.show_date = CURRENT_DATE
                        AND st.start_time > CURRENT_TIMESTAMP
                    )
              )
            ORDER BY st.show_date, st.start_time
        `, [movieId]);

        return res.json({
            success: true,

            movie: {
                movieId: movie.movie_id,
                tmdbId: movie.tmdb_id,
                title: movie.title,
                originalTitle: movie.original_title,
                description: movie.description,
                releaseDate: movie.release_date,
                runtimeMinutes: movie.runtime_minutes,
                ageRating: movie.age_rating,
                posterUrl: movie.poster_url,
                backdropUrl: movie.backdrop_url,
                trailerUrl: movie.trailer_url,
                rating: movie.rating,
                status: movie.status,

                studio: movie.studio_id
                    ? {
                        studioId: movie.studio_id,
                        name: movie.studio_name
                    }
                    : null,

                genres: genresResult.rows.map(row => ({
                    genreId: row.genre_id,
                    name: row.genre_name
                })),

                images: imagesResult.rows.map(row => ({
                    imageId: row.image_id,
                    imageType: row.image_type,
                    filePath: row.file_path,
                    imageUrl: row.image_url,
                    width: row.width,
                    height: row.height,
                    aspectRatio: row.aspect_ratio,
                    language: row.language
                })),

                cast: castResult.rows.map(row => ({
                    personId: row.person_id,
                    name: row.name,
                    characterName: row.character_name,
                    profileUrl: row.profile_url
                })),

                crew: crewResult.rows.map(row => ({
                    personId: row.person_id,
                    name: row.name,
                    job: row.job,
                    department: row.department,
                    profileUrl: row.profile_url
                })),

                showtimes: showtimesResult.rows.map(row => ({
                    showtimeId: row.showtime_id,

                    cinema: {
                        cinemaId: row.cinema_id,
                        name: row.cinema_name
                    },

                    screen: {
                        screenId: row.screen_id,
                        name: row.screen_name
                    },

                    showDate: row.show_date,
                    startTime: row.start_time,
                    endTime: row.end_time,
                    ticketPrice: row.ticket_price,
                    status: row.status
                }))
            }
        });

    } catch (error) {
        console.error('❌ Get movie details error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching movie details',
            error: error.message
        });
    }
}


// ============================================================
// GET TOP RATED MOVIES
// GET /api/movies/top-rated
// ============================================================

async function getTopRatedMovies(req, res) {
    try {
        const result = await pool.query(`
            SELECT
                movie_id,
                tmdb_id,
                title,
                original_title,
                description,
                release_date,
                runtime_minutes,
                age_rating,
                poster_url,
                backdrop_url,
                trailer_url,
                rating,
                status
            FROM movies
            WHERE rating IS NOT NULL
            ORDER BY rating DESC, title ASC
            LIMIT 20
        `);

        const movies = result.rows.map(movie => ({
            movieId: movie.movie_id,
            tmdbId: movie.tmdb_id,
            title: movie.title,
            originalTitle: movie.original_title,
            description: movie.description,
            releaseDate: movie.release_date,
            runtimeMinutes: movie.runtime_minutes,
            ageRating: movie.age_rating,
            posterUrl: movie.poster_url,
            backdropUrl: movie.backdrop_url,
            trailerUrl: movie.trailer_url,
            rating: movie.rating,
            status: movie.status
        }));

        return res.json({
            success: true,
            count: movies.length,
            movies
        });

    } catch (error) {
        console.error('❌ Get top rated movies error:', error);

        return res.status(500).json({
            success: false,
            message: 'Server error fetching top rated movies',
            error: error.message
        });
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getMovies,
    getMovieById,
    getNowShowing,
    getUpcomingMovies,
    getMovieShowtimes,
    searchMovies,
    getComingSoonMovies,
    getMovieDetails,
    getTopRatedMovies
};