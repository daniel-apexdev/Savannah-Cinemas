// ============================================================
// SAVANNAH CINEMAS - BOOKING CONFIRMATION EMAILS
// services/bookingEmail.js
//
// Loads everything a confirmation needs from the database (film,
// seats, snacks, ticket, payment) and sends it, so the payment
// step and "email it again" produce the same email.
//
// With the 2026-11-18_booking_receipts.sql migration, it also
// remembers the address on the booking (bookings.receipt_email) and
// when it was last sent (bookings.confirmation_sent_at).
// ============================================================

const pool = require('../config/database');
const { sendBookingConfirmation } = require('../utils/emailService');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(v) {
    return typeof v === 'string' && v.length <= 254 && EMAIL.test(v.trim());
}


async function loadBookingForEmail(bookingId, db = pool) {

    const b = await db.query(
        `
        SELECT
            b.booking_id, b.booking_ref, b.user_id, b.status, b.total_amount,
            COALESCE(b.discount_amount, 0) AS discount_amount,
            to_jsonb(b) ->> 'receipt_email' AS receipt_email,
            COALESCE((to_jsonb(b) ->> 'points_discount')::numeric, 0) AS points_discount,
            COALESCE((to_jsonb(b) ->> 'points_redeemed')::int, 0) AS points_redeemed,
            u.email, u.forenames, u.surname,
            to_jsonb(u) ->> 'is_guest' AS is_guest,
            m.title, m.age_rating, m.runtime_minutes, m.poster_url, m.backdrop_url,
            st.showtime_id,
            c.cinema_name, c.address, c.city, c.phone_number, c.email AS cinema_email,
            s.screen_name,
            st.start_time, st.end_time
        FROM bookings b
        JOIN users u ON u.user_id = b.user_id
        JOIN showtimes st ON st.showtime_id = b.showtime_id
        JOIN movies m ON m.movie_id = st.movie_id
        JOIN cinemas c ON c.cinema_id = st.cinema_id
        JOIN screens s ON s.screen_id = st.screen_id
        WHERE b.booking_id = $1
        `,
        [bookingId]
    );

    if (b.rows.length === 0) return null;
    const row = b.rows[0];

    const seats = await db.query(
        `
        SELECT se.seat_label, se.seat_type, bs.ticket_price
        FROM booking_seats bs
        JOIN seats se ON se.seat_id = bs.seat_id
        WHERE bs.booking_id = $1
        ORDER BY se.row_label, se.seat_number
        `,
        [bookingId]
    );

    const ticket = await db.query(
        `SELECT ticket_code, qr_code_data FROM tickets WHERE booking_id = $1 ORDER BY ticket_id DESC LIMIT 1`,
        [bookingId]
    );

    const payment = await db.query(
        `
        SELECT payment_reference, payment_method, transaction_reference, payment_date
        FROM payments
        WHERE booking_id = $1 AND status = 'SUCCESS'
        ORDER BY payment_date DESC NULLS LAST
        LIMIT 1
        `,
        [bookingId]
    );

    // Snacks bought with the booking (paid with it) + paid pre-orders
    let snacks = [];
    let snackCodes = [];
    try {
        const orders = await db.query(
            `
            SELECT o.order_id, o.source, o.collection_code,
                   i.item_name, i.quantity, i.line_total
            FROM concession_orders o
            JOIN concession_order_items i ON i.order_id = o.order_id
            WHERE o.booking_id = $1
              AND ((o.source = 'BOOKING' AND o.status <> 'CANCELLED') OR (o.source = 'PREORDER' AND o.status = 'PAID'))
            ORDER BY o.order_id, i.order_item_id
            `,
            [bookingId]
        );
        snacks = orders.rows
            .filter((r) => r.source === 'BOOKING')
            .map((r) => ({ name: r.item_name, quantity: r.quantity, lineTotal: r.line_total }));
        snackCodes = [...new Set(orders.rows.map((r) => r.collection_code).filter(Boolean))];
    } catch (e) {
        // Concessions migration not installed
        if (e.code !== '42P01') throw e;
    }

    // Special night (Throwback Thursday...), if the special screenings migration is installed
    let special = null;
    try {
        const sp = await db.query(
            `SELECT sp.name, ss.discount_percent
             FROM special_screenings ss
             JOIN special_programmes sp ON sp.code = ss.programme_code
             WHERE ss.showtime_id = $1`,
            [row.showtime_id]
        );
        if (sp.rows[0]) special = { name: sp.rows[0].name, discountPercent: Number(sp.rows[0].discount_percent) || 0 };
    } catch (e) {
        if (e.code !== '42P01') throw e;
    }

    return {
        userId: row.user_id,
        status: row.status,
        accountEmail: row.email,
        receiptEmail: row.receipt_email,
        // Guests booked without a name: the email says "Hi there"
        customerName: row.is_guest === 'Y' ? '' : `${row.forenames} ${row.surname}`.trim(),
        booking: {
            bookingId: row.booking_id,
            bookingRef: row.booking_ref,
            startTime: row.start_time,
            endTime: row.end_time,
            movie: {
                title: row.title,
                ageRating: row.age_rating,
                runtimeMinutes: row.runtime_minutes,
                posterUrl: row.poster_url,
                backdropUrl: row.backdrop_url
            },
            special,
            cinema: {
                name: row.cinema_name,
                address: row.address,
                city: row.city,
                phoneNumber: row.phone_number,
                email: row.cinema_email
            },
            screen: { name: row.screen_name },
            seats: seats.rows.map((s) => ({ seatLabel: s.seat_label, seatType: s.seat_type, ticketPrice: s.ticket_price })),
            discountAmount: row.discount_amount,
            pointsDiscount: row.points_discount,
            pointsRedeemed: row.points_redeemed,
            totalAmount: row.total_amount,
            snacks,
            snackCodes,
            ticket: ticket.rows[0]
                ? { ticketCode: ticket.rows[0].ticket_code, qrCodeData: ticket.rows[0].qr_code_data }
                : null,
            payment: payment.rows[0]
                ? {
                    method: payment.rows[0].payment_method,
                    reference: payment.rows[0].payment_reference,
                    transactionReference: payment.rows[0].transaction_reference,
                    paidAt: payment.rows[0].payment_date
                }
                : null
        }
    };
}


/**
 * Send (or re-send) the confirmation for a paid booking.
 * `to` defaults to the address used last time, then the account email.
 * Returns { to, sent, reason? }. Never throws for mail problems.
 */
async function sendBookingEmail({ bookingId, to, timeoutMs = 12000 }) {

    const data = await loadBookingForEmail(bookingId);
    if (!data) return { to: null, sent: false, reason: 'Booking not found' };

    if (data.status !== 'CONFIRMED' && data.status !== 'COMPLETED') {
        return { to: null, sent: false, reason: 'Only paid bookings have a confirmation' };
    }

    const recipient = (to && to.trim()) || data.receiptEmail || data.accountEmail;

    // Remember where it went, even if the send fails, so a retry
    // goes to the same place.
    await pool
        .query(`UPDATE bookings SET receipt_email = $2 WHERE booking_id = $1`, [bookingId, recipient])
        .catch((e) => {
            if (e.code !== '42703') console.error('receipt_email not saved:', e.message);
        });

    // Record the send whenever it finishes, even after a timeout below
    const sending = sendBookingConfirmation({ to: recipient, customerName: data.customerName, booking: data.booking })
        .then(async (r) => {
            if (r.sent) {
                await pool
                    .query(`UPDATE bookings SET confirmation_sent_at = CURRENT_TIMESTAMP WHERE booking_id = $1`, [bookingId])
                    .catch((e) => {
                        if (e.code !== '42703') console.error('confirmation_sent_at not saved:', e.message);
                    });
            }
            return r;
        });

    // Don't hold the app's "Pay" button hostage to a slow mail server
    const result = await Promise.race([
        sending,
        new Promise((resolve) => setTimeout(() => resolve({ sent: false, reason: 'Still sending', pending: true }), timeoutMs))
    ]);

    return {
        to: recipient,
        sent: !!result.sent,
        ...(result.pending ? { pending: true } : {}),
        ...(result.sent ? {} : { reason: result.reason })
    };
}


module.exports = {
    isValidEmail,
    loadBookingForEmail,
    sendBookingEmail
};
