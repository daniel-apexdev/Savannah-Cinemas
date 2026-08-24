// config.js
// ============================================================
// SAVANNAH CINEMAS - FRONTEND CONFIGURATION
// ============================================================

// Server Configuration - Update this with your server IP
const SERVER_IP = '192.168.8.104';  // Your computer's IP address
const SERVER_PORT = '5000';        // Server port

// Build API URLs
const API_BASE = `http://${SERVER_IP}:${SERVER_PORT}/api`;
const API_URL = API_BASE;

// Authentication Endpoints
const AUTH_LOGIN = `${API_BASE}/auth/login`;
const AUTH_REGISTER = `${API_BASE}/auth/register`;
const AUTH_ME = `${API_BASE}/auth/me`;
const AUTH_REQUEST_RESET = `${API_BASE}/auth/request-reset`;
const AUTH_RESET_PASSWORD = `${API_BASE}/auth/reset-password`;

// Watchlist Endpoints
const WATCHLIST_URL = `${API_BASE}/watchlist`;
const WATCHLIST_TOGGLE_WATCHED = `${API_BASE}/watchlist/toggle-watched`;
const WATCHLIST_TOGGLE_FAVORITE = `${API_BASE}/watchlist/toggle-favorite`;

// Bookings Endpoints
const BOOKINGS_URL = `${API_BASE}/bookings`;

// Email Endpoint
const SEND_BOOKING_EMAIL = `${API_BASE}/send-booking-email`;

console.log('✅ Config loaded successfully');
console.log('📡 API_BASE:', API_BASE);