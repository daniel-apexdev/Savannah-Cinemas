// ============================================================
// PROFILE LOOK: username, avatar and profile backdrop
//
// Columns from Development/migrations/2026-11-22_profile_look.sql.
// Every function copes with the migration not being run yet (it
// returns nulls / reports "not set up") so auth keeps working.
// ============================================================

const pool = require('../config/database');

// Must match the avatars drawn in the app (mobile/src/components/avatar.tsx)
const AVATARS = [
    'lion', 'elephant', 'giraffe', 'zebra', 'owl', 'cheetah',
    'hippo', 'monkey', 'popcorn', 'clapper', 'specs', 'reel'
];

const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;
const RESERVED = new Set([
    'admin', 'administrator', 'savannah', 'savannahcinemas', 'support', 'help',
    'staff', 'manager', 'root', 'system', 'moderator', 'official', 'null', 'undefined'
]);

const ADJECTIVES = [
    'Velvet', 'Golden', 'Midnight', 'Silver', 'Neon', 'Matinee', 'Encore', 'Popcorn',
    'Starlit', 'Savannah', 'Electric', 'Cosmic', 'Sunset', 'Mellow', 'Classic', 'Sneaky',
    'Lucky', 'Velour', 'Crimson', 'Jolly'
];
const NOUNS = [
    'Critic', 'Usher', 'Reel', 'Director', 'Owl', 'Lion', 'Clapper', 'Projector',
    'Premiere', 'Cameo', 'Rewind', 'Montage', 'Spotlight', 'Sequel', 'Marquee', 'Finale',
    'Popcorn', 'Ticket', 'Zebra', 'Kente'
];

const MISSING = new Set(['42703', '42P01']); // undefined column / table

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

/** Why a username can't be used, or null if the format is fine. */
function usernameProblem(raw) {
    const u = String(raw ?? '').trim();
    if (!USERNAME_RE.test(u)) return 'Use 3 to 20 letters, numbers, dots or underscores.';
    if (!/[A-Za-z]/.test(u)) return 'Include at least one letter.';
    if (/^[._]|[._]$/.test(u) || /[._]{2}/.test(u)) return 'Dots and underscores go between letters or numbers.';
    if (RESERVED.has(u.toLowerCase().replace(/[._]/g, ''))) return 'That name is reserved. Try another.';
    return null;
}

async function isTaken(db, username, exceptUserId = null) {
    const r = await db.query(
        `SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND ($2::bigint IS NULL OR user_id <> $2::bigint) LIMIT 1`,
        [username, exceptUserId]
    );
    return r.rows.length > 0;
}

/** Up to `count` free usernames. A first name, if given, is worked into some. */
async function suggestUsernames(db = pool, { name, count = 4 } = {}) {
    const first = String(name ?? '').normalize('NFKD').replace(/[^A-Za-z]/g, '').slice(0, 10);
    const cap = first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : '';
    const out = [];
    const seen = new Set();
    for (let i = 0; i < 40 && out.length < count; i++) {
        const n = Math.floor(Math.random() * 90) + 10;
        const candidate =
            cap && i % 3 === 1 ? `${pick(ADJECTIVES)}${cap}${n}`.slice(0, 20)
            : cap && i % 3 === 2 ? `${cap}The${pick(NOUNS)}`.slice(0, 20)
            : `${pick(ADJECTIVES)}${pick(NOUNS)}${n}`;
        const key = candidate.toLowerCase();
        if (seen.has(key) || usernameProblem(candidate)) continue;
        seen.add(key);
        if (!(await isTaken(db, candidate))) out.push(candidate);
    }
    return out;
}

/** The look fields for a user, as the API returns them. */
async function getLook(userId, db = pool) {
    try {
        const r = await db.query(
            `SELECT username, avatar_key, profile_backdrop_url, profile_backdrop_movie_id
             FROM users WHERE user_id = $1`,
            [userId]
        );
        const row = r.rows[0];
        if (!row) return { username: null, avatar: null, backdrop: null };
        return {
            username: row.username,
            avatar: AVATARS.includes(row.avatar_key) ? row.avatar_key : null,
            backdrop: row.profile_backdrop_url
                ? { url: row.profile_backdrop_url, movieId: row.profile_backdrop_movie_id ? Number(row.profile_backdrop_movie_id) : null }
                : null
        };
    } catch (error) {
        if (MISSING.has(error.code)) return { username: null, avatar: null, backdrop: null };
        throw error;
    }
}

/**
 * Give a new account a generated username (inside the registration
 * transaction). Uses a savepoint so a missing migration can't break
 * sign-up.
 */
async function assignUsername(client, userId, forenames) {
    try {
        await client.query('SAVEPOINT look_username');
        const [name] = await suggestUsernames(client, { name: forenames, count: 1 });
        await client.query(
            `UPDATE users SET username = $1 WHERE user_id = $2 AND username IS NULL`,
            [name || `fan_${userId}`, userId]
        );
        await client.query('RELEASE SAVEPOINT look_username');
    } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT look_username');
        if (!MISSING.has(error.code)) console.warn('Could not assign a username:', error.message);
    }
}

/**
 * Film stills that can be a profile backdrop: any film in the
 * catalogue with one, whether it's on now or not. Films on now come
 * first, then the rest by rating. Optional title search.
 */
async function backdropChoices(limit = 120, q = '') {
    const search = String(q || '').trim().slice(0, 60);
    const r = await pool.query(
        `
        SELECT movie_id, title, backdrop_url
        FROM movies
        WHERE backdrop_url IS NOT NULL AND backdrop_url <> ''
          AND ($2::text = '' OR title ILIKE '%' || $2::text || '%')
        ORDER BY (status = 'NOW_SHOWING') DESC, (status = 'UPCOMING') DESC, COALESCE(rating, 0) DESC, movie_id DESC
        LIMIT $1
        `,
        [limit, search]
    );
    return r.rows.map(m => ({ movieId: Number(m.movie_id), title: m.title, url: m.backdrop_url }));
}

class LookError extends Error {
    constructor(status, message, field) {
        super(message);
        this.status = status;
        this.field = field;
    }
}

/**
 * Change any of username / avatar / backdrop.
 * patch: { username?, avatar? (key or null), backdropMovieId? (id or null) }
 */
async function updateLook(userId, patch = {}) {
    const sets = [];
    const params = [];
    const add = (sql, value) => {
        params.push(value);
        sets.push(sql.replace('?', `$${params.length}`));
    };

    if (patch.username !== undefined) {
        const u = String(patch.username ?? '').trim();
        const problem = usernameProblem(u);
        if (problem) throw new LookError(400, problem, 'username');
        if (await isTaken(pool, u, userId)) throw new LookError(409, 'That username is taken. Try another.', 'username');
        add('username = ?', u);
    }

    if (patch.avatar !== undefined) {
        if (patch.avatar !== null && !AVATARS.includes(patch.avatar)) throw new LookError(400, 'Unknown avatar', 'avatar');
        add('avatar_key = ?', patch.avatar);
    }

    if (patch.backdropMovieId !== undefined) {
        if (patch.backdropMovieId === null) {
            add('profile_backdrop_movie_id = ?', null);
            add('profile_backdrop_url = ?', null);
        } else {
            const id = Number(patch.backdropMovieId);
            const m = Number.isInteger(id)
                ? await pool.query(`SELECT movie_id, backdrop_url FROM movies WHERE movie_id = $1 AND backdrop_url IS NOT NULL AND backdrop_url <> ''`, [id])
                : { rows: [] };
            if (!m.rows.length) throw new LookError(400, 'That film has no image to use', 'backdrop');
            add('profile_backdrop_movie_id = ?', id);
            add('profile_backdrop_url = ?', m.rows[0].backdrop_url);
        }
    }

    if (!sets.length) throw new LookError(400, 'Nothing to change');

    params.push(userId);
    try {
        await pool.query(
            `UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $${params.length}`,
            params
        );
    } catch (error) {
        if (error.code === '23505') throw new LookError(409, 'That username is taken. Try another.', 'username');
        if (MISSING.has(error.code)) throw new LookError(503, 'Profile looks need the 2026-11-22_profile_look migration (npm run db:migrate).');
        throw error;
    }

    return getLook(userId);
}

module.exports = {
    AVATARS,
    usernameProblem,
    isTaken,
    suggestUsernames,
    getLook,
    assignUsername,
    backdropChoices,
    updateLook,
    LookError
};
