// ============================================================
// SAVANNAH CINEMAS - GUEST CHECKOUT (WEBSITE)
// services/guestSessions.js
//
// The website lets people book without an account. The first time a
// visitor books, they get a guest user and a random session token
// ("guest_..."), which the browser keeps and sends like a sign-in
// token. Only a hash of the token is stored.
//
// Guests can hold seats, add snacks, pay and see their tickets on that
// browser. Tickets are emailed to the address given at checkout.
// No points, trophies, watchlist or reminders: those need an account.
// ============================================================

const crypto = require('crypto');
const pool = require('../config/database');

const PREFIX = 'guest_';
const DAYS = 60;

function hash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function isGuestToken(token) {
    return typeof token === 'string' && token.startsWith(PREFIX) && token.length > PREFIX.length + 20;
}

/** New guest user + session. Returns the token (shown once). */
async function createSession() {

    const token = PREFIX + crypto.randomBytes(32).toString('base64url');
    const placeholder = `guest-${crypto.randomBytes(12).toString('hex')}@guest.savannah.invalid`;

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        const user = await client.query(
            `INSERT INTO users (email, password_hash, forenames, surname, is_guest, is_active, created_at, updated_at)
             VALUES ($1, NULL, 'Guest', '-', 'Y', 'Y', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING user_id`,
            [placeholder]
        );

        const userId = Number(user.rows[0].user_id);

        // Bookings and snack orders expect a customer profile and role
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

        await client.query(
            `INSERT INTO guest_sessions (token_hash, user_id, expires_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP + make_interval(days => $3))`,
            [hash(token), userId, DAYS]
        );

        await client.query('COMMIT');

        return { token, userId };

    } catch (error) {

        await client.query('ROLLBACK').catch(() => {});
        throw error;

    } finally {

        client.release();

    }
}

/** The guest behind a token, or null if unknown/expired. */
async function userForToken(token) {

    if (!isGuestToken(token)) return null;

    const r = await pool.query(
        `UPDATE guest_sessions gs
         SET last_used_at = CURRENT_TIMESTAMP,
             -- keep active visitors signed in
             expires_at = GREATEST(gs.expires_at, CURRENT_TIMESTAMP + make_interval(days => $2))
         FROM users u
         WHERE gs.token_hash = $1
           AND gs.expires_at > CURRENT_TIMESTAMP
           AND u.user_id = gs.user_id
           AND u.is_active = 'Y'
         RETURNING u.user_id, u.email`,
        [hash(token), DAYS]
    );

    if (!r.rows.length) return null;

    const role = await pool.query(`SELECT role_id FROM user_roles WHERE role_name = 'CUSTOMER'`);

    return {
        userId: Number(r.rows[0].user_id),
        email: r.rows[0].email,
        role: 'CUSTOMER',
        roleId: role.rows[0] ? role.rows[0].role_id : null,
        guest: true
    };
}

module.exports = { createSession, userForToken, isGuestToken };
