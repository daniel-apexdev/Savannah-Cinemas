require('dotenv').config();

const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const nodemailer = require('nodemailer');

// ============================================================
// ROUTES
// ============================================================

const authRoutes = require('./routes/authRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const movieRoutes = require('./routes/movieRoutes');
const tmdbRoutes = require('./routes/tmdbRoutes');
const movieEnrichmentRoutes = require('./routes/movieEnrichmentRoutes');
const cinemaRoutes = require('./routes/cinemaRoutes');
const showtimeRoutes = require('./routes/showtimeRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const userRoutes = require('./routes/userRoutes');
const favouriteRoutes = require('./routes/favouriteRoutes');
const movieReviewRoutes = require('./routes/movieReviewRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');
const cinemaFavoriteRoutes = require('./routes/cinemaFavoriteRoutes');
const movieViewRoutes = require('./routes/movieViewRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const promotionRoutes = require('./routes/promotionRoutes');

// ============================================================
// MIDDLEWARE
// ============================================================

const {
    authenticateToken
} = require('./middleware/authMiddleware');

const authorize =
    require('./middleware/roleMiddleware');

// ============================================================
// DATABASE
// ============================================================

const pool =
    require('./config/database');

// ============================================================
// SERVER CONFIGURATION
// ============================================================

const app = express();

const PORT =
    process.env.PORT || 5000;

const SERVER_IP =
    process.env.SERVER_IP || getLocalIP();

const JWT_SECRET =
    process.env.JWT_SECRET;


// ============================================================
// ENVIRONMENT VALIDATION
// ============================================================

if (!JWT_SECRET) {

    console.error(
        '❌ JWT_SECRET is not configured in .env'
    );

    process.exit(1);
}


// ============================================================
// MIDDLEWARE CONFIGURATION
// ============================================================

app.use(cors());

app.use(express.json());


// ============================================================
// SERVE FRONTEND
// ============================================================

app.use(
    express.static(
        path.join(__dirname, '../public')
    )
);


// ============================================================
// API ROUTES
// ============================================================

// Authentication
app.use(
    '/api/auth',
    authRoutes
);


// Watchlist
app.use(
    '/api/watchlist',
    watchlistRoutes
);


// Movies
app.use(
    '/api/movies',
    movieRoutes
);


// TMDB
app.use(
    '/api/movies/tmdb',
    tmdbRoutes
);


// Movie enrichment
app.use(
    '/api/movies/enrichment',
    movieEnrichmentRoutes
);


// Cinemas
app.use(
    '/api/cinemas',
    cinemaRoutes
);


// Showtimes
app.use(
    '/api/showtimes',
    showtimeRoutes
);


// Bookings
app.use(
    '/api/bookings',
    bookingRoutes
);


// Payments
app.use(
    '/api/payments',
    paymentRoutes
);


// Tickets
app.use(
    '/api/tickets',
    ticketRoutes
);


// Users
app.use(
    '/api/users',
    userRoutes
);


// User favourites
app.use(
    '/api/users/me/favourites',
    favouriteRoutes
);


// Movie reviews
app.use(
    '/api/reviews',
    movieReviewRoutes
);


// User preferences
app.use(
    '/api/users/me/preferences',
    preferenceRoutes
);


// Cinema favourites
app.use(
    '/api/favorites/cinemas',
    cinemaFavoriteRoutes
);


// Movie views
app.use(
    '/api/movies/views',
    movieViewRoutes
);


// Ticket pricing
app.use(
    '/api/pricing',
    pricingRoutes
);


// Promotions
app.use(
    '/api/promotions',
    promotionRoutes
);


// ============================================================
// LOCAL IP DETECTION
// ============================================================

function getLocalIP() {

    try {

        const interfaces =
            os.networkInterfaces();


        for (
            const name of Object.keys(interfaces)
        ) {

            for (
                const iface of interfaces[name]
            ) {

                if (
                    iface.family === 'IPv4' &&
                    !iface.internal
                ) {

                    return iface.address;

                }
            }
        }


        return 'localhost';

    } catch (error) {

        return 'localhost';

    }
}


// ============================================================
// GMAIL SMTP
// ============================================================

const GMAIL_USER =
    process.env.GMAIL_USER;

const GMAIL_APP_PASSWORD =
    process.env.GMAIL_APP_PASSWORD;

let transporter = null;


if (
    GMAIL_USER &&
    GMAIL_APP_PASSWORD
) {

    transporter =
        nodemailer.createTransport({

            host: 'smtp.gmail.com',

            port: 465,

            secure: true,

            auth: {
                user: GMAIL_USER,
                pass: GMAIL_APP_PASSWORD
            }

        });


    transporter.verify()

        .then(() => {

            console.log(
                '✅ Gmail SMTP connection successful'
            );

            console.log(
                `📧 Email account: ${GMAIL_USER}`
            );

        })

        .catch((error) => {

            console.error(
                '❌ Gmail SMTP connection failed:',
                error.message
            );

            transporter = null;

        });

} else {

    console.warn(
        '⚠️ Gmail credentials are not configured.'
    );

}


// ============================================================
// BASIC ROUTES
// ============================================================

app.get('/', (req, res) => {

    res.json({

        success: true,

        application:
            'Savannah Cinemas API',

        status:
            'online',

        version:
            '1.0.0'

    });

});


app.get('/api/test', (req, res) => {

    res.json({

        success: true,

        message:
            'Savannah Cinemas API is working!'

    });

});


// ============================================================
// DATABASE HEALTH CHECK
// ============================================================

app.get(
    '/api/health/database',
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    'SELECT NOW() AS current_time'
                );


            res.json({

                success: true,

                database:
                    'PostgreSQL',

                status:
                    'connected',

                currentTime:
                    result.rows[0].current_time

            });

        } catch (error) {

            console.error(
                '❌ Database health check failed:',
                error
            );


            res.status(500).json({

                success: false,

                database:
                    'PostgreSQL',

                status:
                    'disconnected',

                message:
                    'Unable to connect to database'

            });

        }

    }
);


// ============================================================
// ADMIN TEST
// ============================================================

app.get(
    '/api/admin/test',

    authenticateToken,

    authorize('ADMIN'),

    (req, res) => {

        res.json({

            success: true,

            message:
                'Welcome to the Savannah Cinemas administration area',

            user:
                req.user

        });

    }
);


// ============================================================
// EMAIL ROUTE
// ============================================================

app.post(
    '/api/send-booking-email',
    async (req, res) => {

        try {

            if (!transporter) {

                return res.status(503).json({

                    success: false,

                    message:
                        'Email service is not configured'

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
                total
            } = req.body;


            if (!to) {

                return res.status(400).json({

                    success: false,

                    message:
                        'Customer email is required'

                });

            }


            const mailOptions = {

                from:
                    `"Savannah Cinemas" <${GMAIL_USER}>`,

                to,

                subject:
                    `Booking Confirmation — ${bookingRef}`,

                html: `
                    <div style="
                        font-family: Arial, sans-serif;
                        max-width: 600px;
                        margin: 0 auto;
                        background: #1D1D28;
                        color: #F2EFE9;
                        padding: 30px;
                        border-radius: 14px;
                    ">

                        <h1 style="
                            color: #E8B34C;
                        ">
                            SAVANNAH CINEMAS
                        </h1>

                        <h2 style="
                            color: #E8B34C;
                        ">
                            Booking Confirmed ✅
                        </h2>

                        <p>
                            Hello
                            ${customerName || 'Valued Customer'},
                        </p>

                        <p>
                            Your booking for
                            <strong style="color: #E8B34C;">
                                ${film}
                            </strong>
                            has been confirmed.
                        </p>

                        <hr style="
                            border-color: #2C2C3A;
                        ">

                        <p>
                            <strong>
                                Booking Reference:
                            </strong>

                            <span style="
                                color: #E8B34C;
                            ">
                                ${bookingRef}
                            </span>
                        </p>

                        <p>
                            <strong>Film:</strong>
                            ${film}
                        </p>

                        <p>
                            <strong>Screen:</strong>
                            ${screen}
                        </p>

                        <p>
                            <strong>Showtime:</strong>
                            ${showtime}
                        </p>

                        <p>
                            <strong>Seats:</strong>
                            ${seats}
                        </p>

                        <p>
                            <strong>Tickets:</strong>
                            ${tickets}
                        </p>

                        <p>
                            <strong>Total:</strong>
                            ${total}
                        </p>

                        <hr style="
                            border-color: #2C2C3A;
                        ">

                        <p style="
                            color: #B9B6AC;
                        ">
                            Thank you for choosing
                            Savannah Cinemas! 🎬
                        </p>

                    </div>
                `
            };


            const info =
                await transporter.sendMail(
                    mailOptions
                );


            console.log(
                '✅ Booking email sent:',
                info.messageId
            );


            res.json({

                success: true,

                message:
                    'Booking confirmation sent successfully',

                messageId:
                    info.messageId

            });

        } catch (error) {

            console.error(
                '❌ Email sending error:',
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    'Failed to send booking confirmation: ' +
                    error.message

            });

        }

    }
);


// ============================================================
// 404 HANDLER
// ============================================================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                'API endpoint not found',

            path:
                req.originalUrl

        });

    }
);


// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
    (error, req, res, next) => {

        console.error(
            '❌ Unhandled server error:',
            error
        );


        res.status(500).json({

            success: false,

            message:
                'Internal server error'

        });

    }
);


// ============================================================
// SERVER STARTUP
// ============================================================

async function startServer() {

    try {

        console.log('');

        console.log(
            '=============================================='
        );

        console.log(
            '       SAVANNAH CINEMAS API'
        );

        console.log(
            '=============================================='
        );

        console.log('');


        // ----------------------------------------------------
        // Test PostgreSQL
        // ----------------------------------------------------

        const result =
            await pool.query(
                'SELECT NOW() AS current_time'
            );


        console.log(
            '✅ PostgreSQL database connected successfully'
        );

        console.log(
            `🕐 Database time: ${result.rows[0].current_time}`
        );


        // ----------------------------------------------------
        // Start Express
        // ----------------------------------------------------

        app.listen(
            PORT,
            '0.0.0.0',
            () => {

                console.log('');

                console.log(
                    '🚀 Savannah Cinemas API is running'
                );

                console.log('');

                console.log(
                    `📍 Local:   http://localhost:${PORT}`
                );

                console.log(
                    `📍 Network: http://${SERVER_IP}:${PORT}`
                );

                console.log('');

                console.log(
                    '🗄️ Database: PostgreSQL'
                );

                console.log(
                    `👤 User:     ${process.env.DB_USER}`
                );

                console.log('');

                console.log('Health checks:');

                console.log(
                    `➡️ API:      http://localhost:${PORT}/api/test`
                );

                console.log(
                    `➡️ Database: http://localhost:${PORT}/api/health/database`
                );

                console.log('');

                console.log(
                    '=============================================='
                );

                console.log('');

            }
        );

    } catch (error) {

        console.error('');

        console.error(
            '❌ FAILED TO START SAVANNAH CINEMAS API'
        );

        console.error('');

        console.error(error);

        console.error('');

        process.exit(1);

    }

}


// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown() {

    console.log('');

    console.log(
        '🛑 Shutting down Savannah Cinemas API...'
    );


    try {

        await pool.end();


        console.log(
            '✅ PostgreSQL pool closed'
        );

        console.log(
            '✅ Shutdown complete'
        );


        process.exit(0);

    } catch (error) {

        console.error(
            '❌ Error during shutdown:',
            error
        );


        process.exit(1);

    }

}


process.on(
    'SIGINT',
    shutdown
);

process.on(
    'SIGTERM',
    shutdown
);


// ============================================================
// START APPLICATION
// ============================================================

startServer();
