require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

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
            console.log('📝 Please check your Gmail credentials in the .env file');
            console.log('💡 Make sure you are using an App Password, not your regular password');
            transporter = null;
        });
} else {
    console.warn('⚠️ Gmail credentials not configured. Email sending will be disabled.');
    console.log('📝 Add GMAIL_USER and GMAIL_APP_PASSWORD to your .env file');
    console.log('💡 Get an App Password at: https://myaccount.google.com/apppasswords');
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

        if (transporter) {
            try {
                const welcomeMail = {
                    from: `"Savannah Cinemas" <${GMAIL_USER}>`,
                    to: user.email,
                    subject: 'Welcome to Savannah Cinemas! 🎬',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1D1D28; color: #F2EFE9; padding: 30px; border-radius: 14px;">
                            <h1 style="font-family: Oswald, sans-serif; color: #E8B34C;">SAVANNAH CINEMAS</h1>
                            <h2 style="color: #E8B34C;">Welcome!</h2>
                            <p>Hello ${user.name},</p>
                            <p>Thank you for joining Savannah Cinemas. We're excited to have you!</p>
                            <p>Start exploring our collection of films and book your first ticket today.</p>
                            <br>
                            <p style="color: #B9B6AC;">🎬 The Savannah Cinemas Team</p>
                        </div>
                    `
                };
                await transporter.sendMail(welcomeMail);
                console.log('✅ Welcome email sent to:', user.email);
            } catch (emailError) {
                console.error('❌ Welcome email failed:', emailError.message);
            }
        }

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
    try {
        const { email, password } = req.body;
        const data = readData();

        const user = data.users.find(u => u.email === email.toLowerCase());
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
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
// PASSWORD RESET ROUTES
// ============================================================

// REQUEST PASSWORD RESET
app.post('/api/auth/request-reset', async (req, res) => {
    try {
        const { email } = req.body;
        const data = readData();

        const user = data.users.find(u => u.email === email.toLowerCase());
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email address'
            });
        }

        // Generate a reset token (valid for 1 hour)
        const resetToken = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Store the reset token in the user's record
        user.resetToken = resetToken;
        user.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
        writeData(data);

        // Send reset email if transporter is configured
        if (transporter) {
            const resetLink = `http://10.20.10.150:5000/reset-password.html?token=${resetToken}`;
            
            const mailOptions = {
                from: `"Savannah Cinemas" <${GMAIL_USER}>`,
                to: user.email,
                subject: 'Password Reset Request — Savannah Cinemas',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1D1D28; color: #F2EFE9; padding: 30px; border-radius: 14px;">
                        <h1 style="font-family: Oswald, sans-serif; color: #E8B34C;">SAVANNAH CINEMAS</h1>
                        <h2 style="color: #E8B34C;">Password Reset</h2>
                        <p>Hello ${user.name},</p>
                        <p>We received a request to reset your password for your account.</p>
                        <p>Click the button below to reset your password. This link will expire in 1 hour.</p>
                        <br>
                        <a href="${resetLink}" style="display: inline-block; padding: 12px 32px; background: #E8B34C; color: #14141C; text-decoration: none; border-radius: 8px; font-weight: 500; font-family: Arial, sans-serif;">
                            Reset Password
                        </a>
                        <br><br>
                        <p style="color: #B9B6AC; font-size: 13px;">If you didn't request this, please ignore this email.</p>
                        <hr style="border-color: #2C2C3A;">
                        <p style="color: #B9B6AC; font-size: 12px;">This link will expire in 1 hour.</p>
                        <p style="color: #B9B6AC; font-size: 12px;">Link: ${resetLink}</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log('✅ Password reset email sent to:', user.email);
        } else {
            console.warn('⚠️ Email service not configured. Reset token:', resetToken);
        }

        res.json({
            success: true,
            message: 'Password reset link sent to your email',
            // In development, return the token for testing
            ...(process.env.NODE_ENV === 'development' && { resetToken })
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process password reset request'
        });
    }
});

// RESET PASSWORD
app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Token and new password are required'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        // Verify the token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        const data = readData();
        const user = data.users.find(u => u.id === decoded.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if the token matches and hasn't expired
        if (user.resetToken !== token) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reset token'
            });
        }

        if (new Date(user.resetTokenExpiry) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired'
            });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update the user's password
        user.password = hashedPassword;
        user.resetToken = null;
        user.resetTokenExpiry = null;
        writeData(data);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
});

// ============================================================
// WATCHLIST ROUTES
// ============================================================

// GET WATCHLIST
app.get('/api/watchlist', authenticateToken, async (req, res) => {
    try {
        const data = readData();
        const watchlist = data.watchlists[req.user.id] || [];
        res.json(watchlist);
    } catch (error) {
        console.error('Get watchlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching watchlist'
        });
    }
});

// ADD TO WATCHLIST
app.post('/api/watchlist', authenticateToken, async (req, res) => {
    try {
        const { filmId, title, year, poster, rating } = req.body;

        if (filmId === undefined || filmId === null) {
            return res.status(400).json({
                success: false,
                message: 'filmId is required'
            });
        }

        const data = readData();

        if (!data.watchlists[req.user.id]) {
            data.watchlists[req.user.id] = [];
        }

        const exists = data.watchlists[req.user.id].some(item => item.filmId == filmId);
        if (exists) {
            return res.status(409).json({
                success: false,
                message: 'Movie already in watchlist'
            });
        }

        const movieItem = {
            filmId,
            title,
            year,
            poster,
            rating,
            addedDate: new Date(),
            watched: false,
            favorite: false
        };

        data.watchlists[req.user.id].push(movieItem);
        writeData(data);

        res.status(201).json({
            success: true,
            message: 'Movie added to watchlist',
            watchlist: data.watchlists[req.user.id]
        });

    } catch (error) {
        console.error('Add to watchlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error adding to watchlist'
        });
    }
});

// REMOVE FROM WATCHLIST
app.delete('/api/watchlist/:filmId', authenticateToken, async (req, res) => {
    try {
        const filmId = req.params.filmId;
        const data = readData();

        if (data.watchlists[req.user.id]) {
            const before = data.watchlists[req.user.id].length;
            data.watchlists[req.user.id] = data.watchlists[req.user.id].filter(
                item => item.filmId != filmId
            );
            const removed = before !== data.watchlists[req.user.id].length;

            writeData(data);

            if (!removed) {
                return res.status(404).json({
                    success: false,
                    message: 'Movie not found in watchlist'
                });
            }
            
            return res.json({
                success: true,
                message: 'Movie removed from watchlist',
                watchlist: data.watchlists[req.user.id] || []
            });
        }

        res.status(404).json({
            success: false,
            message: 'Movie not found in watchlist'
        });

    } catch (error) {
        console.error('Remove from watchlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error removing from watchlist'
        });
    }
});

// TOGGLE WATCHED STATUS
app.post('/api/watchlist/toggle-watched', authenticateToken, async (req, res) => {
    try {
        const { filmId, watched } = req.body;
        const data = readData();

        if (!data.watchlists[req.user.id]) {
            return res.status(404).json({
                success: false,
                message: 'Watchlist not found'
            });
        }

        const filmIndex = data.watchlists[req.user.id].findIndex(item => item.filmId == filmId);
        
        if (filmIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Film not found in watchlist'
            });
        }

        data.watchlists[req.user.id][filmIndex].watched = watched;
        data.watchlists[req.user.id][filmIndex].watchedDate = watched ? new Date() : null;
        writeData(data);

        res.json({
            success: true,
            message: watched ? 'Movie marked as watched' : 'Movie marked as unwatched',
            watchlist: data.watchlists[req.user.id]
        });

    } catch (error) {
        console.error('Toggle watched error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating watched status'
        });
    }
});

// TOGGLE FAVORITE STATUS
app.post('/api/watchlist/toggle-favorite', authenticateToken, async (req, res) => {
    try {
        const { filmId, favorite } = req.body;
        const data = readData();

        if (!data.watchlists[req.user.id]) {
            return res.status(404).json({
                success: false,
                message: 'Watchlist not found'
            });
        }

        const filmIndex = data.watchlists[req.user.id].findIndex(item => item.filmId == filmId);
        
        if (filmIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Film not found in watchlist'
            });
        }

        data.watchlists[req.user.id][filmIndex].favorite = favorite;
        writeData(data);

        res.json({
            success: true,
            message: favorite ? 'Movie added to favorites' : 'Movie removed from favorites',
            watchlist: data.watchlists[req.user.id]
        });

    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating favorite status'
        });
    }
});

// ============================================================
// BOOKING ROUTES
// ============================================================

// GET BOOKINGS
app.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const data = readData();
        const bookings = data.bookings[req.user.id] || [];
        res.json(bookings);
    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching bookings'
        });
    }
});

// CREATE BOOKING
app.post('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const {
            filmTitle,
            screen,
            showtime,
            seats,
            ticketQuantity,
            ticketPrice,
            snacks,
            total
        } = req.body;

        const data = readData();

        if (!data.bookings[req.user.id]) {
            data.bookings[req.user.id] = [];
        }

        const bookingRef = 'SC-' + Date.now().toString().slice(-6) + '-' + 
                          Math.random().toString(36).substring(2, 6).toUpperCase();

        const booking = {
            bookingRef,
            filmTitle,
            screen,
            showtime,
            seats: seats || [],
            ticketQuantity,
            ticketPrice,
            snacks: snacks || [],
            total,
            bookingDate: new Date(),
            status: 'confirmed'
        };

        data.bookings[req.user.id].push(booking);
        writeData(data);

        res.json({
            success: true,
            message: 'Booking created successfully',
            bookingRef,
            booking
        });

    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating booking'
        });
    }
});

// ============================================================
// EMAIL ROUTE
// ============================================================

app.post('/api/send-booking-email', async (req, res) => {
    try {
        if (!transporter) {
            return res.status(503).json({
                success: false,
                message: 'Email service is not configured. Please check Gmail credentials.'
            });
        }

        const {
            to,
            customerName,
            bookingRef,
            film,
            screen,
            showtime,
            seats,
            tickets,
            ticketPrice,
            snacks,
            total,
            venue,
            timestamp
        } = req.body;

        if (!to) {
            return res.status(400).json({
                success: false,
                message: 'Customer email is required'
            });
        }

        const mailOptions = {
            from: `"Savannah Cinemas" <${GMAIL_USER}>`,
            to: to,
            subject: `Booking Confirmation — ${bookingRef}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1D1D28; color: #F2EFE9; padding: 30px; border-radius: 14px;">
                    <h1 style="font-family: Oswald, sans-serif; color: #E8B34C;">SAVANNAH CINEMAS</h1>
                    <h2 style="color: #E8B34C;">Booking Confirmed ✅</h2>
                    <p>Hello ${customerName || 'Valued Customer'},</p>
                    <p>Your booking for <strong style="color: #E8B34C;">${film}</strong> has been confirmed.</p>
                    <hr style="border-color: #2C2C3A;">
                    <p><strong>Booking Reference:</strong> <span style="color: #E8B34C;">${bookingRef}</span></p>
                    <p><strong>Film:</strong> ${film}</p>
                    <p><strong>Screen:</strong> ${screen}</p>
                    <p><strong>Showtime:</strong> ${showtime}</p>
                    <p><strong>Seats:</strong> ${seats}</p>
                    <p><strong>Tickets:</strong> ${tickets}</p>
                    <p><strong>Total:</strong> ${total}</p>
                    <hr style="border-color: #2C2C3A;">
                    <p style="color: #B9B6AC;">Thank you for choosing Savannah Cinemas! 🎬</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Booking email sent:', info.messageId);

        res.json({
            success: true,
            message: 'Booking confirmation sent successfully',
            messageId: info.messageId
        });

    } catch (error) {
        console.error('❌ Email sending error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to send booking confirmation: ' + error.message
        });
    }
});

// ============================================================
// SERVER START
// ============================================================

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Savannah Cinemas Server is running',
        storage: 'File-based (No MongoDB required)',
        emailConfigured: !!transporter
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📁 Data stored in: ${DATA_FILE}`);
    console.log(`📧 Email service: ${transporter ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🔑 JWT Secret: ${JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
    console.log(`\n📍 API URL: http://10.20.10.150:${PORT}/api`);
    console.log(`📍 Health Check: http://10.20.10.150:${PORT}/\n`);
    console.log(`Access from other devices at: http://10.20.10.150:${PORT}`);
});