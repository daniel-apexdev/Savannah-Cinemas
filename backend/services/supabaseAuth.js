// ============================================================
// SUPABASE AUTH
//
// When SUPABASE_URL is set, sign-in is done by Supabase Auth: the
// app and website sign in with supabase-js and send the Supabase
// access token as "Authorization: Bearer <token>".
//
// Here we check that token with Supabase and find (or create) the
// matching row in our own users table, linked by users.auth_user_id.
// Everything else in the API keeps using users.user_id as before.
//
//   SUPABASE_URL               https://<project>.supabase.co
//   Public key:  SUPABASE_PUBLISHABLE_KEYS (new sb_publishable_ keys, JSON)
//                or the legacy SUPABASE_ANON_KEY
//   Secret key:  SUPABASE_SECRET_KEYS (new sb_secret_ keys, JSON) or the
//                legacy SUPABASE_SERVICE_ROLE_KEY; only for deleting an
//                account's sign-in
// Edge Functions get all of these automatically. Legacy keys retire in
// 2027, so the new ones are preferred when both exist.
// ============================================================

const pool = require('../config/database');

const CACHE_MS = 60 * 1000;
const cache = new Map(); // token -> { user, until }

function fromKeySet(name) {
    const raw = process.env[name];
    if (!raw) return null;
    try {
        const keys = JSON.parse(raw);
        return keys.default || Object.values(keys)[0] || null;
    } catch {
        return raw.startsWith('sb_') ? raw : null;
    }
}

function publicKey() {
    return fromKeySet('SUPABASE_PUBLISHABLE_KEYS') || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || secretKey();
}

function secretKey() {
    return fromKeySet('SUPABASE_SECRET_KEYS') || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

/** Headers for a call made with a project key. New sb_ keys aren't JWTs, so they only go in apikey. */
function keyHeaders(key) {
    return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

function enabled() {
    return !!(process.env.SUPABASE_URL && publicKey());
}

function baseUrl() {
    return String(process.env.SUPABASE_URL).replace(/\/+$/, '');
}

/** The Supabase user for an access token, or null if it isn't valid. */
async function userForToken(token) {

    const hit = cache.get(token);
    if (hit && hit.until > Date.now()) return hit.user;

    const res = await fetch(`${baseUrl()}/auth/v1/user`, {
        headers: {
            apikey: publicKey(),
            Authorization: `Bearer ${token}`
        }
    });

    if (!res.ok) return null;

    const user = await res.json();
    if (!user || !user.id) return null;

    if (cache.size > 500) cache.clear();
    cache.set(token, { user, until: Date.now() + CACHE_MS });
    return user;
}


function clean(v, max = 100) {
    const s = String(v ?? '').trim();
    return s ? s.slice(0, max) : null;
}

/**
 * Our users row for a Supabase user: by auth_user_id, else an
 * existing account with the same email (linked now), else a new
 * customer account built from the sign-up details
 * (user_metadata: forenames, surname, phoneNumber).
 * Returns { userId, email }.
 */
async function ensureLocalUser(authUser) {

    const email = String(authUser.email || '').trim().toLowerCase();

    const linked = await pool.query(
        `SELECT user_id, email FROM users WHERE auth_user_id = $1`,
        [authUser.id]
    );

    if (linked.rows.length) {
        const row = linked.rows[0];
        // Email changed in Supabase: follow it
        if (email && row.email !== email) {
            await pool.query(`UPDATE users SET email = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`, [row.user_id, email])
                .catch(() => {});
        }
        return { userId: Number(row.user_id), email: email || row.email };
    }

    if (email) {
        const existing = await pool.query(
            `UPDATE users SET auth_user_id = $2, updated_at = CURRENT_TIMESTAMP
             WHERE LOWER(email) = $1 AND auth_user_id IS NULL
             RETURNING user_id, email`,
            [email, authUser.id]
        );
        if (existing.rows.length) {
            return { userId: Number(existing.rows[0].user_id), email: existing.rows[0].email };
        }
    }

    // New account
    const meta = authUser.user_metadata || {};
    const forenames = clean(meta.forenames, 100) || clean(email.split('@')[0], 100) || 'Savannah';
    const surname = clean(meta.surname, 100) || '-';
    const phone = clean(meta.phoneNumber || meta.phone_number || authUser.phone, 30);

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        const inserted = await client.query(
            `INSERT INTO users (email, password_hash, forenames, surname, phone_number, auth_user_id, is_active, created_at, updated_at)
             VALUES ($1, NULL, $2, $3, $4, $5, 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (auth_user_id) DO NOTHING
             RETURNING user_id`,
            [email, forenames, surname, phone, authUser.id]
        );

        if (!inserted.rows.length) {
            // Another request created it a moment ago
            await client.query('ROLLBACK');
            const again = await pool.query(`SELECT user_id, email FROM users WHERE auth_user_id = $1`, [authUser.id]);
            return { userId: Number(again.rows[0].user_id), email: again.rows[0].email };
        }

        const userId = Number(inserted.rows[0].user_id);

        await require('./profileLook').assignUsername(client, userId, forenames);

        await client.query(
            `INSERT INTO user_notification_preferences
                 (user_id, booking_reminders, booking_confirmations, movie_releases, promotions, new_movies, created_at, updated_at)
             VALUES ($1, 'Y', 'Y', 'Y', 'Y', 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT DO NOTHING`,
            [userId]
        );

        await client.query(
            `INSERT INTO customer_profiles (user_id, current_loyalty_points, created_at, updated_at)
             VALUES ($1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT DO NOTHING`,
            [userId]
        );

        await client.query(
            `INSERT INTO user_role_assignments (user_id, role_id, assigned_at)
             SELECT $1, role_id, CURRENT_TIMESTAMP FROM user_roles WHERE role_name = 'CUSTOMER'`,
            [userId]
        );

        await client.query('COMMIT');

        return { userId, email };

    } catch (error) {

        await client.query('ROLLBACK').catch(() => {});
        throw error;

    } finally {

        client.release();

    }
}


/** Delete the Supabase sign-in for a user (account deletion). */
async function deleteAuthUser(authUserId) {

    const key = secretKey();
    if (!authUserId || !key) return false;

    const res = await fetch(`${baseUrl()}/auth/v1/admin/users/${authUserId}`, {
        method: 'DELETE',
        headers: {
            ...keyHeaders(key)
        }
    });

    return res.ok;
}


module.exports = { enabled, userForToken, ensureLocalUser, deleteAuthUser };
