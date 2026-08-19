require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ============================================================
// MONGODB CONNECTION
// ============================================================

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/savannah_cinemas', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ============================================================
// USER SCHEMA
// ============================================================

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    memberSince: {
        type: Date,
        default: Date.now
    },
    watchlist: [{
        movieId: {
            type: Number,
            required: true
        },
        title: String,
        year: String,
        poster: String,
        rating: Number,
        addedDate: {
            type: Date,
            default: Date.now
        },
        watched: {
            type: Boolean,
            default: false
        },
        favorite: {
            type: Boolean,
            default: false
        },
        watchedDate: Date
    }],
    bookingHistory: [{
        bookingRef: String,
        filmTitle: String,
        screen: String,
        showtime: String,
        seats: [String],
        ticketQuantity: Number,
        ticketPrice: Number,
        snacks: [{
            name: String,
            flavor: String,
            qty: Number,
            price: Number
        }],
        total: Number,
        bookingDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['confirmed', 'cancelled', 'completed'],
            default: 'confirmed'
        }
    }],
    preferences: {
        notifications: {
            type: Boolean,
            default: true
        },
        newsletter: {
            type: Boolean,
            default: true
        },
        language: {
            type: String,
            default: 'en'
        }
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', UserSchema);

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
// GMAIL SMTP TRANSPORTER
// ============================================================

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    },
    requireTLS: true
});

transporter.verify()
    .then(() => console.log('✅ Gmail SMTP connection successful'))
    .catch((error) => console.error('❌ Gmail SMTP connection failed:', error));

// ============================================================
// WELCOME EMAIL TEMPLATE
// ============================================================

function getWelcomeEmailHTML(name, email) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { background: #14141C; font-family: 'Inter', Arial, sans-serif; color: #F2EFE9; padding: 30px; }
                .container { max-width: 600px; margin: auto; background: #1D1D28; padding: 30px; border-radius: 14px; border: 1px solid #2C2C3A; }
                .logo { font-family: 'Oswald', sans-serif; font-size: 28px; color: #F2EFE9; text-align: center; }
                .logo span { color: #E8B34C; }
                .tagline { text-align: center; color: #B9B6AC; font-size: 13px; margin-bottom: 20px; }
                .badge { display: inline-block; background: rgba(232,179,76,0.1); border: 1px solid #E8B34C; color: #E8B34C; padding: 4px 16px; border-radius: 20px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
                .title { font-family: 'Oswald', sans-serif; font-size: 24px; color: #F2EFE9; margin: 20px 0 10px; }
                .text { color: #B9B6AC; line-height: 1.6; }
                .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
                .feature { background: #14141C; border: 1px solid #2C2C3A; border-radius: 8px; padding: 16px; text-align: center; }
                .feature .icon { font-size: 28px; display: block; margin-bottom: 4px; }
                .feature .name { font-family: 'Oswald', sans-serif; font-size: 14px; color: #F2EFE9; }
                .feature .desc { font-size: 12px; color: #B9B6AC; }
                .button { display: inline-block; background: #E8B34C; color: #14141C; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-top: 16px; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #2C2C3A; }
                .footer-text { font-size: 11px; color: #6B6A6A; }
                .footer-links { display: flex; justify-content: center; gap: 20px; margin-bottom: 12px; }
                .footer-links a { color: #B9B6AC; text-decoration: none; font-size: 12px; }
                @media (max-width: 480px) {
                    .feature-grid { grid-template-columns: 1fr; }
                    .container { padding: 20px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">SAVANNAH <span>CINEMAS</span></div>
                <div class="tagline">Book the seat, keep the stub.</div>
                <div style="text-align:center;">
                    <span class="badge">👋 Welcome!</span>
                </div>

                <div class="title">Hello ${name},</div>
                <p class="text">Welcome to Savannah Cinemas! We're thrilled to have you join our community of film lovers.</p>

                <div class="feature-grid">
                    <div class="feature">
                        <span class="icon">🎟️</span>
                        <div class="name">Easy Booking</div>
                        <div class="desc">Book tickets in seconds</div>
                    </div>
                    <div class="feature">
                        <span class="icon">📱</span>
                        <div class="name">Mobile Ready</div>
                        <div class="desc">Access anytime, anywhere</div>
                    </div>
                    <div class="feature">
                        <span class="icon">❤️</span>
                        <div class="name">Watchlist</div>
                        <div class="desc">Save films to watch later</div>
                    </div>
                    <div class="feature">
                        <span class="icon">⭐</span>
                        <div class="name">Personalized</div>
                        <div class="desc">Recommendations just for you</div>
                    </div>
                </div>

                <div style="text-align:center;">
                    <a href="http://localhost:3000" class="button">Browse Movies →</a>
                </div>

                <div class="footer">
                    <div class="footer-links">
                        <a href="#">Browse Movies</a>
                        <a href="#">My Profile</a>
                        <a href="#">Help Center</a>
                    </div>
                    <div class="footer-text">
                        <strong>Savannah Cinemas</strong> · Book the seat, keep the stub.
                        <br>© 2026 Savannah Cinemas. All rights reserved.
                        <br>This email was sent to <strong style="color:#B9B6AC;">${email}</strong>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}

// ============================================================
// AUTHENTICATION ROUTES
// ============================================================

// REGISTER
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            memberSince: new Date()
        });

        await user.save();

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Send welcome email
        try {
            const mailOptions = {
                from: `"Savannah Cinemas" <${process.env.GMAIL_USER}>`,
                to: user.email,
                subject: 'Welcome to Savannah Cinemas! 🎬',
                html: getWelcomeEmailHTML(user.name, user.email)
            };
            await transporter.sendMail(mailOptions);
            console.log('✅ Welcome email sent to:', user.email);
        } catch (emailError) {
            console.error('❌ Welcome email failed:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
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

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
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
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.json({
            success: true,
            user
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
// USER PROFILE ROUTES
// ============================================================

// UPDATE USER PROFILE
app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { name, preferences } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (name) user.name = name;
        if (preferences) {
            user.preferences = { ...user.preferences, ...preferences };
        }

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                preferences: user.preferences
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating profile'
        });
    }
});

// CHANGE PASSWORD
app.put('/api/user/password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error changing password'
        });
    }
});

// DELETE ACCOUNT
app.delete('/api/user/account', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        await user.deleteOne();

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error deleting account'
        });
    }
});

// ============================================================
// WATCHLIST ROUTES
// ============================================================

// GET WATCHLIST
app.get('/api/watchlist', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            watchlist: user.watchlist
        });

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
        const { movieId, title, year, poster, rating } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if already in watchlist
        const exists = user.watchlist.some(item => item.movieId === movieId);
        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'Movie already in watchlist'
            });
        }

        user.watchlist.push({
            movieId,
            title,
            year,
            poster,
            rating,
            addedDate: new Date(),
            watched: false,
            favorite: false
        });

        await user.save();

        res.json({
            success: true,
            message: 'Movie added to watchlist',
            watchlist: user.watchlist
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
app.delete('/api/watchlist/:movieId', authenticateToken, async (req, res) => {
    try {
        const movieId = parseInt(req.params.movieId);
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.watchlist = user.watchlist.filter(item => item.movieId !== movieId);
        await user.save();

        res.json({
            success: true,
            message: 'Movie removed from watchlist',
            watchlist: user.watchlist
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
app.put('/api/watchlist/:movieId/watched', authenticateToken, async (req, res) => {
    try {
        const movieId = parseInt(req.params.movieId);
        const { watched } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const movie = user.watchlist.find(item => item.movieId === movieId);
        if (!movie) {
            return res.status(404).json({
                success: false,
                message: 'Movie not found in watchlist'
            });
        }

        movie.watched = watched;
        movie.watchedDate = watched ? new Date() : null;

        await user.save();

        res.json({
            success: true,
            message: watched ? 'Movie marked as watched' : 'Movie marked as unwatched',
            watchlist: user.watchlist
        });

    } catch (error) {
        console.error('Toggle watched error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating watch status'
        });
    }
});

// TOGGLE FAVORITE
app.put('/api/watchlist/:movieId/favorite', authenticateToken, async (req, res) => {
    try {
        const movieId = parseInt(req.params.movieId);
        const { favorite } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const movie = user.watchlist.find(item => item.movieId === movieId);
        if (!movie) {
            return res.status(404).json({
                success: false,
                message: 'Movie not found in watchlist'
            });
        }

        movie.favorite = favorite;

        await user.save();

        res.json({
            success: true,
            message: favorite ? 'Movie added to favorites' : 'Movie removed from favorites',
            watchlist: user.watchlist
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
// BOOKING HISTORY ROUTES
// ============================================================

// GET BOOKING HISTORY
app.get('/api/bookings', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Sort bookings by date (newest first)
        const bookings = user.bookingHistory.sort((a, b) => 
            new Date(b.bookingDate) - new Date(a.bookingDate)
        );

        res.json({
            success: true,
            bookings
        });

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

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate booking reference
        const bookingRef = 'SC-' + Date.now().toString().slice(-6) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

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

        user.bookingHistory.push(booking);
        await user.save();

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

// UPDATE BOOKING STATUS
app.put('/api/bookings/:bookingRef', authenticateToken, async (req, res) => {
    try {
        const { bookingRef } = req.params;
        const { status } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const booking = user.bookingHistory.find(b => b.bookingRef === bookingRef);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        booking.status = status;
        await user.save();

        res.json({
            success: true,
            message: 'Booking status updated',
            booking
        });

    } catch (error) {
        console.error('Update booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error updating booking'
        });
    }
});

// ============================================================
// EMAIL SENDING ROUTE
// ============================================================

app.post('/api/send-booking-email', async (req, res) => {
    try {
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
            from: `"Savannah Cinemas" <${process.env.GMAIL_USER}>`,
            to: to,
            subject: `Booking Confirmation — ${bookingRef}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { background: #14141C; font-family: 'Inter', Arial, sans-serif; color: #F2EFE9; padding: 30px; }
                        .container { max-width: 600px; margin: auto; background: #1D1D28; padding: 30px; border-radius: 14px; border: 1px solid #2C2C3A; }
                        .logo { font-family: 'Oswald', sans-serif; font-size: 28px; color: #F2EFE9; text-align: center; }
                        .logo span { color: #E8B34C; }
                        .tagline { text-align: center; color: #B9B6AC; font-size: 13px; margin-bottom: 20px; }
                        .badge { display: inline-block; background: rgba(232,179,76,0.1); border: 1px solid #E8B34C; color: #E8B34C; padding: 4px 16px; border-radius: 20px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
                        .title { font-family: 'Oswald', sans-serif; font-size: 20px; color: #F2EFE9; margin: 20px 0 10px; }
                        .text { color: #B9B6AC; line-height: 1.6; }
                        .summary { background: #14141C; border: 1px solid #2C2C3A; border-radius: 8px; padding: 16px; margin: 16px 0; }
                        .summary-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #2C2C3A; font-size: 14px; }
                        .summary-item:last-child { border-bottom: none; }
                        .summary-item .label { color: #B9B6AC; }
                        .summary-item .value { color: #F2EFE9; }
                        .summary-item .value.gold { color: #E8B34C; }
                        .total { display: flex; justify-content: space-between; padding-top: 12px; margin-top: 8px; border-top: 2px solid #E8B34C; font-size: 18px; font-weight: 500; }
                        .total .label { color: #F2EFE9; }
                        .total .value { color: #E8B34C; }
                        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #2C2C3A; }
                        .footer-text { font-size: 11px; color: #6B6A6A; }
                        @media (max-width: 480px) { .container { padding: 20px; } .summary-item { font-size: 13px; flex-wrap: wrap; } }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">SAVANNAH <span>CINEMAS</span></div>
                        <div class="tagline">Book the seat, keep the stub.</div>
                        <div style="text-align:center;">
                            <span class="badge">✓ Booking Confirmed</span>
                        </div>

                        <div class="title">Hello ${customerName || 'Valued Customer'},</div>
                        <p class="text">Your booking for <strong style="color:#E8B34C;">${film}</strong> has been confirmed.</p>

                        <div style="background:#14141C;border:1px solid #2C2C3A;border-radius:8px;padding:10px 16px;margin:12px 0;">
                            <span style="color:#B9B6AC;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Booking Reference</span>
                            <br>
                            <span style="color:#E8B34C;font-size:16px;font-weight:500;font-family:'IBM Plex Mono',monospace;">${bookingRef}</span>
                        </div>

                        <div class="summary">
                            <div class="summary-item">
                                <span class="label">Film</span>
                                <span class="value">${film}</span>
                            </div>
                            <div class="summary-item">
                                <span class="label">Screen / Showtime</span>
                                <span class="value">${screen} · ${showtime}</span>
                            </div>
                            <div class="summary-item">
                                <span class="label">Tickets</span>
                                <span class="value">${tickets}</span>
                            </div>
                            <div class="summary-item">
                                <span class="label">Seats</span>
                                <span class="value">${seats}</span>
                            </div>
                            ${snacks && snacks !== 'None' ? `
                            <div class="summary-item">
                                <span class="label">Snacks</span>
                                <span class="value">${snacks}</span>
                            </div>` : ''}
                            <div class="summary-item">
                                <span class="label">Venue</span>
                                <span class="value">${venue || 'Savannah Mall, Accra, Ghana'}</span>
                            </div>
                            <div class="total">
                                <span class="label">Total</span>
                                <span class="value">${total}</span>
                            </div>
                        </div>

                        <p class="text" style="font-size:13px;">
                            <strong style="color:#E8B34C;">📌 Important:</strong> Please arrive at least 15 minutes before showtime.
                            <br>Present your booking reference at the ticket counter.
                        </p>

                        <div class="footer">
                            <div style="display:flex;justify-content:center;gap:20px;flex-wrap:wrap;margin-bottom:12px;">
                                <a href="#" style="color:#B9B6AC;text-decoration:none;font-size:12px;">View Booking</a>
                                <a href="#" style="color:#B9B6AC;text-decoration:none;font-size:12px;">Contact Us</a>
                                <a href="#" style="color:#B9B6AC;text-decoration:none;font-size:12px;">Help Center</a>
                            </div>
                            <div class="footer-text">
                                <strong>Savannah Cinemas</strong> · Book the seat, keep the stub.
                                <br>© 2026 Savannah Cinemas. All rights reserved.
                                <br>This email was sent to <strong style="color:#B9B6AC;">${to}</strong>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
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
        console.error('❌ Email sending error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send booking confirmation'
        });
    }
});

// ============================================================
// SERVER START
// ============================================================

app.listen(PORT, () => {
    console.log(`🚀 Email server running on port ${PORT}`);
});