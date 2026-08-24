// ============================================================
// SAVANNAH CINEMAS - TMDB SERVICE
// services/tmdbService.js
// ============================================================

const TMDB_BASE_URL =
    process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

const TMDB_IMAGE_BASE_URL =
    process.env.TMDB_IMAGE_BASE_URL ||
    'https://image.tmdb.org/t/p';

// ============================================================
// TMDB REQUEST
// ============================================================

async function tmdbRequest(endpoint, params = {}) {

    if (!TMDB_API_KEY) {
        throw new Error(
            'TMDB_API_KEY is not configured in the .env file'
        );
    }

    const searchParams = new URLSearchParams({
        api_key: TMDB_API_KEY,
        language: 'en-US',
        ...params
    });

    const url =
        `${TMDB_BASE_URL}${endpoint}?${searchParams.toString()}`;

    console.log(`🎬 TMDB Request: ${endpoint}`);

    const response = await fetch(url);

    if (!response.ok) {

        const errorText = await response.text();

        throw new Error(
            `TMDB API error ${response.status}: ${errorText}`
        );
    }

    return await response.json();
}

// ============================================================
// POPULAR MOVIES
// ============================================================

async function getPopularMovies(page = 1) {

    return await tmdbRequest('/movie/popular', {
        page
    });
}

// ============================================================
// NOW PLAYING
// ============================================================

async function getNowPlayingMovies(page = 1) {

    return await tmdbRequest('/movie/now_playing', {
        page
    });
}

// ============================================================
// UPCOMING MOVIES
// ============================================================

async function getUpcomingMovies(page = 1) {

    return await tmdbRequest('/movie/upcoming', {
        page
    });
}

// ============================================================
// MOVIE DETAILS
// ============================================================

async function getMovieDetails(tmdbId) {

    return await tmdbRequest(`/movie/${tmdbId}`, {
        append_to_response: 'videos'
    });
}

// ============================================================
// MOVIE RELEASE DATES
// Used later for age/certification information
// ============================================================

async function getMovieReleaseDates(tmdbId) {

    return await tmdbRequest(`/movie/${tmdbId}/release_dates`);
}

// ============================================================
// IMAGE URL
// ============================================================

function getImageUrl(path, size = 'original') {

    if (!path) {
        return null;
    }

    return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

// ============================================================
// FIND TRAILER
// ============================================================

function getTrailerUrl(videos) {

    if (!videos || !videos.results) {
        return null;
    }

    const trailer =
        videos.results.find(video =>
            video.site === 'YouTube' &&
            video.type === 'Trailer' &&
            video.official === true
        ) ||
        videos.results.find(video =>
            video.site === 'YouTube' &&
            video.type === 'Trailer'
        );

    if (!trailer) {
        return null;
    }

    return `https://www.youtube.com/watch?v=${trailer.key}`;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    getPopularMovies,
    getNowPlayingMovies,
    getUpcomingMovies,
    getMovieDetails,
    getMovieReleaseDates,
    getImageUrl,
    getTrailerUrl

};