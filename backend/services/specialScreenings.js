// ============================================================
// SPECIAL SCREENINGS: older catalogue films back on the big screen
//
// Programmes live in special_programmes
// (Development/migrations/2026-11-23_special_screenings.sql), e.g.
//   THROWBACK_THURSDAY  Thursdays 19:30, 30% off
//   BARGAIN_TUESDAY     Tuesdays 13:00 and 18:00, half price
//
// The showtime generator calls planSpecials() before it fills the
// regular programme, so regular shows are fitted around the specials.
// For each programme day in the window, each cinema gets the
// programme's start times on one screen (its largest standard screen
// that's free). The film is the same at every cinema that night and
// comes from the catalogue: films whose run has ENDED, not shown as a
// special in the last 8 weeks, older films first for programmes with
// min_age_years, then by rating. Unbooked regular shows in the way are
// moved aside; a show with bookings is never touched.
//
// A special's discount applies to every seat type at booking time
// (bookingController, pricingController use discountFor()).
// Everything copes with the migration not being run yet.
// ============================================================

const pool = require('../config/database');

const MISSING = new Set(['42P01', '42703']);
const TURNAROUND = 25;   // minutes to clear the room afterwards
const COOLDOWN_DAYS = 56;

function minutesOf(hhmm) {
    const m = String(hhmm).match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function addDays(isoDate, n) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function isoDow(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return day === 0 ? 7 : day;
}

function stamp(isoDate, minutes) {
    const dayOffset = Math.floor(minutes / 1440);
    const mins = ((minutes % 1440) + 1440) % 1440;
    const date = dayOffset ? addDays(isoDate, dayOffset) : isoDate;
    return `${date} ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`;
}

/** Price after the programme discount, to the nearest 50 pesewas. */
function discounted(amount, percent) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    return Math.round(Number(amount) * (1 - p / 100) * 2) / 2;
}

/** Small stable hash so picks vary by date but repeat on re-runs. */
function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967295;
}

async function loadProgrammes(db = pool) {
    try {
        const r = await db.query(
            `SELECT code, name, tagline, weekday, start_times, discount_percent, min_age_years, sort_order
             FROM special_programmes WHERE is_active = 'Y' ORDER BY sort_order, code`
        );
        return r.rows.map(p => ({
            code: p.code,
            name: p.name,
            tagline: p.tagline,
            weekday: Number(p.weekday),
            times: String(p.start_times || '').split(',').map(t => minutesOf(t.trim())).filter(t => t != null).sort((a, b) => a - b),
            discountPercent: Number(p.discount_percent) || 0,
            minAgeYears: Number(p.min_age_years) || 0
        }));
    } catch (error) {
        if (MISSING.has(error.code)) return null;
        throw error;
    }
}

/** { code, name, discountPercent } for a showtime, or null. */
async function discountFor(db, showtimeId) {
    try {
        const r = await db.query(
            `SELECT ss.programme_code, ss.discount_percent, sp.name
             FROM special_screenings ss
             LEFT JOIN special_programmes sp ON sp.code = ss.programme_code
             WHERE ss.showtime_id = $1`,
            [showtimeId]
        );
        if (!r.rows.length) return null;
        return { code: r.rows[0].programme_code, name: r.rows[0].name, discountPercent: Number(r.rows[0].discount_percent) || 0 };
    } catch (error) {
        if (MISSING.has(error.code)) return null;
        throw error;
    }
}

/**
 * Programme specials for the window. Runs inside the generator's
 * transaction (client), before regular planning.
 *   ctx: { today, lastDate, nowMinutes, leadTimeToday, cinemaId, screens, priceFor, dryRun }
 */
async function planSpecials(client, ctx) {

    const result = { created: 0, displaced: 0, shows: [] };

    await client.query('SAVEPOINT specials');
    let programmes;
    try {
        programmes = await loadProgrammes(client);
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT specials');
        throw error;
    }
    if (!programmes || !programmes.length) {
        await client.query('ROLLBACK TO SAVEPOINT specials');
        return result;
    }

    // Seat counts, to put specials on the biggest standard screen
    const caps = await client.query(
        `SELECT s.screen_id, COUNT(se.seat_id)::int AS seats
         FROM screens s LEFT JOIN seats se ON se.screen_id = s.screen_id
         WHERE ($1::bigint IS NULL OR s.cinema_id = $1::bigint)
         GROUP BY s.screen_id`,
        [ctx.cinemaId || null]
    );
    const seatsOf = new Map(caps.rows.map(r => [Number(r.screen_id), r.seats]));

    const byCinema = new Map();
    for (const s of ctx.screens) {
        const id = Number(s.cinema_id);
        if (!byCinema.has(id)) byCinema.set(id, []);
        byCinema.get(id).push(s);
    }
    for (const list of byCinema.values()) {
        list.sort((a, b) =>
            (String(a.screen_type).toUpperCase() === 'VIP') - (String(b.screen_type).toUpperCase() === 'VIP') ||
            (seatsOf.get(Number(b.screen_id)) || 0) - (seatsOf.get(Number(a.screen_id)) || 0) ||
            Number(a.screen_number) - Number(b.screen_number)
        );
    }

    // Candidate films: run ended, has a runtime and a poster
    const filmsResult = await client.query(
        `SELECT movie_id, title, runtime_minutes, rating, release_date::text AS release_date
         FROM movies
         WHERE status = 'ENDED'
           AND runtime_minutes > 0
           AND COALESCE(poster_url, '') <> ''
         ORDER BY movie_id`
    );
    const films = filmsResult.rows.map(f => ({ ...f, movie_id: Number(f.movie_id), runtime_minutes: Number(f.runtime_minutes) }));
    if (!films.length) {
        await client.query('RELEASE SAVEPOINT specials');
        return result;
    }

    // Specials already programmed (window + cool-down history)
    const pastResult = await client.query(
        `SELECT ss.programme_code, st.cinema_id, st.show_date::text AS show_date, st.movie_id
         FROM special_screenings ss
         JOIN showtimes st ON st.showtime_id = ss.showtime_id
         WHERE st.show_date BETWEEN ($1::date - $3::int) AND $2::date
           AND st.is_active = 'Y' AND st.status <> 'CANCELLED'`,
        [ctx.today, ctx.lastDate, COOLDOWN_DAYS]
    );
    const done = new Set();          // programme|date|cinema
    const filmOf = new Map();        // programme|date -> movie_id
    const lastUsed = new Map();      // movie_id -> latest date used
    for (const r of pastResult.rows) {
        done.add(`${r.programme_code}|${r.show_date}|${Number(r.cinema_id)}`);
        filmOf.set(`${r.programme_code}|${r.show_date}`, Number(r.movie_id));
        const prev = lastUsed.get(Number(r.movie_id));
        if (!prev || r.show_date > prev) lastUsed.set(Number(r.movie_id), r.show_date);
    }

    const pickFilm = (programme, date) => {
        const key = `${programme.code}|${date}`;
        if (filmOf.has(key)) return films.find(f => f.movie_id === filmOf.get(key)) || null;

        const cutoff = addDays(date, -COOLDOWN_DAYS);
        const takenThatDay = new Set([...filmOf.entries()].filter(([k]) => k.endsWith(`|${date}`)).map(([, v]) => v));
        const fresh = films.filter(f => !takenThatDay.has(f.movie_id) && !(lastUsed.get(f.movie_id) > cutoff));
        let pool2 = fresh.length ? fresh : films.filter(f => !takenThatDay.has(f.movie_id));
        if (programme.minAgeYears > 0) {
            const before = addDays(date, -365 * programme.minAgeYears);
            const old = pool2.filter(f => f.release_date && f.release_date <= before);
            if (old.length) pool2 = old;
        }
        if (!pool2.length) return null;

        const scored = pool2
            .map(f => ({ f, s: (Number(f.rating) || 6) / 10 + hash(`${programme.code}|${date}|${f.movie_id}`) * 0.6 }))
            .sort((a, b) => b.s - a.s);
        const film = scored[0].f;
        filmOf.set(key, film.movie_id);
        lastUsed.set(film.movie_id, date);
        return film;
    };

    for (let date = ctx.today; date <= ctx.lastDate; date = addDays(date, 1)) {

        const dow = isoDow(date);

        for (const programme of programmes) {

            if (programme.weekday !== dow || !programme.times.length) continue;

            for (const [cinemaId, cinemaScreens] of byCinema) {

                const doneKey = `${programme.code}|${date}|${cinemaId}`;
                if (done.has(doneKey)) continue;

                const film = pickFilm(programme, date);
                if (!film) continue;
                const length = film.runtime_minutes + 15; // trailers

                // All of this programme's shows that day go on one screen
                for (const screen of cinemaScreens) {

                    const slots = programme.times
                        .filter(t => date > ctx.today || t >= ctx.nowMinutes + (ctx.leadTimeToday || 45))
                        .map(t => ({ start: stamp(date, t), end: stamp(date, t + length + TURNAROUND) }));
                    if (!slots.length) break;

                    // Anything in the way? Shows with bookings can't be moved.
                    let blockedByBooking = false;
                    const inTheWay = [];
                    for (const slot of slots) {
                        const r = await client.query(
                            `SELECT st.showtime_id,
                                    EXISTS (SELECT 1 FROM bookings b WHERE b.showtime_id = st.showtime_id) AS booked
                             FROM showtimes st
                             WHERE st.screen_id = $1
                               AND st.is_active = 'Y'
                               AND st.status NOT IN ('CANCELLED', 'COMPLETED')
                               AND st.start_time < $2::timestamp
                               AND COALESCE(st.end_time, st.start_time) + make_interval(mins => $4::int) > $3::timestamp`,
                            [screen.screen_id, slot.end, slot.start, TURNAROUND]
                        );
                        for (const row of r.rows) {
                            if (row.booked) blockedByBooking = true;
                            else inTheWay.push(Number(row.showtime_id));
                        }
                    }
                    if (blockedByBooking) continue; // try the next screen

                    if (!ctx.dryRun) {
                        if (inTheWay.length) {
                            await client.query(`DELETE FROM showtimes WHERE showtime_id = ANY($1::bigint[])`, [inTheWay]);
                        }
                        const price = discounted(ctx.priceFor(screen, date), programme.discountPercent);
                        for (const slot of slots) {
                            const ins = await client.query(
                                `INSERT INTO showtimes (movie_id, cinema_id, screen_id, show_date, start_time, ticket_price,
                                                        status, is_active, created_at, updated_at)
                                 VALUES ($1, $2, $3, $4::date, $5::timestamp, $6, 'SCHEDULED', 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                 RETURNING showtime_id`,
                                [film.movie_id, cinemaId, screen.screen_id, date, slot.start, price]
                            );
                            await client.query(
                                `INSERT INTO special_screenings (showtime_id, programme_code, discount_percent)
                                 VALUES ($1, $2, $3)`,
                                [ins.rows[0].showtime_id, programme.code, programme.discountPercent]
                            );
                        }
                    }

                    result.displaced += new Set(inTheWay).size;
                    result.created += slots.length;
                    result.shows.push({
                        programme: programme.code,
                        date,
                        cinemaId,
                        screen: screen.screen_name,
                        movieId: film.movie_id,
                        title: film.title,
                        times: slots.map(s => s.start.slice(11, 16))
                    });
                    done.add(doneKey);
                    break;
                }
            }
        }
    }

    await client.query('RELEASE SAVEPOINT specials');
    return result;
}

/**
 * Upcoming specials for the app: programmes and their screenings
 * (film, cinema, times, discount) from today on.
 */
async function upcoming({ days = 21 } = {}) {
    const programmes = await loadProgrammes();
    if (!programmes) return { programmes: [], screenings: [] };

    const r = await pool.query(
        `SELECT ss.showtime_id, ss.programme_code, ss.discount_percent,
                st.cinema_id, c.cinema_name, st.screen_id, sc.screen_name,
                st.show_date::text AS show_date,
                to_char(st.start_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS start_time,
                st.ticket_price,
                m.movie_id, m.title, m.poster_url, m.backdrop_url, m.runtime_minutes, m.age_rating,
                m.rating, m.release_date::text AS release_date
         FROM special_screenings ss
         JOIN showtimes st ON st.showtime_id = ss.showtime_id
         JOIN movies m ON m.movie_id = st.movie_id
         JOIN cinemas c ON c.cinema_id = st.cinema_id
         JOIN screens sc ON sc.screen_id = st.screen_id
         WHERE st.is_active = 'Y'
           AND st.status IN ('SCHEDULED', 'NOW_SHOWING')
           AND st.start_time > LOCALTIMESTAMP
           AND st.show_date <= CURRENT_DATE + $1::int
         ORDER BY st.start_time`,
        [days]
    );

    return {
        programmes: programmes.map(p => ({
            code: p.code,
            name: p.name,
            tagline: p.tagline,
            weekday: p.weekday,
            times: p.times.map(t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`),
            discountPercent: p.discountPercent
        })),
        screenings: r.rows.map(x => ({
            showtimeId: Number(x.showtime_id),
            programme: x.programme_code,
            discountPercent: Number(x.discount_percent),
            cinemaId: Number(x.cinema_id),
            cinemaName: x.cinema_name,
            screenName: x.screen_name,
            showDate: x.show_date,
            startTime: x.start_time,
            ticketPrice: Number(x.ticket_price),
            movie: {
                movieId: Number(x.movie_id),
                title: x.title,
                posterUrl: x.poster_url,
                backdropUrl: x.backdrop_url,
                runtimeMinutes: x.runtime_minutes,
                ageRating: x.age_rating,
                rating: x.rating,
                releaseDate: x.release_date
            }
        }))
    };
}

module.exports = { planSpecials, discountFor, discounted, upcoming, loadProgrammes };
