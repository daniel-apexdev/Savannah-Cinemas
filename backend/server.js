require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================
// SERVER CONFIGURATION
// ============================================================

const app = express();
const PORT = process.env.PORT || 5000;

// Auto-detect local IP address
function getLocalIP() {
    try {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return 'localhost';
    } catch (error) {
        return 'localhost';
    }
}

const SERVER_IP = getLocalIP();

app.use(cors());
app.use(express.json());

// ============================================================
// FILE-BASED STORAGE
// ============================================================

const DATA_FILE = path.join(__dirname, 'data.json');

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        users: [],
        watchlists: {},
        bookings: {}
    }, null, 2));
}

function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { users: [], watchlists: {}, bookings: {} };
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ============================================================
// GMAIL SMTP TRANSPORTER
// ============================================================

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let transporter = null;

if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        },
        logger: true,
        debug: true
    });

    transporter.verify()
        .then(() => {
            console.log('✅ Gmail SMTP connection successful');
            console.log(`📧 Using account: ${GMAIL_USER}`);
        })
        .catch((error) => {
            console.error('❌ Gmail SMTP connection failed:', error.message);
            transporter = null;
        });
} else {
    console.warn('⚠️ Gmail credentials not configured.');
}

// ============================================================
// JWT MIDDLEWARE
// ============================================================

const JWT_SECRET = process.env.JWT_SECRET || 'savannah-cinemas-secret-key-2024';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
}

// ============================================================
// AUTHENTICATION ROUTES
// ============================================================

// REGISTER
app.post('/api/auth/register', async (req, res) => {
    console.log('📝 Register request received:', req.body.email);
    try {
        const { name, email, password } = req.body;
        const data = readData();

        if (data.users.find(u => u.email === email.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = {
            id: Date.now().toString(),
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            memberSince: new Date(),
            preferences: {
                notifications: true,
                newsletter: true,
                language: 'en'
            }
        };

        data.users.push(user);
        data.watchlists[user.id] = [];
        data.bookings[user.id] = [];
        writeData(data);

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                memberSince: user.memberSince
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    console.log('🔑 Login request received:', req.body.email);
    try {
        const { email, password } = req.body;
        const data = readData();

        const user = data.users.find(u => u.email === email.toLowerCase());
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('❌ Password mismatch for:', email);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('✅ Login successful for:', email);
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                memberSince: user.memberSince,
                preferences: user.preferences
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// GET CURRENT USER
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const data = readData();
        const user = data.users.find(u => u.id === req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { password, ...userWithoutPassword } = user;
        res.json({
            success: true,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ============================================================
// OTHER ROUTES (Watchlist, Bookings, etc.)
// ============================================================

// Add your watchlist and booking routes here...

// ============================================================
// SERVER START
// ============================================================

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Savannah Cinemas Server is running',
        storage: 'File-based',
        emailConfigured: !!transporter,
        serverInfo: {
            ip: SERVER_IP,
            port: PORT,
            apiUrl: `http://${SERVER_IP}:${PORT}/api`
        }
    });
});

app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working!'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📁 Data stored in: ${DATA_FILE}`);
    console.log(`📧 Email service: ${transporter ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🔑 JWT Secret: ${JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
    console.log(`\n📍 Local URL: http://localhost:${PORT}`);
    console.log(`📍 Network URL: http://${SERVER_IP}:${PORT}`);
    console.log(`📍 API URL: http://${SERVER_IP}:${PORT}/api`);
    console.log(`📍 Health Check: http://${SERVER_IP}:${PORT}/\n`);
});