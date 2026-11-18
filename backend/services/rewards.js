// ============================================================
// SAVANNAH CINEMAS - REWARDS
// services/rewards.js
//
// Savannah Rewards (points) and Savannah Trophies.
//
// POINTS are worked out from the member's history every time, never
// stored as a running total, so they can't drift: cancel a booking and
// the points it earned disappear and any points spent on it come back.
//   Create account          100
//   Joined with a friend's code 100   (welcome bonus)
//   Complete profile         50   (names, phone, date of birth)
//   Each ticket              10
//   Each snack                5
//   Each review              50
//   First booking           100
//   Friend's first booking  250   (to the member who referred them)
//   Birthday booking        300   (show within 3 days of your birthday, once a year)
//   3 films in a month      250   (calendar month of the show)
//   5 films in a month      500
// Spending: 100 points = GHS 2, in steps of 100, up to half a booking.
//
// TROPHIES are checked after every payment (and when the member opens
// Rewards) and saved once earned (user_trophies), so they're kept even
// if a later booking is cancelled.
//
// A "screening" is a paid booking (CONFIRMED or COMPLETED), counted
// as soon as it's paid. Times are local cinema time.
// ============================================================

const pool = require('../config/database');

const RULES = {
    WELCOME: 100,
    REFERRED_WELCOME: 100,
    PROFILE: 50,
    TICKET: 10,
    SNACK: 5,
    REVIEW: 50,
    FIRST_BOOKING: 100,
    REFERRER: 250,
    BIRTHDAY: 300,
    MONTH_3: 250,
    MONTH_5: 500
};

const VALUE = {
    pointsPerStep: 100,
    ghsPerStep: Number(process.env.REWARDS_GHS_PER_100) || 2,
    maxShare: 0.5
};

// Genre families (TMDB names and the seed data's names)
const G = {
    action: ['Action', 'Superhero'],
    comedy: ['Comedy', 'Black Comedy', 'Romantic Comedy', 'Mockumentary'],
    horror: ['Horror'],
    romance: ['Romance', 'Romantic Comedy'],
    scifi: ['Science Fiction', 'Sci-Fi', 'Space Opera', 'Cyberpunk'],
    mystery: ['Mystery', 'Thriller', 'Neo-Noir'],
    drama: ['Drama', 'Teen Drama'],
    animation: ['Animation'],
    family: ['Family', 'Animation']
};
const COLLECTOR_GENRES = ['action', 'comedy', 'horror', 'romance', 'scifi', 'mystery', 'drama', 'animation'];

const MARVEL = /\b(marvel|avengers|spider-man|iron man|thor|captain america|captain marvel|black panther|guardians of the galaxy|doctor strange|ant-man|x-men|deadpool|wolverine|fantastic four|venom|thunderbolts|eternals|shang-chi|black widow|blade)\b/i;
const DC = /\b(dc|batman|superman|supergirl|wonder woman|aquaman|the flash|joker|shazam|justice league|black adam|blue beetle|suicide squad|peacemaker|green lantern|lanterns|clayface)\b/i;
const GHANA_LANGS = new Set(['tw', 'ak', 'ee', 'gaa']);
const FAMILY_RATINGS = new Set(['G', 'U', 'PG', 'TV-G', 'TV-Y', 'TV-Y7']);


// ------------------------------------------------------------
// Trophy catalogue
// ------------------------------------------------------------

const TROPHIES = [
    // Milestones
    { code: 'FIRST_SCREENING', name: 'First Screening', group: 'Milestones', target: 1, description: 'Book your first film.' },
    { code: 'MOVIE_BUFF', name: 'Movie Buff', group: 'Milestones', target: 5, description: 'Watch 5 films.' },
    { code: 'FILM_ENTHUSIAST', name: 'Film Enthusiast', group: 'Milestones', target: 10, description: 'Watch 10 films.' },
    { code: 'CINEMA_REGULAR', name: 'Cinema Regular', group: 'Milestones', target: 25, description: 'Watch 25 films.' },
    { code: 'SILVER_SCREEN_VETERAN', name: 'Silver Screen Veteran', group: 'Milestones', target: 50, description: 'Watch 50 films.' },
    { code: 'SAVANNAH_LEGEND', name: 'Savannah Legend', group: 'Milestones', target: 100, description: 'Watch 100 films.' },
    // Genres
    { code: 'ACTION_HERO', name: 'Action Hero', group: 'Genres', target: 10, description: 'Watch 10 action films.' },
    { code: 'COMEDY_KING', name: 'Comedy King', group: 'Genres', target: 10, description: 'Watch 10 comedies.' },
    { code: 'FEARLESS', name: 'Fearless', group: 'Genres', target: 10, description: 'Watch 10 horror films.' },
    { code: 'ROMANTIC', name: 'Romantic', group: 'Genres', target: 10, description: 'Watch 10 romance films.' },
    { code: 'BEYOND_EARTH', name: 'Beyond Earth', group: 'Genres', target: 10, description: 'Watch 10 sci-fi films.' },
    { code: 'DETECTIVE', name: 'Detective', group: 'Genres', target: 10, description: 'Watch 10 mysteries or thrillers.' },
    { code: 'GENRE_COLLECTOR', name: 'Genre Collector', group: 'Genres', target: COLLECTOR_GENRES.length, description: 'Watch 5 films in each genre: action, comedy, horror, romance, sci-fi, mystery/thriller, drama and animation.' },
    // Collections
    { code: 'MARVEL_COLLECTOR', name: 'Marvel Collector', group: 'Collections', target: 5, description: 'Watch 5 different Marvel films.' },
    { code: 'DC_COLLECTOR', name: 'DC Collector', group: 'Collections', target: 5, description: 'Watch 5 different DC films.' },
    { code: 'FRANCHISE_FAN', name: 'Franchise Fan', group: 'Collections', target: 3, description: 'Watch 3 films from the same franchise.' },
    // Habits
    { code: 'WEEKEND_WARRIOR', name: 'Weekend Warrior', group: 'Habits', target: 3, description: 'See a film 3 weekends in a row.' },
    { code: 'NIGHT_OWL', name: 'Night Owl', group: 'Habits', target: 10, description: '10 evening screenings (from 18:00).' },
    { code: 'EARLY_BIRD', name: 'Early Bird', group: 'Habits', target: 10, description: '10 afternoon screenings (12:00 to 17:00).' },
    { code: 'CINEMA_STREAK', name: 'Cinema Streak', group: 'Habits', target: 4, description: 'See a film 4 weeks in a row.' },
    { code: 'MONTHLY_REGULAR', name: 'Monthly Regular', group: 'Habits', target: 6, description: 'At least one film a month for 6 months.' },
    // Social
    { code: 'MOVIE_BUDDY', name: 'Movie Buddy', group: 'Social', target: 5, description: 'Watch 5 films at the same screening as a friend.' },
    { code: 'DYNAMIC_DUO', name: 'Dynamic Duo', group: 'Social', target: 3, description: 'Watch 3 films with the same friend.' },
    { code: 'GROUP_SCREENING', name: 'Group Screening', group: 'Social', target: 4, description: 'Book 4 or more seats in one booking.' },
    { code: 'THE_CONNECTOR', name: 'The Connector', group: 'Social', target: 5, description: 'Refer 5 friends who complete their first booking.' },
    // Challenges (seasonal)
    { code: 'HORROR_HUNTER', name: 'Horror Hunter', group: 'Challenges', target: 3, window: '1 to 31 October', description: 'Halloween challenge: watch 3 horror films in October.' },
    { code: 'CINEMA_CUPID', name: 'Cinema Cupid', group: 'Challenges', target: 1, window: '7 to 14 February', description: 'Valentine’s challenge: book 2 seats for a film in Valentine’s week.' },
    { code: 'SANTAS_LITTLE_HELPER', name: 'Santa’s Little Helper', group: 'Challenges', target: 2, window: '1 to 26 December', description: 'Christmas challenge: watch 2 family films in December.' },
    { code: 'EASTER_EGG_HUNTER', name: 'Easter Egg Hunter', group: 'Challenges', target: 1, window: 'Good Friday to Easter Monday', description: 'Easter challenge: see a film over the Easter weekend.' },
    { code: 'MADE_IN_GHANA', name: 'Made in Ghana', group: 'Challenges', target: 2, window: '1 to 31 March (Ghana Month)', description: 'Ghana Cinema challenge: watch 2 Ghanaian films in March.' },
    // Hidden
    { code: 'AFTER_HOURS', name: 'After Hours', group: 'Hidden', hidden: true, target: 5, description: 'Attend the last screening of the day 5 times.' },
    { code: 'LAST_MAN_STANDING', name: 'Last Man Standing', group: 'Hidden', hidden: true, target: 10, description: 'Attend the last screening of the day 10 times.' },
    { code: 'MARATHONER', name: 'Marathoner', group: 'Hidden', hidden: true, target: 3, description: 'Watch 3 films in one day.' },
    { code: 'FIRST_IN_LINE', name: 'First in Line', group: 'Hidden', hidden: true, target: 5, description: 'Attend the first screening of the day 5 times.' },
    { code: 'EXPLORER', name: 'Explorer', group: 'Hidden', hidden: true, target: 1, description: 'Watch a film in every screen.' }
];


// ------------------------------------------------------------
// Date helpers (calendar dates as 'YYYY-MM-DD', no time zones)
// ------------------------------------------------------------

const iso = (d) => {
    if (!d) return null;
    if (d instanceof Date) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return String(d).slice(0, 10);
};
const dayNum = (isoDate) => Math.round(Date.parse(isoDate + 'T00:00:00Z') / 86400000);
const isoDow = (isoDate) => {
    const d = new Date(isoDate + 'T00:00:00Z').getUTCDay();
    return d === 0 ? 7 : d;
};
// Monday-based week number
const weekNum = (isoDate) => Math.floor((dayNum(isoDate) + 3) / 7);
const monthNum = (isoDate) => Number(isoDate.slice(0, 4)) * 12 + Number(isoDate.slice(5, 7)) - 1;
const minutesOf = (ts) => {
    if (ts instanceof Date) return ts.getHours() * 60 + ts.getMinutes();
    const m = String(ts).match(/(\d{2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};

function easterSunday(year) {
    // Anonymous Gregorian algorithm
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function longestRun(nums) {
    const sorted = [...new Set(nums)].sort((a, b) => a - b);
    let best = 0, run = 0, prev = null;
    for (const n of sorted) {
        run = prev !== null && n === prev + 1 ? run + 1 : 1;
        best = Math.max(best, run);
        prev = n;
    }
    return best;
}


// ------------------------------------------------------------
// Loading a member's history
// ------------------------------------------------------------

async function optional(db, sql, params, fallback) {
    // Tables/columns from later migrations may not exist yet.
    // Inside a transaction (a client), a savepoint keeps a failure from
    // aborting it; on the pool each query stands alone.
    if (db === pool) {
        try {
            return (await db.query(sql, params)).rows;
        } catch (e) {
            if (['42P01', '42703', '42883'].includes(e.code)) return fallback;
            throw e;
        }
    }
    await db.query('SAVEPOINT rw_opt');
    try {
        const r = await db.query(sql, params);
        await db.query('RELEASE SAVEPOINT rw_opt');
        return r.rows;
    } catch (e) {
        await db.query('ROLLBACK TO SAVEPOINT rw_opt');
        if (['42P01', '42703', '42883'].includes(e.code)) return fallback;
        throw e;
    }
}

async function loadHistory(db, userId) {

    const userRows = await db.query(
        `
        SELECT u.user_id, u.created_at, u.updated_at, u.forenames, u.surname, u.phone_number,
               cp.date_of_birth::text AS dob
        FROM users u
        LEFT JOIN customer_profiles cp ON cp.user_id = u.user_id
        WHERE u.user_id = $1
        `,
        [userId]
    );
    if (userRows.rows.length === 0) return null;
    const user = userRows.rows[0];

    const bookings = await optional(
        db,
        `
        SELECT
            b.booking_id, b.status, b.booking_date,
            COALESCE((to_jsonb(b) ->> 'points_redeemed')::int, 0) AS points_redeemed,
            st.showtime_id, st.cinema_id, st.screen_id,
            st.show_date::text AS show_date,
            to_char(st.start_time, 'HH24:MI') AS start_hm,
            m.movie_id, m.title, m.age_rating,
            to_jsonb(m) ->> 'collection_id' AS collection_id,
            to_jsonb(m) ->> 'collection_name' AS collection_name,
            to_jsonb(m) ->> 'production_countries' AS production_countries,
            to_jsonb(m) ->> 'original_language' AS original_language,
            sd.studio_name,
            (SELECT COUNT(*)::int FROM booking_seats bs WHERE bs.booking_id = b.booking_id) AS seats,
            (SELECT string_agg(g.genre_name, '|') FROM movie_genres mg JOIN genres g ON g.genre_id = mg.genre_id WHERE mg.movie_id = m.movie_id) AS genres,
            (SELECT MAX(p.payment_date) FROM payments p WHERE p.booking_id = b.booking_id AND p.status = 'SUCCESS') AS paid_at,
            st.start_time = (
                SELECT MIN(s2.start_time) FROM showtimes s2
                WHERE s2.cinema_id = st.cinema_id AND s2.show_date = st.show_date
                  AND s2.is_active = 'Y' AND s2.status <> 'CANCELLED'
            ) AS first_of_day,
            st.start_time = (
                SELECT MAX(s2.start_time) FROM showtimes s2
                WHERE s2.cinema_id = st.cinema_id AND s2.show_date = st.show_date
                  AND s2.is_active = 'Y' AND s2.status <> 'CANCELLED'
            ) AS last_of_day
        FROM bookings b
        JOIN showtimes st ON st.showtime_id = b.showtime_id
        JOIN movies m ON m.movie_id = st.movie_id
        LEFT JOIN studios sd ON sd.studio_id = m.studio_id
        WHERE b.user_id = $1
          AND b.status IN ('CONFIRMED', 'COMPLETED')
        ORDER BY COALESCE((SELECT MAX(p.payment_date) FROM payments p WHERE p.booking_id = b.booking_id AND p.status = 'SUCCESS'), b.booking_date), b.booking_id
        `,
        [userId],
        []
    );

    const snacks = await optional(
        db,
        `
        SELECT o.order_id, o.booking_id, o.source, COALESCE(o.paid_at, o.created_at) AS at,
               SUM(i.quantity)::int AS items
        FROM concession_orders o
        JOIN concession_order_items i ON i.order_id = o.order_id
        JOIN bookings b ON b.booking_id = o.booking_id
        WHERE o.user_id = $1
          AND b.status IN ('CONFIRMED', 'COMPLETED')
          AND ((o.source = 'BOOKING' AND o.status <> 'CANCELLED') OR (o.source = 'PREORDER' AND o.status IN ('PAID', 'COLLECTED')))
        GROUP BY o.order_id, o.booking_id, o.source, o.paid_at, o.created_at
        `,
        [userId],
        []
    );

    const reviews = await optional(
        db,
        `
        SELECT r.review_id, r.created_at, m.title
        FROM movie_reviews r
        JOIN movies m ON m.movie_id = r.movie_id
        WHERE r.user_id = $1
          AND COALESCE(r.status, '') NOT IN ('REJECTED', 'DELETED', 'HIDDEN')
        `,
        [userId],
        []
    );

    const referredBy = await optional(
        db,
        `
        SELECT r.referrer_id, r.created_at, u.forenames
        FROM referrals r JOIN users u ON u.user_id = r.referrer_id
        WHERE r.referred_id = $1
        `,
        [userId],
        []
    );

    // Friends I brought, and when (if) each first paid for a booking
    const referred = await optional(
        db,
        `
        SELECT r.referred_id, r.created_at, u.forenames,
               (SELECT MIN(p.payment_date)
                FROM bookings b JOIN payments p ON p.booking_id = b.booking_id AND p.status = 'SUCCESS'
                WHERE b.user_id = r.referred_id AND b.status IN ('CONFIRMED', 'COMPLETED')) AS first_paid_at
        FROM referrals r JOIN users u ON u.user_id = r.referred_id
        WHERE r.referrer_id = $1
        `,
        [userId],
        []
    );

    // Screenings shared with friends (anyone linked by a referral)
    const shared = await optional(
        db,
        `
        WITH friends AS (
            SELECT referred_id AS friend_id FROM referrals WHERE referrer_id = $1
            UNION
            SELECT referrer_id FROM referrals WHERE referred_id = $1
        )
        SELECT DISTINCT mine.showtime_id, theirs.user_id AS friend_id
        FROM bookings mine
        JOIN bookings theirs
          ON theirs.showtime_id = mine.showtime_id
         AND theirs.user_id IN (SELECT friend_id FROM friends)
         AND theirs.status IN ('CONFIRMED', 'COMPLETED')
        WHERE mine.user_id = $1
          AND mine.status IN ('CONFIRMED', 'COMPLETED')
        `,
        [userId],
        []
    );

    // Screens per cinema (with seats), for Explorer
    const screens = await db.query(
        `
        SELECT s.cinema_id, s.screen_id
        FROM screens s
        WHERE s.is_active = 'Y'
          AND EXISTS (SELECT 1 FROM seats se WHERE se.screen_id = s.screen_id)
        `
    );

    return { user, bookings, snacks, reviews, referredBy: referredBy[0] || null, referred, shared, screens: screens.rows };
}


// ------------------------------------------------------------
// Points
// ------------------------------------------------------------

function pointEntries(h) {

    const entries = [];
    const add = (points, reason, description, at, bookingId = null) =>
        entries.push({ points, reason, description, at: at ? new Date(at).toISOString() : null, bookingId: bookingId != null ? Number(bookingId) : null });

    const u = h.user;
    add(RULES.WELCOME, 'WELCOME', 'Welcome to Savannah Rewards', u.created_at);

    if (h.referredBy) {
        add(RULES.REFERRED_WELCOME, 'REFERRED', `Joined with ${h.referredBy.forenames}’s code`, h.referredBy.created_at);
    }

    if (u.forenames && u.surname && u.phone_number && u.dob) {
        add(RULES.PROFILE, 'PROFILE', 'Completed your profile', u.updated_at || u.created_at);
    }

    const birthdayYears = new Set();
    const perMonth = new Map();

    h.bookings.forEach((b, i) => {
        const at = b.paid_at || b.booking_date;
        const seats = Number(b.seats) || 1;
        add(RULES.TICKET * seats, 'TICKETS', `${seats} ${seats === 1 ? 'ticket' : 'tickets'}: ${b.title}`, at, b.booking_id);

        if (i === 0) add(RULES.FIRST_BOOKING, 'FIRST_BOOKING', 'Your first booking', at, b.booking_id);

        // Birthday: show within 3 days of the birthday, once a year
        if (u.dob) {
            const year = Number(b.show_date.slice(0, 4));
            const near = [year - 1, year, year + 1].some(y => {
                const d = `${y}-${u.dob.slice(5, 10)}`;
                return Math.abs(dayNum(b.show_date) - dayNum(d)) <= 3;
            });
            if (near && !birthdayYears.has(year)) {
                birthdayYears.add(year);
                add(RULES.BIRTHDAY, 'BIRTHDAY', `Birthday booking: ${b.title}`, at, b.booking_id);
            }
        }

        // Films per calendar month of the show
        const key = b.show_date.slice(0, 7);
        const n = (perMonth.get(key) || 0) + 1;
        perMonth.set(key, n);
        const monthName = new Date(b.show_date + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        if (n === 3) add(RULES.MONTH_3, 'MONTH_3', `3 films in ${monthName}`, at, b.booking_id);
        if (n === 5) add(RULES.MONTH_5, 'MONTH_5', `5 films in ${monthName}`, at, b.booking_id);

        if (Number(b.points_redeemed) > 0) {
            add(-Number(b.points_redeemed), 'REDEEMED', `Used for a discount: ${b.title}`, at, b.booking_id);
        }
    });

    for (const s of h.snacks) {
        add(RULES.SNACK * Number(s.items), 'SNACKS', `${s.items} ${Number(s.items) === 1 ? 'snack' : 'snacks'}`, s.at, s.booking_id);
    }

    for (const r of h.reviews) {
        add(RULES.REVIEW, 'REVIEW', `Reviewed ${r.title}`, r.created_at);
    }

    for (const f of h.referred) {
        if (f.first_paid_at) add(RULES.REFERRER, 'REFERRAL', `${f.forenames} made their first booking`, f.first_paid_at);
    }

    entries.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return entries;
}


// ------------------------------------------------------------
// Trophy progress
// ------------------------------------------------------------

function trophyProgress(h) {

    const B = h.bookings;
    const genresOf = (b) => new Set(String(b.genres || '').split('|').filter(Boolean));
    const inFamily = (b, fam) => {
        const gs = genresOf(b);
        return G[fam].some(g => gs.has(g));
    };
    const count = (pred) => B.filter(pred).length;
    const distinctFilms = (pred) => new Set(B.filter(pred).map(b => Number(b.movie_id))).size;
    const p = {};

    // Milestones
    const films = B.length;
    ['FIRST_SCREENING', 'MOVIE_BUFF', 'FILM_ENTHUSIAST', 'CINEMA_REGULAR', 'SILVER_SCREEN_VETERAN', 'SAVANNAH_LEGEND'].forEach(c => (p[c] = films));

    // Genres
    p.ACTION_HERO = count(b => inFamily(b, 'action'));
    p.COMEDY_KING = count(b => inFamily(b, 'comedy'));
    p.FEARLESS = count(b => inFamily(b, 'horror'));
    p.ROMANTIC = count(b => inFamily(b, 'romance'));
    p.BEYOND_EARTH = count(b => inFamily(b, 'scifi'));
    p.DETECTIVE = count(b => inFamily(b, 'mystery'));
    p.GENRE_COLLECTOR = COLLECTOR_GENRES.filter(fam => count(b => inFamily(b, fam)) >= 5).length;

    // Collections
    const isMarvel = (b) => /marvel/i.test(`${b.studio_name || ''} ${b.collection_name || ''}`) || MARVEL.test(b.title);
    const isDC = (b) => /\bDC\b/.test(`${b.studio_name || ''} ${b.collection_name || ''}`) || DC.test(b.title);
    p.MARVEL_COLLECTOR = distinctFilms(isMarvel);
    p.DC_COLLECTOR = distinctFilms(isDC);
    const byCollection = new Map();
    B.filter(b => b.collection_id).forEach(b => {
        if (!byCollection.has(b.collection_id)) byCollection.set(b.collection_id, new Set());
        byCollection.get(b.collection_id).add(Number(b.movie_id));
    });
    p.FRANCHISE_FAN = Math.max(0, ...[...byCollection.values()].map(s => s.size));

    // Habits
    const weekendWeeks = B.filter(b => isoDow(b.show_date) >= 6).map(b => weekNum(b.show_date));
    p.WEEKEND_WARRIOR = longestRun(weekendWeeks);
    p.NIGHT_OWL = count(b => minutesOf(b.start_hm) >= 18 * 60);
    p.EARLY_BIRD = count(b => { const m = minutesOf(b.start_hm); return m >= 12 * 60 && m < 17 * 60; });
    p.CINEMA_STREAK = longestRun(B.map(b => weekNum(b.show_date)));
    p.MONTHLY_REGULAR = longestRun(B.map(b => monthNum(b.show_date)));

    // Social
    const sharedShowtimes = new Set(h.shared.map(s => Number(s.showtime_id)));
    p.MOVIE_BUDDY = sharedShowtimes.size;
    const perFriend = new Map();
    h.shared.forEach(s => perFriend.set(Number(s.friend_id), (perFriend.get(Number(s.friend_id)) || 0) + 1));
    p.DYNAMIC_DUO = Math.max(0, ...perFriend.values());
    p.GROUP_SCREENING = Math.max(0, ...B.map(b => Number(b.seats) || 0));
    p.THE_CONNECTOR = h.referred.filter(f => f.first_paid_at).length;

    // Challenges: best single year
    const byYear = (pred) => {
        const m = new Map();
        B.filter(pred).forEach(b => {
            const y = b.show_date.slice(0, 4);
            m.set(y, (m.get(y) || 0) + 1);
        });
        return Math.max(0, ...m.values());
    };
    const md = (b) => b.show_date.slice(5, 10);
    p.HORROR_HUNTER = byYear(b => md(b).startsWith('10-') && inFamily(b, 'horror'));
    p.CINEMA_CUPID = count(b => md(b) >= '02-07' && md(b) <= '02-14' && Number(b.seats) >= 2) > 0 ? 1 : 0;
    p.SANTAS_LITTLE_HELPER = byYear(b =>
        md(b) >= '12-01' && md(b) <= '12-26' &&
        (FAMILY_RATINGS.has(String(b.age_rating || '').toUpperCase()) || inFamily(b, 'family')));
    p.EASTER_EGG_HUNTER = count(b => {
        const easter = dayNum(easterSunday(Number(b.show_date.slice(0, 4))));
        const d = dayNum(b.show_date);
        return d >= easter - 2 && d <= easter + 1;
    }) > 0 ? 1 : 0;
    const ghanaian = (b) =>
        /\bGH\b/.test(String(b.production_countries || '')) || GHANA_LANGS.has(String(b.original_language || '').toLowerCase());
    p.MADE_IN_GHANA = byYear(b => md(b).startsWith('03-') && ghanaian(b));

    // Hidden
    p.AFTER_HOURS = count(b => b.last_of_day);
    p.LAST_MAN_STANDING = p.AFTER_HOURS;
    const perDay = new Map();
    B.forEach(b => perDay.set(b.show_date, (perDay.get(b.show_date) || 0) + 1));
    p.MARATHONER = Math.max(0, ...perDay.values());
    p.FIRST_IN_LINE = count(b => b.first_of_day);
    const screensByCinema = new Map();
    h.screens.forEach(s => {
        if (!screensByCinema.has(Number(s.cinema_id))) screensByCinema.set(Number(s.cinema_id), new Set());
        screensByCinema.get(Number(s.cinema_id)).add(Number(s.screen_id));
    });
    const visited = new Set(B.map(b => Number(b.screen_id)));
    p.EXPLORER = [...screensByCinema.values()].some(set => set.size > 0 && [...set].every(id => visited.has(id))) ? 1 : 0;

    return p;
}

function streakNow(h, today) {
    const weeks = new Set(h.bookings.map(b => weekNum(b.show_date)));
    let anchor = weekNum(today);
    if (!weeks.has(anchor)) anchor -= 1;
    let n = 0;
    while (weeks.has(anchor - n)) n++;
    return n;
}


// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

/**
 * Check a member's trophies and save any newly earned ones.
 * Returns the codes earned just now.
 */
async function awardTrophies(db, userId, h, progress, triggeringBookingId = null) {
    const due = TROPHIES.filter(t => (progress[t.code] || 0) >= t.target).map(t => t.code);
    if (due.length === 0) return [];
    const r = await optional(
        db,
        `
        INSERT INTO user_trophies (user_id, trophy_code, booking_id)
        SELECT $1, code, $3 FROM unnest($2::text[]) AS code
        ON CONFLICT (user_id, trophy_code) DO NOTHING
        RETURNING trophy_code
        `,
        [userId, due, triggeringBookingId],
        []
    );
    return r.map(x => x.trophy_code);
}

async function ensureReferralCode(db, userId, forenames) {
    const existing = await optional(db, `SELECT referral_code FROM users WHERE user_id = $1`, [userId], []);
    if (existing[0] && existing[0].referral_code) return existing[0].referral_code;
    if (existing.length === 0) return null; // column missing
    const base = String(forenames || 'SAV').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'SAV';
    for (let i = 0; i < 6; i++) {
        const code = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
        const r = await optional(
            db,
            `UPDATE users SET referral_code = $2 WHERE user_id = $1 AND referral_code IS NULL RETURNING referral_code`,
            [userId, code],
            []
        ).catch(e => {
            if (e.code === '23505') return [];
            throw e;
        });
        if (r[0]) return r[0].referral_code;
        const again = await optional(db, `SELECT referral_code FROM users WHERE user_id = $1`, [userId], []);
        if (again[0] && again[0].referral_code) return again[0].referral_code;
    }
    return null;
}

/** Points balance only (for checkout). */
async function balanceOf(db, userId) {
    const h = await loadHistory(db, userId);
    if (!h) return 0;
    return Math.max(0, pointEntries(h).reduce((a, e) => a + e.points, 0));
}

/** What a member can spend on a booking of `amount` GHS. */
function quote(balance, amount) {
    const steps = Math.min(
        Math.floor(balance / VALUE.pointsPerStep),
        Math.floor((Number(amount) * VALUE.maxShare) / VALUE.ghsPerStep)
    );
    const points = Math.max(0, steps) * VALUE.pointsPerStep;
    return { points, discount: (points / VALUE.pointsPerStep) * VALUE.ghsPerStep };
}

/**
 * Everything the Rewards and Trophies tabs show. Also saves any newly
 * earned trophies (so opening the app can award them too).
 */
async function summary(userId, { db = pool, bookingId = null } = {}) {

    const h = await loadHistory(db, userId);
    if (!h) return null;

    const today = iso(new Date());
    const entries = pointEntries(h);
    const balance = entries.reduce((a, e) => a + e.points, 0);
    const progress = trophyProgress(h);
    const newly = await awardTrophies(db, userId, h, progress, bookingId);

    const earnedRows = await optional(db, `SELECT trophy_code, earned_at, seen_at FROM user_trophies WHERE user_id = $1`, [userId], []);
    const earned = new Map(earnedRows.map(r => [r.trophy_code, r]));

    const trophies = TROPHIES.map(t => {
        const e = earned.get(t.code);
        const locked = t.hidden && !e;
        return {
            code: t.code,
            name: locked ? 'Hidden trophy' : t.name,
            group: t.group,
            description: locked ? 'Keep going to discover this one.' : t.description,
            window: t.window || null,
            hidden: !!t.hidden,
            earned: !!e,
            earnedAt: e ? e.earned_at : null,
            isNew: !!e && !e.seen_at,
            progress: locked ? null : { current: Math.min(progress[t.code] || 0, t.target), target: t.target }
        };
    });

    const code = await ensureReferralCode(db, userId, h.user.forenames);

    return {
        stats: {
            trophies: trophies.filter(t => t.earned).length,
            points: Math.max(0, balance),
            movies: h.bookings.length,
            streak: streakNow(h, today)
        },
        points: {
            balance: Math.max(0, balance),
            value: VALUE,
            entries: entries.slice(0, 60),
            rules: [
                { label: 'Create an account', points: RULES.WELCOME },
                { label: 'Complete your profile', points: RULES.PROFILE },
                { label: 'Each ticket', points: RULES.TICKET },
                { label: 'Each snack', points: RULES.SNACK },
                { label: 'Write a review', points: RULES.REVIEW },
                { label: 'Your first booking', points: RULES.FIRST_BOOKING },
                { label: 'A friend you invite makes their first booking', points: RULES.REFERRER },
                { label: 'Your friend’s welcome bonus', points: RULES.REFERRED_WELCOME },
                { label: 'Birthday booking (within 3 days)', points: RULES.BIRTHDAY },
                { label: '3 films in a month', points: RULES.MONTH_3 },
                { label: '5 films in a month', points: RULES.MONTH_5 }
            ]
        },
        trophies,
        newTrophies: newly.map(c => TROPHIES.find(t => t.code === c)).filter(Boolean).map(t => ({ code: t.code, name: t.name })),
        referral: {
            code,
            invited: h.referred.length,
            booked: h.referred.filter(f => f.first_paid_at).length,
            referredBy: h.referredBy ? h.referredBy.forenames : null,
            canClaim: !h.referredBy && h.bookings.length === 0
        }
    };
}

/** Points earned by one booking (for the "you earned" message after paying). */
async function earnedForBooking(userId, bookingId, db = pool) {
    const h = await loadHistory(db, userId);
    if (!h) return 0;
    return pointEntries(h)
        .filter(e => e.bookingId === Number(bookingId) && e.points > 0)
        .reduce((a, e) => a + e.points, 0);
}

/** Link a new member to the friend whose code they used. */
async function claimReferral(userId, rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) return { ok: false, status: 400, message: 'Enter a referral code' };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const owner = await client.query(`SELECT user_id, forenames FROM users WHERE UPPER(referral_code) = $1 AND is_active = 'Y'`, [code]);
        if (owner.rows.length === 0) {
            await client.query('ROLLBACK');
            return { ok: false, status: 404, message: 'That code doesn’t match a Savannah member' };
        }
        const referrerId = Number(owner.rows[0].user_id);
        if (referrerId === Number(userId)) {
            await client.query('ROLLBACK');
            return { ok: false, status: 400, message: 'That’s your own code' };
        }
        const paid = await client.query(
            `SELECT 1 FROM bookings WHERE user_id = $1 AND status IN ('CONFIRMED', 'COMPLETED') LIMIT 1`,
            [userId]
        );
        if (paid.rows.length) {
            await client.query('ROLLBACK');
            return { ok: false, status: 409, message: 'Referral codes are for new members, before their first booking' };
        }
        // The referrer can't be someone this member referred (no loops)
        const loop = await client.query(`SELECT 1 FROM referrals WHERE referrer_id = $1 AND referred_id = $2`, [userId, referrerId]);
        if (loop.rows.length) {
            await client.query('ROLLBACK');
            return { ok: false, status: 400, message: 'You invited this member, so you can’t use their code' };
        }
        const r = await client.query(
            `INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT (referred_id) DO NOTHING RETURNING referral_id`,
            [referrerId, userId]
        );
        await client.query('COMMIT');
        if (r.rows.length === 0) return { ok: false, status: 409, message: 'You’ve already used a referral code' };
        return { ok: true, referrer: owner.rows[0].forenames, bonus: RULES.REFERRED_WELCOME };
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
    } finally {
        client.release();
    }
}

async function markTrophiesSeen(userId) {
    await optional(pool, `UPDATE user_trophies SET seen_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND seen_at IS NULL`, [userId], []);
}

module.exports = {
    RULES,
    VALUE,
    TROPHIES,
    summary,
    balanceOf,
    quote,
    earnedForBooking,
    claimReferral,
    markTrophiesSeen,
    _internal: { loadHistory, pointEntries, trophyProgress, easterSunday, longestRun }
};
