// No .env file on Supabase (settings come from Edge Function secrets)
if (globalThis.SAVANNAH_RUNTIME !== 'edge') require('dotenv').config();

const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const nodemailer = require('nodemailer');

// ============================================================
// ROUTES
// ============================================================

const authRoutes = require('./routes/authRoutes');
const guestRoutes = require('./routes/guestRoutes');
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
const concessionRoutes = require('./routes/concessionRoutes');
const eventRoutes = require('./routes/eventRoutes');
const rewardRoutes = require('./routes/rewardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const profileRoutes = require('./routes/profileRoutes');
const specialRoutes = require('./routes/specialRoutes');
const { startNotificationJob } = require('./services/notifications');
const { startAutoGeneration } = require('./services/showtimeScheduler');
const { startMovieStatusRefresh } = require('./services/movieStatus');
const { startCatalogAutoSync } = require('./services/catalogSync');
const { checkOnStartup: checkMigrations } = require('./services/migrations');

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

// Running inside a Supabase Edge Function (see supabase/functions/api)
const EDGE = (globalThis.SAVANNAH_RUNTIME || process.env.RUNTIME) === 'edge';
const supabaseAuth = require('./services/supabaseAuth');

if (!JWT_SECRET && !supabaseAuth.enabled()) {

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
// SCHEDULED JOBS (Supabase)
// On Supabase there's no always-on server to run timers, so the
// database's scheduler (pg_cron, see supabase/cron.sql) calls these.
// Protected by CRON_SECRET.
//   POST /api/jobs/movie-status   films move upcoming -> showing -> ended
//   POST /api/jobs/notifications  booking reminders, film alerts
//   POST /api/jobs/showtimes      keep the next two weeks programmed
//   POST /api/jobs/catalog        new films from TMDB (?pages=1)
// ============================================================

// The jobs secret: the CRON_SECRET setting, or on Supabase the Vault
// secret 'savannah_cron_secret' that supabase/cron.sql also reads.
let vaultCronSecret = null;
async function cronSecret() {
    if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
    if (vaultCronSecret) return vaultCronSecret;
    try {
        const r = await pool.query("SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'savannah_cron_secret'");
        vaultCronSecret = r.rows[0]?.decrypted_secret || null;
    } catch {
        vaultCronSecret = null; // no Vault (plain Postgres)
    }
    return vaultCronSecret;
}

app.post('/api/jobs/:job', async (req, res) => {

    const secret = await cronSecret();
    const given = String(req.headers['x-cron-secret'] || '');
    if (!secret || given.length !== secret.length || !require('crypto').timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
        return res.status(401).json({ success: false, message: 'Not allowed' });
    }

    const started = Date.now();

    try {
        let result;
        switch (req.params.job) {
            case 'movie-status':
                result = { changed: await require('./services/movieStatus').refreshMovieStatuses() };
                break;
            case 'notifications':
                result = await require('./services/notifications').generateDue();
                break;
            case 'showtimes': {
                const r = await require('./services/showtimeScheduler').generateShowtimes(
                    process.env.SHOWTIME_AUTOGEN_DAYS ? { days: Number(process.env.SHOWTIME_AUTOGEN_DAYS) } : {}
                );
                result = { from: r.from, to: r.to, created: r.created, removed: r.removed, specials: (r.specials || []).length };
                break;
            }
            case 'catalog': {
                const pages = Math.max(1, Math.min(3, Number(req.query.pages) || 1));
                const r = await require('./services/catalogSync').syncCatalog({ nowPages: pages, upcomingPages: pages });
                result = { inserted: r.inserted, updated: r.updated, skipped: r.skipped, failed: r.failed };
                break;
            }
            default:
                return res.status(404).json({ success: false, message: 'Unknown job' });
        }
        return res.json({ success: true, job: req.params.job, ms: Date.now() - started, result });
    } catch (error) {
        console.error(`❌ Job ${req.params.job} failed:`, error);
        return res.status(500).json({ success: false, job: req.params.job, message: error.message });
    }
});


// ============================================================
// SERVE FRONTEND
// ============================================================

// Not on Supabase: the function has no files to serve (and the hosted
// runtime refuses to look outside its own folder). The website and its
// images are on GitHub Pages there.
if (!EDGE) {

    app.use(
        express.static(
            path.join(__dirname, '../public')
        )
    );

    // Website images (used by the app's concessions menu)
    app.use(
        '/images',
        express.static(
            path.join(__dirname, '../images')
        )
    );

}


// ============================================================
// API ROUTES
// ============================================================

// Website guests (book without an account)
app.use(
    '/api/guest',
    guestRoutes
);

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

// Concessions (snacks & drinks)
app.use(
    '/api/concessions',
    concessionRoutes
);

app.use(
    '/api/events',
    eventRoutes
);

app.use(
    '/api/rewards',
    rewardRoutes
);

app.use(
    '/api/notifications',
    notificationRoutes
);

app.use(
    '/api/profile',
    profileRoutes
);

app.use(
    '/api/specials',
    specialRoutes
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
        // Database up to date? (Development/migrations)
        // ----------------------------------------------------

        await checkMigrations();


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


                // Films move UPCOMING -> NOW_SHOWING -> ENDED as
                // their dates arrive (checked at start and hourly)
                startMovieStatusRefresh();

                // Booking reminders and film alerts for the in-app inbox
                startNotificationJob();

                // New releases from TMDB once a day (opt-in:
                // TMDB_AUTOSYNC=true in .env)
                if (startCatalogAutoSync()) {

                    console.log(
                        '🎞️ TMDB catalogue sync: on (daily)'
                    );

                }

                // Keep the next two weeks programmed (opt-in:
                // SHOWTIME_AUTOGEN=true in .env)
                if (startAutoGeneration()) {

                    console.log(
                        '🎬 Showtime auto-generation: on (every 6 hours)'
                    );

                    console.log('');

                }

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


// ============================================================
// START APPLICATION
// On Supabase (RUNTIME=edge) the Edge Function wrapper starts the
// app; there are no timers there (see the jobs routes above).
// ============================================================

if (EDGE) {

    module.exports = app;

} else {

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    startServer();

}
