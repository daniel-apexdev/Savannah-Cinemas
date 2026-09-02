// config.js
// ============================================================
// SAVANNAH CINEMAS - FRONTEND CONFIGURATION
// ============================================================


// ============================================================
// SERVER CONFIGURATION
// ============================================================

// IMPORTANT:
// Use the computer's local network IP when accessing
// Savannah Cinemas from another device.
//
// Example:
// const SERVER_IP = '192.168.1.10';
//
// For testing only on the same computer:
// const SERVER_IP = 'localhost';

const SERVER_IP = 'localhost';
const SERVER_PORT = '5000';


// ============================================================
// API BASE
// ============================================================

const API_BASE =
    `http://${SERVER_IP}:${SERVER_PORT}/api`;

// Make API_BASE available to all frontend scripts
window.API_BASE = API_BASE;

const API_URL = API_BASE;


// ============================================================
// AUTHENTICATION ENDPOINTS
// ============================================================

const AUTH_LOGIN =
    `${API_BASE}/auth/login`;

const AUTH_REGISTER =
    `${API_BASE}/auth/register`;

const AUTH_ME =
    `${API_BASE}/auth/me`;

const AUTH_REQUEST_RESET =
    `${API_BASE}/auth/request-reset`;

const AUTH_RESET_PASSWORD =
    `${API_BASE}/auth/reset-password`;


// ============================================================
// MOVIE ENDPOINTS
// ============================================================

const MOVIES_URL =
    `${API_BASE}/movies`;

const MOVIES_NOW_SHOWING =
    `${MOVIES_URL}/now-showing`;

const MOVIES_POPULAR =
    `${MOVIES_URL}/popular`;

const MOVIES_UPCOMING =
    `${MOVIES_URL}/upcoming`;

const MOVIES_TOP_RATED =
    `${API_BASE}/top-rated`;

const MOVIES_COMING_SOON =
    `${API_BASE}/coming-soon`;

const MOVIES_SEARCH =
    `${API_BASE}/search`;

const MOVIES_RECOMMENDED =
    `${API_BASE}/recommended`;


// ============================================================
// TMDB IMPORT ENDPOINTS
// ADMIN / DEVELOPMENT USE
// ============================================================

// These should NOT normally be called by the public frontend.

const TMDB_IMPORT_URL =
    `${MOVIES_URL}/tmdb`;

const TMDB_IMPORT_POPULAR =
    `${TMDB_IMPORT_URL}/popular`;

const TMDB_IMPORT_NOW_PLAYING =
    `${TMDB_IMPORT_URL}/now-playing`;

const TMDB_IMPORT_UPCOMING =
    `${TMDB_IMPORT_URL}/upcoming`;


// ============================================================
// WATCHLIST ENDPOINTS
// ============================================================

const WATCHLIST_URL =
    `${API_BASE}/watchlist`;

const WATCHLIST_TOGGLE_WATCHED =
    `${WATCHLIST_URL}/toggle-watched`;

const WATCHLIST_TOGGLE_FAVORITE =
    `${WATCHLIST_URL}/toggle-favorite`;


// ============================================================
// BOOKING ENDPOINTS
// ============================================================

const BOOKINGS_URL =
    `${API_BASE}/bookings`;


// ============================================================
// EMAIL ENDPOINT
// ============================================================

const SEND_BOOKING_EMAIL =
    `${API_BASE}/send-booking-email`;


// ============================================================
// CONFIGURATION CHECK
// ============================================================

console.log(
    '✅ Savannah Cinemas config loaded successfully'
);

console.log(
    '📡 API Base:',
    API_BASE
);

console.log(
    '🎬 Movies API:',
    MOVIES_URL
);