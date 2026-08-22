// config.js
// ============================================================
// SERVER CONFIGURATION
// ============================================================

// Change this to your current IP address
const SERVER_IP = '192.168.8.104';  // Your computer's IP address
const SERVER_PORT = '5000';        // Server port

// Build API URLs - BOTH must be defined
const API_BASE = `http://${SERVER_IP}:${SERVER_PORT}/api`;
const API_URL = API_BASE;  // API_URL is the same as API_BASE

// All endpoints
const WATCHLIST_URL = `${API_BASE}/watchlist`;
const BOOKINGS_URL = `${API_BASE}/bookings`;
const AUTH_URL = `${API_BASE}/auth`;

// Auth endpoints
const AUTH_REGISTER = `${API_BASE}/auth/register`;
const AUTH_LOGIN = `${API_BASE}/auth/login`;
const AUTH_ME = `${API_BASE}/auth/me`;
const AUTH_REQUEST_RESET = `${API_BASE}/auth/request-reset`;
const AUTH_RESET_PASSWORD = `${API_BASE}/auth/reset-password`;

// Watchlist endpoints
const WATCHLIST_TOGGLE_WATCHED = `${API_BASE}/watchlist/toggle-watched`;
const WATCHLIST_TOGGLE_FAVORITE = `${API_BASE}/watchlist/toggle-favorite`;

// Email endpoint
const SEND_BOOKING_EMAIL = `${API_BASE}/send-booking-email`;

console.log('✅ Config loaded successfully');
console.log('📡 API_BASE:', API_BASE);
console.log('📡 API_URL:', API_URL);
console.log('📡 WATCHLIST_URL:', WATCHLIST_URL);
console.log('📡 BOOKINGS_URL:', BOOKINGS_URL);