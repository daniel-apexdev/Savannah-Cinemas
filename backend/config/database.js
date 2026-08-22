require('dotenv').config();

// backend/config/database.js
const oracledb = require('oracledb');

// Enable auto-commit for connection pooling
oracledb.autoCommit = false;

// Database configuration from environment variables
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 2,
    poolMax: 10,
    poolIncrement: 1,
    poolTimeout: 60
};

let pool = null;

// Initialize database connection pool
async function initializeDatabase() {
    try {
        // Validate required environment variables
        if (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_CONNECT_STRING) {
            console.error('❌ Database configuration is incomplete!');
            console.error('Please set DB_USER, DB_PASSWORD, and DB_CONNECT_STRING in .env');
            console.error('');
            console.error('Example:');
            console.error('DB_USER=SAVANNAH_CINEMAS');
            console.error('DB_PASSWORD=your_password');
            console.error('DB_CONNECT_STRING=localhost:1521/XEPDB1');
            throw new Error('Missing database configuration');
        }

        console.log('📡 Connecting to Oracle database...');
        console.log(`👤 User: ${dbConfig.user}`);
        console.log(`🔗 Connect String: ${dbConfig.connectString}`);

        pool = await oracledb.createPool(dbConfig);
        console.log('✅ Oracle database connection pool created successfully');
        return pool;
    } catch (error) {
        console.error('❌ Failed to create database pool:', error.message);
        console.error('');
        console.error('Please check:');
        console.error('1. Oracle database is running');
        console.error('2. Connection details are correct in .env');
        console.error('3. Oracle Instant Client is installed');
        console.error('4. The schema exists');
        throw error;
    }
}

// Get a connection from the pool
async function getConnection() {
    if (!pool) {
        throw new Error('Database pool not initialized. Call initializeDatabase() first.');
    }
    try {
        return await pool.getConnection();
    } catch (error) {
        console.error('❌ Failed to get database connection:', error.message);
        throw error;
    }
}

// Close the connection pool
async function closeDatabase() {
    if (pool) {
        try {
            await pool.close();
            pool = null;
            console.log('✅ Database connection pool closed');
        } catch (error) {
            console.error('❌ Error closing database pool:', error.message);
            throw error;
        }
    }
}

// Test the database connection
async function testConnection() {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute('SELECT 1 FROM dual');
        console.log('✅ Database connection test successful');
        return true;
    } catch (error) {
        console.error('❌ Database connection test failed:', error.message);
        return false;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) {}
        }
    }
}

module.exports = {
    initializeDatabase,
    getConnection,
    closeDatabase,
    testConnection
};

