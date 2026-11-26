const pool = require('../config/database');
const { planSpecials } = require('./specialScreenings');
const { refreshMovieStatuses } = require('./movieStatus');


// ============================================================
// SHOWTIME SCHEDULER
//
// Programmes every active screen, day by day, for the next N days
// (default 14), the way a cinema programmer would:
//
//   - Opening to closing: first show 10:30 (10:00 at weekends),
//     last start 22:30. Today starts from "now + 45 min".
//   - Back-to-back on a screen: runtime + 25 min turnaround
//     (ads/trailers + cleaning), rounded up to the next 5 minutes.
//   - Each day has a slate, like a real programme:
//       * 2 headliners: the strongest films (rating, recent release,
//         opening day), on three screens, with first call on prime time.
//       * rotation: the films that have gone longest without a
//         screening, each on two or three screens (it varies by film
//         and by day), so a big catalogue cycles through the fortnight.
//   - Multi-screen: a film's shows go on different screens at
//     different times (at least an hour apart), so the same film is
//     on, say, Screen 1 at 13:00, Screen 3 at 16:20 and the VIP
//     screen at 19:40. It only repeats on one screen when there
//     aren't enough screens.
//   - Slots are filled greedily from the slate, scored on strength,
//     variety (not too many repeats, not twice in a row on a screen,
//     not starting near the same film on another screen) and fit to
//     the time of day (family films in the daytime, 18+/R films after
//     17:00, the VIP screen favours the strongest films).
//   - Which films: each day, every film whose run covers that day
//     (release_date .. run end, see movieStatus.js). So an UPCOMING
//     film gets showtimes from its opening day (advance sales), and a
//     film whose run ends mid-fortnight stops being scheduled.
//   - Prices: the showtime's base ticket_price follows ticket_prices
//     (VIP rate on VIP screens, else the ADULT weekday/weekend rate).
//     Seat-type pricing at booking time is unchanged.
//
// Every run also takes generated shows off sale (if unbooked) when
// they fall outside their film's run, e.g. an old film whose run was
// put right (prune_showtimes_outside_run, 2026-11-26 migration).
// Special screenings and hand-made shows are never pruned.
//
// Safe to run repeatedly: existing showtimes are never changed. New
// shows are only fitted into the free time around them (manual
// programming wins), and every insert re-checks for overlaps inside
// one transaction. A fully programmed day gets nothing new.
//
// rebuild: true first deletes FUTURE showtimes in the window that
// have no bookings at all (never ones with bookings, paid or not),
// then programmes again. Use it after adding screens or films.
// ============================================================

const DEFAULTS = {
    days: 14,
    openWeekday: 10 * 60 + 30,  // 10:30
    openWeekend: 10 * 60,       // 10:00
    lastStart: 22 * 60 + 30,    // 22:30
    turnaround: 25,             // minutes between end and next start
    roundTo: 5,                 // start times on 5-minute marks
    leadTimeToday: 45,          // first show today no sooner than this
    includeUpcoming: true       // schedule UPCOMING films from their release date
};

const FAMILY = new Set(['G', 'U', 'PG', 'TV-G', 'TV-Y', 'TV-Y7']);
const ADULT = new Set(['R', 'NC-17', '18', '18+', 'TV-MA']);


// ------------------------------------------------------------
// Date / time helpers. Timestamps are local cinema time (the
// showtimes table uses TIMESTAMP without time zone), so we work in
// "minutes since midnight" on calendar dates and never involve the
// server's time zone.
// ------------------------------------------------------------

function addDays(isoDate, n) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return t.toISOString().slice(0, 10);
}

function isoDow(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun
    return day === 0 ? 7 : day;                               // 1..7, Mon..Sun
}

function stamp(isoDate, minutes) {
    const dayOffset = Math.floor(minutes / 1440);
    const mins = ((minutes % 1440) + 1440) % 1440;
    const date = dayOffset ? addDays(isoDate, dayOffset) : isoDate;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `${date} ${hh}:${mm}:00`;
}

function minutesOf(ts) {
    // 'YYYY-MM-DD HH:MM[:SS]' or a Date from pg -> minutes since that date's midnight
    if (ts instanceof Date) return ts.getHours() * 60 + ts.getMinutes();
    const m = String(ts).match(/(\d{2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

function dateOf(ts) {
    if (ts instanceof Date) {
        return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}`;
    }
    return String(ts).slice(0, 10);
}

const roundUp = (mins, step) => Math.ceil(mins / step) * step;


// ------------------------------------------------------------
// Film strength: a base score the slot picker starts from
// ------------------------------------------------------------

function filmStrength(film, date) {
    // 0 or missing = unrated, not "worst"
    const rating = film.rating != null && Number(film.rating) > 0 ? Number(film.rating) : 6;
    let score = rating; // 0..10

    if (film.release_date) {
        const days = Math.round(
            (Date.parse(date + 'T00:00:00Z') - Date.parse(dateOf(film.release_date) + 'T00:00:00Z')) / 86400000
        );
        if (days >= 0 && days <= 3) score += 4;       // opening weekend
        else if (days > 3 && days <= 21) score += 2;  // still new
        else if (days > 120) score -= 1;              // older title
    }

    return score;
}


/**
 * Plan one day across all screens at once. Each step fills the
 * screen whose next free slot is earliest, so decisions are made in
 * time order: a film placed at 10:50 on one screen can still be given
 * a later slot on another. Mutates `state` and `otherStarts`.
 *
 * contexts: [{ screen, open, busy: [{ start, end, movieId }] }]
 * Returns Map(screen_id -> [{ film, start, end }]) in minutes since midnight.
 */
function planDay({ films, contexts, lastStart, opts, state, otherStarts }) {

    const ctxs = contexts.map(c => ({
        screen: c.screen,
        screenId: Number(c.screen.screen_id),
        vip: String(c.screen.screen_type || '').toUpperCase() === 'VIP',
        t: roundUp(c.open, opts.roundTo),
        previous: null,
        blocks: [...(c.busy || [])].sort((a, b) => a.start - b.start),
        plan: [],
        done: false
    }));

    // Must not run into a show that's already programmed on that screen
    const fits = (ctx, start, runtime) =>
        ctx.blocks.every(b => start + runtime + opts.turnaround <= b.start || start >= b.end + opts.turnaround);

    for (;;) {

        const open = ctxs.filter(c => !c.done && c.t <= lastStart);
        if (open.length === 0) break;
        const ctx = open.reduce((a, c) => (c.t < a.t || (c.t === a.t && c.screenId < a.screenId) ? c : a));
        const t = ctx.t;

        // Inside an existing show (or its turnaround)? Jump past it.
        const inside = ctx.blocks.find(b => t >= b.start && t < b.end + opts.turnaround);
        if (inside) {
            ctx.previous = inside.movieId;
            ctx.t = roundUp(inside.end + opts.turnaround, opts.roundTo);
            continue;
        }

        let best = null;

        // 1) the slate within the daily caps and rules
        // 2) any other film that fits the rules (e.g. a daytime family film
        //    when the slate is mostly 18+)
        // 3) the slate with the caps relaxed, so a slot is never left empty
        const passes = [[films, true], [state.reserve, true], [films, false]];
        for (const [pool, capped] of passes) {
        if (best) break;
        for (const film of pool) {

            const runtime = Number(film.runtime_minutes);
            // Must finish by 01:30 at the latest
            if (t + runtime > 25 * 60 + 30) continue;
            // Must not run into a show that's already programmed
            if (!fits(ctx, t, runtime)) continue;

            const age = String(film.age_rating || '').toUpperCase();
            const shownToday = state.today.get(film.movie_id) || 0;
            const headliner = state.headliners.has(film.movie_id);
            const target = state.target.get(film.movie_id) || 1;
            const screensUsed = state.onScreen.get(film.movie_id) || new Set();
            const starts = otherStarts.get(film.movie_id) || [];
            if (capped && shownToday >= target) continue;
            // Spread across screens: not twice on this screen while other screens are free for it
            if (capped && screensUsed.has(ctx.screenId) && screensUsed.size < Math.min(target, state.screenCount)) continue;
            // Different times on different screens: at least an hour apart
            if (capped && starts.some(s => Math.abs(s - t) < 60)) continue;
            // R / 18+ films don't start before 17:00 (relaxed only if nothing else fits)
            const age0 = String(film.age_rating || '').toUpperCase();
            if (capped && ADULT.has(age0) && t < 17 * 60) continue;

            let score = state.strength.get(film.movie_id) + (headliner ? 1.5 : 0);

            // Variety: spread a film's shows across the day and the screens
            score -= shownToday * (headliner ? 1.6 : 2.4);
            if (ctx.previous === film.movie_id) score -= 8;
            if (screensUsed.has(ctx.screenId)) score -= 6;
            const clash = starts.some(s => Math.abs(s - t) < 90);
            if (clash) score -= 5;
            // A film still short of its screens gets a nudge
            if (shownToday < target) score += 1;

            // Time of day
            const prime = t >= 18 * 60 && t <= 21 * 60;
            if (FAMILY.has(age)) {
                if (t < 17 * 60) score += 1.5;
                if (t >= 20 * 60 + 30) score -= 3;
            }
            if (ADULT.has(age) && t < 17 * 60) score -= 4;
            if (prime && headliner) score += 2;

            // VIP screens favour the strongest films
            if (ctx.vip) score += (state.strength.get(film.movie_id) - 6) * 0.5;

            // Late slots prefer shorter films
            if (t >= 21 * 60 && runtime > 150) score -= 2;

            // Deterministic tie-break (stable across runs)
            score -= (film.movie_id % 97) * 0.0001;

            if (!best || score > best.score) best = { film, score, fromReserve: pool === state.reserve };
        }
        }

        if (!best) {
            // Nothing fits before the next existing show: continue after it
            const next = ctx.blocks.find(b => b.start > t);
            if (!next) {
                ctx.done = true;
                continue;
            }
            ctx.previous = next.movieId;
            ctx.t = roundUp(next.end + opts.turnaround, opts.roundTo);
            continue;
        }

        const runtime = Number(best.film.runtime_minutes);
        ctx.plan.push({ film: best.film, start: t, end: t + runtime });

        // A film brought in to fill a gap joins today's slate, so it also
        // gets its two or three screens rather than a single show
        if (best.fromReserve) {
            films.push(best.film);
            state.reserve = state.reserve.filter(f => f !== best.film);
        }

        state.today.set(best.film.movie_id, (state.today.get(best.film.movie_id) || 0) + 1);
        if (!state.onScreen.has(best.film.movie_id)) state.onScreen.set(best.film.movie_id, new Set());
        state.onScreen.get(best.film.movie_id).add(ctx.screenId);
        if (!otherStarts.has(best.film.movie_id)) otherStarts.set(best.film.movie_id, []);
        otherStarts.get(best.film.movie_id).push(t);

        ctx.previous = best.film.movie_id;
        ctx.t = roundUp(t + runtime + opts.turnaround, opts.roundTo);
    }

    return new Map(ctxs.map(c => [c.screenId, c.plan]));
}


/**
 * Generate showtimes.
 *
 * @param {object}  options
 * @param {number}  [options.days=14]       how many days from today (today included)
 * @param {number}  [options.cinemaId]      limit to one cinema
 * @param {boolean} [options.dryRun=false]  plan only, write nothing
 * @param {boolean} [options.includeUpcoming=true]
 * @returns {Promise<{ from, to, created, skipped, dryRun, days: Array }>}
 */
async function generateShowtimes(options = {}) {

    // Each cinema is programmed on its own: a film's "two or three
    // screens" are counted within one building, and rotation follows
    // what that cinema showed. With no cinemaId, run every active
    // cinema in turn and merge the reports.
    if (!options.cinemaId) {

        const cinemas = await pool.query(
            `SELECT cinema_id FROM cinemas WHERE is_active = 'Y' ORDER BY cinema_id`
        );

        if (cinemas.rows.length > 1) {

            const merged = { from: null, to: null, dryRun: !!options.dryRun, films: 0, screens: 0, created: 0, removed: 0, skipped: 0, days: [], cinemas: [], specials: [] };
            const byDate = new Map();

            for (const c of cinemas.rows) {
                const r = await generateForCinema({ ...options, cinemaId: Number(c.cinema_id) });
                merged.from = r.from;
                merged.to = r.to;
                merged.films = Math.max(merged.films, r.films);
                merged.screens += r.screens;
                merged.created += r.created;
                merged.removed += r.removed;
                merged.skipped += r.skipped;
                merged.specials.push(...(r.specials || []));
                merged.cinemas.push({ cinemaId: Number(c.cinema_id), created: r.created, screens: r.screens });
                for (const d of r.days) {
                    if (!byDate.has(d.date)) {
                        byDate.set(d.date, { date: d.date, screens: [] });
                        merged.days.push(byDate.get(d.date));
                    }
                    byDate.get(d.date).screens.push(...d.screens);
                }
            }

            return merged;
        }
    }

    return generateForCinema(options);
}


async function generateForCinema(options = {}) {

    const opts = { ...DEFAULTS, ...options };
    const days = Math.max(1, Math.min(60, Number(opts.days) || DEFAULTS.days));

    // Bring film statuses up to date first (new releases, ended runs)
    await refreshMovieStatuses();

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        // One generator at a time (e.g. cron + a manual run)
        await client.query("SELECT pg_advisory_xact_lock(hashtext('savannah_showtime_generator'))");

        // The database's clock defines "today" and "now", the same clock
        // bookings and the seat map compare against.
        const clock = await client.query(
            `SELECT CURRENT_DATE::text AS today, to_char(LOCALTIMESTAMP, 'HH24:MI') AS now`
        );
        const today = clock.rows[0].today;
        const nowMinutes = minutesOf(clock.rows[0].now);
        const lastDate = addDays(today, days - 1);

        // Rebuild: clear future, never-booked showtimes in the window
        let removed = 0;
        if (opts.rebuild) {
            const del = await client.query(
                `
                DELETE FROM showtimes st
                WHERE st.show_date BETWEEN $1::date AND $2::date
                  AND st.start_time > LOCALTIMESTAMP + make_interval(mins => $3::int)
                  AND ($4::bigint IS NULL OR st.cinema_id = $4::bigint)
                  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.showtime_id = st.showtime_id)
                `,
                [today, lastDate, opts.leadTimeToday, opts.cinemaId || null]
            );
            removed = del.rowCount;
        }

        // Generated shows outside their film's run (an old film whose
        // run was cut, an upcoming film before its release date) come
        // off sale unless booked. Specials and hand-made shows stay.
        await client.query('SAVEPOINT prune');
        try {
            const pruned = await client.query(
                `SELECT prune_showtimes_outside_run($1::bigint, $2::int) AS n`,
                [opts.cinemaId || null, opts.leadTimeToday]
            );
            removed += Number(pruned.rows[0].n) || 0;
            await client.query('RELEASE SAVEPOINT prune');
        } catch (error) {
            await client.query('ROLLBACK TO SAVEPOINT prune');
            if (error.code !== '42883') throw error;   // migration not run yet
        }

        // Screens to programme
        const screensResult = await client.query(
            `
            SELECT s.screen_id, s.cinema_id, s.screen_name, s.screen_number, s.screen_type
            FROM screens s
            JOIN cinemas c ON c.cinema_id = s.cinema_id
            WHERE s.is_active = 'Y'
              AND c.is_active = 'Y'
              AND ($1::bigint IS NULL OR s.cinema_id = $1::bigint)
            ORDER BY s.cinema_id, s.screen_number
            `,
            [opts.cinemaId || null]
        );
        const screens = screensResult.rows;

        // Films whose run overlaps the window. Each day below keeps only
        // the films whose run covers that day.
        let allFilms;
        let byRun = true;

        try {

            await client.query('SAVEPOINT films');

            const filmsResult = await client.query(
                `
                SELECT movie_id, title, runtime_minutes, age_rating, rating, release_date, status,
                       movie_run_end(release_date, run_ends_on)::text AS run_end
                FROM movies
                WHERE runtime_minutes IS NOT NULL
                  AND runtime_minutes > 0
                  AND status <> 'ARCHIVED'
                  AND release_date IS NOT NULL
                  AND release_date <= $1::date
                  AND movie_run_end(release_date, run_ends_on) >= $2::date
                  AND ($3::boolean OR release_date <= $2::date)
                ORDER BY movie_id
                `,
                [lastDate, today, !!opts.includeUpcoming]
            );

            allFilms = filmsResult.rows;
            await client.query('RELEASE SAVEPOINT films');

        } catch (error) {

            if (error.code !== '42883' && error.code !== '42703') throw error;

            // Run-length migration not installed: fall back to status
            await client.query('ROLLBACK TO SAVEPOINT films');
            byRun = false;

            const filmsResult = await client.query(
                `
                SELECT movie_id, title, runtime_minutes, age_rating, rating, release_date, status
                FROM movies
                WHERE runtime_minutes IS NOT NULL
                  AND runtime_minutes > 0
                  AND (
                        status = 'NOW_SHOWING'
                     OR ($2::boolean AND status = 'UPCOMING'
                         AND release_date IS NOT NULL
                         AND release_date <= $1::date)
                  )
                ORDER BY movie_id
                `,
                [lastDate, !!opts.includeUpcoming]
            );

            allFilms = filmsResult.rows;

        }

        // Base prices: cinema/screen rows from ticket_prices
        const pricesResult = await client.query(
            `
            SELECT cinema_id, screen_id, ticket_type, amount, day_type
            FROM ticket_prices
            WHERE is_active = 'Y'
            `
        );

        const priceFor = (screen, date) => {
            const dayType = isoDow(date) >= 6 ? 'WEEKEND' : 'WEEKDAY';
            const vip = String(screen.screen_type || '').toUpperCase() === 'VIP';
            const want = vip ? 'VIP' : 'ADULT';
            const rows = pricesResult.rows.filter(p =>
                Number(p.cinema_id) === Number(screen.cinema_id) &&
                (p.screen_id == null || Number(p.screen_id) === Number(screen.screen_id)) &&
                (p.day_type == null || p.day_type === dayType)
            );
            // Most specific first: screen-level, then exact day type
            rows.sort((a, b) =>
                (b.screen_id != null) - (a.screen_id != null) ||
                (b.day_type != null) - (a.day_type != null)
            );
            const hit = rows.find(p => p.ticket_type === want) || rows.find(p => p.ticket_type === 'ADULT');
            return hit ? Number(hit.amount) : (vip ? 100 : 60);
        };

        // Special nights first (Throwback Thursday, Bargain Tuesday...):
        // older catalogue films on a fixed slot; regular shows fit around them.
        const specials = await planSpecials(client, {
            today,
            lastDate,
            nowMinutes,
            leadTimeToday: opts.leadTimeToday,
            cinemaId: opts.cinemaId || null,
            screens,
            priceFor,
            dryRun: !!opts.dryRun
        });

        // Existing programme in the window (left untouched; new shows fit around it)
        const existingResult = await client.query(
            `
            SELECT screen_id, show_date::text AS show_date, movie_id,
                   to_char(start_time, 'YYYY-MM-DD HH24:MI') AS start_ts,
                   to_char(COALESCE(end_time, start_time), 'YYYY-MM-DD HH24:MI') AS end_ts
            FROM showtimes
            WHERE is_active = 'Y'
              AND status <> 'CANCELLED'
              AND show_date BETWEEN $1::date AND $2::date
              AND ($3::bigint IS NULL OR cinema_id = $3::bigint)
            `,
            [today, lastDate, opts.cinemaId || null]
        );
        // screen|date -> [{ start, end, movieId }] (minutes since that date's midnight)
        const busyByKey = new Map();
        for (const r of existingResult.rows) {
            const key = `${r.screen_id}|${r.show_date}`;
            const start = minutesOf(r.start_ts) + (r.start_ts.slice(0, 10) > r.show_date ? 1440 : 0);
            const endDay = r.end_ts.slice(0, 10);
            const end = minutesOf(r.end_ts) + (endDay > r.show_date ? 1440 : 0);
            if (!busyByKey.has(key)) busyByKey.set(key, []);
            busyByKey.get(key).push({ start, end, movieId: Number(r.movie_id) });
        }

        // Rotation memory: when each film was last on screen (last 7 days + window)
        const historyResult = await client.query(
            `
            SELECT movie_id, MAX(show_date)::text AS last_date
            FROM showtimes
            WHERE is_active = 'Y'
              AND status <> 'CANCELLED'
              AND show_date BETWEEN ($1::date - 7) AND ($1::date - 1)
              AND ($2::bigint IS NULL OR cinema_id = $2::bigint)
            GROUP BY movie_id
            `,
            [today, opts.cinemaId || null]
        );

        // State shared across days so rotation works over the fortnight
        const lastShown = new Map();
        for (const r of historyResult.rows) {
            const diff = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(r.last_date + 'T00:00:00Z')) / 86400000);
            lastShown.set(Number(r.movie_id), -diff);
        }
        for (const r of existingResult.rows) {
            const idx = Math.round((Date.parse(r.show_date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
            const prev = lastShown.get(Number(r.movie_id));
            if (prev == null || idx > prev) lastShown.set(Number(r.movie_id), idx);
        }

        const report = [];
        let created = 0;
        let skipped = 0;

        for (let dayIndex = 0; dayIndex < days; dayIndex++) {

            const date = addDays(today, dayIndex);
            const weekend = isoDow(date) >= 6;

            const films = allFilms.filter(f =>
                byRun
                    ? dateOf(f.release_date) <= date && date <= f.run_end
                    : f.status === 'NOW_SHOWING' || (f.release_date && dateOf(f.release_date) <= date)
            );

            const strength = new Map(films.map(f => [f.movie_id, filmStrength(f, date)]));

            // ---- Today's slate ----
            const screenCount = screens.length;
            // Free slots today, roughly: 6 a screen, minus what's already on
            const existingToday = screens.reduce((n, s) => n + (busyByKey.get(`${s.screen_id}|${date}`) || []).length, 0);
            const slotsEstimate = Math.max(1, screenCount * 6 - existingToday);
            const byStrength = [...films].sort((a, b) => strength.get(b.movie_id) - strength.get(a.movie_id) || a.movie_id - b.movie_id);
            const headliners = byStrength.slice(0, Math.min(2, films.length));

            // How many screens each film gets today: headliners 3, the rest
            // 2 or 3 (varies by film and day), never more than there are screens
            const target = new Map();
            const screensFor = f => {
                const want = headliners.includes(f) ? 3 : ((Number(f.movie_id) * 7 + dayIndex * 3) % 3 === 0 ? 3 : 2);
                return Math.max(1, Math.min(want, screenCount));
            };

            const daysSince = f => {
                const d = lastShown.get(f.movie_id);
                return d == null ? 99 : dayIndex - d;
            };
            const rest = byStrength
                .slice(headliners.length)
                .sort((a, b) => daysSince(b) - daysSince(a) || strength.get(b.movie_id) - strength.get(a.movie_id) || a.movie_id - b.movie_id);

            // Take films until their screen targets cover the day's slots
            const slate = [...headliners];
            let covered = headliners.reduce((n, f) => n + screensFor(f), 0);
            for (const f of rest) {
                if (covered >= slotsEstimate) break;
                slate.push(f);
                covered += screensFor(f);
            }
            films.forEach(f => target.set(f.movie_id, screensFor(f)));

            const state = {
                dayIndex,
                lastShown,
                today: new Map(),
                strength,
                headliners: new Set(headliners.map(f => f.movie_id)),
                target,
                screenCount,
                onScreen: new Map(),
                reserve: films.filter(f => !slate.includes(f))
            };

            // Starts per film across screens today (for clash avoidance)
            const otherStarts = new Map();

            // Count what's already on today
            for (const s of screens) {
                for (const b of busyByKey.get(`${s.screen_id}|${date}`) || []) {
                    state.today.set(b.movieId, (state.today.get(b.movieId) || 0) + 1);
                    if (!state.onScreen.has(b.movieId)) state.onScreen.set(b.movieId, new Set());
                    state.onScreen.get(b.movieId).add(Number(s.screen_id));
                    if (!otherStarts.has(b.movieId)) otherStarts.set(b.movieId, []);
                    otherStarts.get(b.movieId).push(b.start);
                }
            }

            const dayReport = { date, screens: [] };

            // Which screens open today, and when
            const contexts = [];
            for (const screen of screens) {

                const busy = busyByKey.get(`${screen.screen_id}|${date}`) || [];
                if (busy.length) skipped++;

                if (films.length === 0) {
                    dayReport.screens.push({ screenId: Number(screen.screen_id), screen: screen.screen_name, skipped: 'no films to show', shows: [] });
                    continue;
                }

                let open = weekend ? opts.openWeekend : opts.openWeekday;
                if (dayIndex === 0) open = Math.max(open, nowMinutes + opts.leadTimeToday);

                if (open > opts.lastStart) {
                    dayReport.screens.push({ screenId: Number(screen.screen_id), screen: screen.screen_name, skipped: 'too late today', shows: [] });
                    continue;
                }

                // Stagger screens by 10 minutes so the foyer isn't one rush
                open += (Number(screen.screen_number) - 1) % 3 * 10;

                contexts.push({ screen, open, busy });
            }

            const plans = contexts.length
                ? planDay({ films: slate, contexts, lastStart: opts.lastStart, opts, state, otherStarts })
                : new Map();

            for (const { screen, busy } of contexts) {

                const plan = plans.get(Number(screen.screen_id)) || [];
                const price = priceFor(screen, date);
                const shows = [];

                for (const slot of plan) {

                    const start = stamp(date, slot.start);
                    const end = stamp(date, slot.end);

                    if (!opts.dryRun) {

                        // Same overlap rule as createShowtime
                        const conflict = await client.query(
                            `
                            SELECT 1 FROM showtimes
                            WHERE screen_id = $1
                              AND is_active = 'Y'
                              AND status NOT IN ('CANCELLED', 'COMPLETED')
                              AND start_time < $2::timestamp
                              AND COALESCE(end_time, start_time) > $3::timestamp
                            LIMIT 1
                            `,
                            [screen.screen_id, end, start]
                        );

                        if (conflict.rows.length) continue;

                        await client.query(
                            `
                            INSERT INTO showtimes (
                                movie_id, cinema_id, screen_id, show_date,
                                start_time, end_time, ticket_price,
                                status, is_active, auto_generated, created_at, updated_at
                            )
                            VALUES ($1, $2, $3, $4::date, $5::timestamp, $6::timestamp, $7,
                                    'SCHEDULED', 'Y', 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            `,
                            [slot.film.movie_id, screen.cinema_id, screen.screen_id, date, start, end, price]
                        );
                    }

                    created++;
                    lastShown.set(slot.film.movie_id, dayIndex);
                    shows.push({ time: start.slice(11, 16), movieId: Number(slot.film.movie_id), title: slot.film.title, price });
                }

                dayReport.screens.push({ screenId: Number(screen.screen_id), screen: screen.screen_name, kept: busy.length, shows });
            }

            dayReport.screens.sort((a, b) => a.screenId - b.screenId);

            report.push(dayReport);
        }

        if (opts.dryRun) await client.query('ROLLBACK');
        else await client.query('COMMIT');

        return {
            from: today,
            to: lastDate,
            dryRun: !!opts.dryRun,
            films: allFilms.length,
            screens: screens.length,
            created: created + specials.created,
            removed: removed + specials.displaced,
            specials: specials.shows,
            // screen-days that already had shows (kept, new ones fitted around them)
            skipped,
            days: report
        };

    } catch (error) {

        try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
        throw error;

    } finally {

        client.release();

    }

}


// ------------------------------------------------------------
// Optional: keep a rolling window programmed while the server runs.
// Enable with SHOWTIME_AUTOGEN=true (and optionally
// SHOWTIME_AUTOGEN_DAYS=14). Runs at start-up, then every 6 hours.
// Only empty screen/days are filled, so it never overwrites anything.
// ------------------------------------------------------------

function startAutoGeneration(logger = console) {

    if (String(process.env.SHOWTIME_AUTOGEN || '').toLowerCase() !== 'true') return null;

    const days = Number(process.env.SHOWTIME_AUTOGEN_DAYS) || DEFAULTS.days;

    const run = async () => {
        try {
            const r = await generateShowtimes({ days });
            if (r.created > 0) logger.log(`Showtimes: added ${r.created} for ${r.from} → ${r.to}`);
        } catch (e) {
            logger.error('Showtime auto-generation failed:', e.message);
        }
    };

    setTimeout(run, 5000);
    const timer = setInterval(run, 6 * 60 * 60 * 1000);
    if (timer.unref) timer.unref();
    return timer;

}


module.exports = {
    generateShowtimes,
    startAutoGeneration,
    // exported for tests
    _internal: { planDay, filmStrength, addDays, isoDow, stamp }
};
