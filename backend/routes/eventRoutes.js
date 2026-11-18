// ============================================================
// SAVANNAH CINEMAS - EVENTS
// routes/eventRoutes.js
//
// GET /api/events   upcoming events, soonest first (public)
//
// Weekly events come back with their next date. Table:
// cinema_events (Development/migrations/2026-11-19_events.sql).
// ============================================================

const express = require('express');
const pool = require('../config/database');

const router = express.Router();

const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                e.event_id, e.cinema_id, e.title, e.summary, e.details, e.tag,
                e.weekday, to_char(e.start_time, 'HH24:MI') AS start_time,
                e.movie_id, m.title AS movie_title, m.poster_url, m.backdrop_url,
                c.cinema_name,
                -- next occurrence (local cinema time)
                to_char(
                    CASE
                        WHEN e.starts_at IS NOT NULL THEN e.starts_at
                        ELSE (CURRENT_DATE + ((e.weekday - EXTRACT(ISODOW FROM CURRENT_DATE)::int + 7) % 7)
                              + CASE
                                    WHEN e.weekday = EXTRACT(ISODOW FROM CURRENT_DATE)::int
                                     AND e.start_time < LOCALTIME THEN 7
                                    ELSE 0
                                END) + e.start_time
                    END,
                    'YYYY-MM-DD"T"HH24:MI:SS'
                ) AS next_at
            FROM cinema_events e
            LEFT JOIN movies m ON m.movie_id = e.movie_id
            LEFT JOIN cinemas c ON c.cinema_id = e.cinema_id
            WHERE e.is_active
              AND (e.starts_at IS NULL OR e.starts_at >= LOCALTIMESTAMP - INTERVAL '3 hours')
              AND (e.ends_on IS NULL OR e.ends_on >= CURRENT_DATE)
            ORDER BY next_at, e.sort_order, e.event_id
            `
        );

        return res.json({
            success: true,
            events: result.rows.map(r => ({
                eventId: r.event_id,
                cinemaId: r.cinema_id,
                cinemaName: r.cinema_name,
                title: r.title,
                summary: r.summary,
                details: r.details,
                tag: r.tag,
                nextAt: r.next_at,
                recurring: r.weekday ? `Every ${WEEKDAYS[r.weekday]}` : null,
                time: r.start_time,
                movie: r.movie_id
                    ? { movieId: r.movie_id, title: r.movie_title, posterUrl: r.poster_url, backdropUrl: r.backdrop_url }
                    : null
            }))
        });
    } catch (error) {
        // Migration not run yet: no events, not an error for the app
        if (error.code === '42P01') {
            return res.json({ success: true, events: [], note: 'Run the 2026-11-19_events.sql migration to add events' });
        }
        console.error('Get events error:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching events' });
    }
});

module.exports = router;
