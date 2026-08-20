
const SERVER_IP = '192.168.8.104';  // Your computer's IP address
const SERVER_PORT = '5000';        // Server port

// Build API URLs
const API_URL = `http://${SERVER_IP}:${SERVER_PORT}/api`;
const API_BASE = API_URL;  // API_BASE is the same as API_URL

// Or use this if you need them separate:
// const API_BASE = `http://${SERVER_IP}:${SERVER_PORT}/api`;
// const API_URL = API_BASE;

// Watchlist endpoint
const WATCHLIST_URL = `${API_URL}/watchlist`;

// Booking endpoint
const BOOKINGS_URL = `${API_URL}/bookings`;

// Auth endpoints
const AUTH_URL = `${API_URL}/auth`;

console.log('✅ Config loaded successfully');
console.log('📡 API_URL:', API_URL);
console.log('📡 WATCHLIST_URL:', WATCHLIST_URL);