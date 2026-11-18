// ============================================================
// SAVANNAH CINEMAS - IN-APP NOTIFICATIONS
// services/notifications.js
//
// Fills the inbox (user_notifications). Nothing is sent from here:
// the app reads the inbox (bell in Account, banner while open) and
// schedules the same reminders on the phone itself.
//
//   BOOKING_REMINDER  3 hours before a paid booking's show
//   STARTING_SOON     30 minutes before
//   FILM_ON_SALE      a film you asked to be reminded about gets its
//                     first showtimes before it opens
//   FILM_OPENING      ... and on its opening day
//   TROPHY            a new Savannah Trophy
//
// Each notification has a dedupe key, so running this as often as we
// like never repeats one. Booking reminders follow the member's
// "Show reminders" setting; film alerts follow "Opening days".
// Times are local cinema time.
// ============================================================

const pool = require('../config/database');

const WANTS = (col) => `COALESCE(np.${col}, 'Y') <> 'N'`;

async function run(sql, params) {
    try {
        return (await pool.query(sql, params)).rowCount;
    } catch (e) {
        // Migration not run yet: nothing to do
        if (['42P01', '42703'].includes(e.code)) return 0;
        throw e;
    }
}

/** Create any notifications that are due (for one member, or everyone). */
async function generateDue(userId = null) {

    const who = userId == null ? null : Number(userId);
    let created = 0;

    // ---- Booking reminder: 3 hours before (skip if it's already < 30 min away)
    created += await run(
        `
        INSERT INTO user_notifications (user_id, kind, title, body, data, dedupe_key, deliver_at)
        SELECT
            b.user_id,
            'BOOKING_REMINDER',
            CASE WHEN st.start_time::time >= '17:00' THEN 'Tonight' ELSE 'Today' END
                || ' at ' || to_char(st.start_time, 'HH24:MI') || ': ' || m.title,
            sc.screen_name || ' · Seats ' ||
                COALESCE((SELECT string_agg(se.seat_label, ' ' ORDER BY se.row_label, se.seat_number)
                          FROM booking_seats bs JOIN seats se ON se.seat_id = bs.seat_id
                          WHERE bs.booking_id = b.booking_id), '') ||
                '. Your QR ticket is in the app.',
            jsonb_build_object('bookingId', b.booking_id, 'movieId', m.movie_id, 'startTime', to_char(st.start_time, 'YYYY-MM-DD"T"HH24:MI:SS')),
            'booking:' || b.booking_id || ':reminder',
            st.start_time - INTERVAL '3 hours'
        FROM bookings b
        JOIN showtimes st ON st.showtime_id = b.showtime_id
        JOIN movies m ON m.movie_id = st.movie_id
        JOIN screens sc ON sc.screen_id = st.screen_id
        LEFT JOIN user_notification_preferences np ON np.user_id = b.user_id
        WHERE b.status = 'CONFIRMED'
          AND st.status <> 'CANCELLED'
          AND st.start_time - INTERVAL '3 hours' <= LOCALTIMESTAMP
          AND st.start_time > LOCALTIMESTAMP + INTERVAL '30 minutes'
          AND ${WANTS('booking_reminders')}
          AND ($1::bigint IS NULL OR b.user_id = $1)
        ON CONFLICT (user_id, dedupe_key) DO NOTHING
        `,
        [who]
    );

    // ---- Starting soon: 30 minutes before
    created += await run(
        `
        INSERT INTO user_notifications (user_id, kind, title, body, data, dedupe_key, deliver_at)
        SELECT
            b.user_id,
            'STARTING_SOON',
            m.title || ' starts at ' || to_char(st.start_time, 'HH24:MI'),
            'Head to ' || sc.screen_name || '. Seats ' ||
                COALESCE((SELECT string_agg(se.seat_label, ' ' ORDER BY se.row_label, se.seat_number)
                          FROM booking_seats bs JOIN seats se ON se.seat_id = bs.seat_id
                          WHERE bs.booking_id = b.booking_id), '') || '. Enjoy the film!',
            jsonb_build_object('bookingId', b.booking_id, 'movieId', m.movie_id, 'startTime', to_char(st.start_time, 'YYYY-MM-DD"T"HH24:MI:SS')),
            'booking:' || b.booking_id || ':starting',
            st.start_time - INTERVAL '30 minutes'
        FROM bookings b
        JOIN showtimes st ON st.showtime_id = b.showtime_id
        JOIN movies m ON m.movie_id = st.movie_id
        JOIN screens sc ON sc.screen_id = st.screen_id
        LEFT JOIN user_notification_preferences np ON np.user_id = b.user_id
        WHERE b.status = 'CONFIRMED'
          AND st.status <> 'CANCELLED'
          AND st.start_time - INTERVAL '30 minutes' <= LOCALTIMESTAMP
          AND st.start_time > LOCALTIMESTAMP - INTERVAL '10 minutes'
          AND ${WANTS('booking_reminders')}
          AND ($1::bigint IS NULL OR b.user_id = $1)
        ON CONFLICT (user_id, dedupe_key) DO NOTHING
        `,
        [who]
    );

    // ---- Reminded film goes on sale before it opens
    created += await run(
        `
        INSERT INTO user_notifications (user_id, kind, title, body, data, dedupe_key)
        SELECT
            fr.user_id,
            'FILM_ON_SALE',
            'Tickets for ' || m.title || ' are on sale',
            'It opens ' || to_char(m.release_date, 'Dy DD Mon') || '. Book early for the best seats.',
            jsonb_build_object('movieId', m.movie_id),
            'film:' || m.movie_id || ':onsale'
        FROM film_reminders fr
        JOIN movies m ON m.movie_id = fr.movie_id
        LEFT JOIN user_notification_preferences np ON np.user_id = fr.user_id
        WHERE m.release_date > CURRENT_DATE
          AND EXISTS (
                SELECT 1 FROM showtimes st
                WHERE st.movie_id = m.movie_id AND st.is_active = 'Y'
                  AND st.status <> 'CANCELLED' AND st.start_time > LOCALTIMESTAMP
          )
          AND ${WANTS('movie_releases')}
          AND ($1::bigint IS NULL OR fr.user_id = $1)
        ON CONFLICT (user_id, dedupe_key) DO NOTHING
        `,
        [who]
    );

    // ---- Reminded film opens (from 09:00 on opening day; up to a week late)
    created += await run(
        `
        INSERT INTO user_notifications (user_id, kind, title, body, data, dedupe_key, deliver_at)
        SELECT
            fr.user_id,
            'FILM_OPENING',
            CASE WHEN m.release_date = CURRENT_DATE THEN m.title || ' opens today' ELSE m.title || ' is now showing' END,
            'You asked us to remind you. See the showtimes and book your seats.',
            jsonb_build_object('movieId', m.movie_id),
            'film:' || m.movie_id || ':open',
            GREATEST(m.release_date + TIME '09:00', fr.created_at)
        FROM film_reminders fr
        JOIN movies m ON m.movie_id = fr.movie_id
        LEFT JOIN user_notification_preferences np ON np.user_id = fr.user_id
        WHERE m.release_date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE
          AND m.release_date + TIME '09:00' <= LOCALTIMESTAMP
          AND ${WANTS('movie_releases')}
          AND ($1::bigint IS NULL OR fr.user_id = $1)
        ON CONFLICT (user_id, dedupe_key) DO NOTHING
        `,
        [who]
    );

    // ---- New trophies (earned in the last 30 days)
    let trophies = [];
    try {
        trophies = (await pool.query(
            `
            SELECT ut.user_id, ut.trophy_code, ut.earned_at
            FROM user_trophies ut
            WHERE ut.earned_at > LOCALTIMESTAMP - INTERVAL '30 days'
              AND ($1::bigint IS NULL OR ut.user_id = $1)
              AND NOT EXISTS (
                    SELECT 1 FROM user_notifications n
                    WHERE n.user_id = ut.user_id AND n.dedupe_key = 'trophy:' || ut.trophy_code
              )
            `,
            [who]
        )).rows;
    } catch (e) {
        if (!['42P01', '42703'].includes(e.code)) throw e;
    }
    if (trophies.length) {
        const { TROPHIES } = require('./rewards');
        const byCode = new Map(TROPHIES.map(t => [t.code, t]));
        for (const t of trophies) {
            const def = byCode.get(t.trophy_code);
            if (!def) continue;
            created += await run(
                `
                INSERT INTO user_notifications (user_id, kind, title, body, data, dedupe_key, deliver_at)
                VALUES ($1, 'TROPHY', $2, $3, $4::jsonb, $5, $6)
                ON CONFLICT (user_id, dedupe_key) DO NOTHING
                `,
                [
                    t.user_id,
                    `New trophy: ${def.name}`,
                    def.description,
                    JSON.stringify({ trophy: def.code }),
                    `trophy:${def.code}`,
                    t.earned_at
                ]
            );
        }
    }

    return created;
}

/** The member's inbox: delivered notifications, newest first. */
async function inbox(userId, limit = 60) {
    await generateDue(userId);
    try {
        const rows = (await pool.query(
            `
            SELECT notification_id, kind, title, body, data,
                   to_char(deliver_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS at,
                   read_at IS NOT NULL AS read
            FROM user_notifications
            WHERE user_id = $1 AND deliver_at <= LOCALTIMESTAMP
            ORDER BY deliver_at DESC, notification_id DESC
            LIMIT $2
            `,
            [userId, limit]
        )).rows;
        const unread = (await pool.query(
            `SELECT COUNT(*)::int AS n FROM user_notifications WHERE user_id = $1 AND read_at IS NULL AND deliver_at <= LOCALTIMESTAMP`,
            [userId]
        )).rows[0].n;
        return {
            unread,
            notifications: rows.map(r => ({
                id: Number(r.notification_id),
                kind: r.kind,
                title: r.title,
                body: r.body,
                data: r.data || {},
                at: r.at,
                read: r.read
            }))
        };
    } catch (e) {
        if (['42P01', '42703'].includes(e.code)) return { unread: 0, notifications: [] };
        throw e;
    }
}

async function markRead(userId, ids = null) {
    await run(
        `
        UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND read_at IS NULL AND deliver_at <= LOCALTIMESTAMP
          AND ($2::bigint[] IS NULL OR notification_id = ANY($2::bigint[]))
        `,
        [userId, ids && ids.length ? ids.map(Number) : null]
    );
}

// ---- Film reminders (bell on coming-soon films) ----

async function reminders(userId) {
    try {
        return (await pool.query(`SELECT movie_id FROM film_reminders WHERE user_id = $1`, [userId])).rows.map(r => Number(r.movie_id));
    } catch (e) {
        if (['42P01'].includes(e.code)) return [];
        throw e;
    }
}

async function setReminder(userId, movieId, on) {
    if (on) {
        await pool.query(
            `INSERT INTO film_reminders (user_id, movie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, movieId]
        );
    } else {
        await pool.query(`DELETE FROM film_reminders WHERE user_id = $1 AND movie_id = $2`, [userId, movieId]);
    }
}

/** Every 5 minutes on the server, so the inbox is ready when the app opens. */
function startNotificationJob(logger = console) {
    const tick = async () => {
        try {
            await generateDue();
        } catch (e) {
            logger.error('Notification job failed:', e.message);
        }
    };
    setTimeout(tick, 5000);
    const timer = setInterval(tick, 5 * 60 * 1000);
    if (timer.unref) timer.unref();
}

module.exports = { generateDue, inbox, markRead, reminders, setReminder, startNotificationJob };
