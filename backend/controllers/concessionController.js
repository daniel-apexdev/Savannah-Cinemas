const pool = require('../config/database');


// ============================================================
// CONCESSIONS
//
// Snacks & drinks. Two kinds of order, both tied to a booking:
//
//   BOOKING  - added while a booking is still PENDING. The items are
//              added to bookings.total_amount, so the normal payment
//              (POST /api/payments) charges tickets + snacks together.
//              Its status follows the booking (PENDING / PAID /
//              CANCELLED), so payment and cancellation need no changes.
//
//   PREORDER - bought later for an already CONFIRMED booking that
//              hasn't started yet. Paid on its own. If the booking
//              is later cancelled, the order reports CANCELLED too
//              (refunded with the booking under the same policy).
//              NOTE: like paymentController, payment is SIMULATED
//              (MOCK- transaction reference) until a real provider
//              is connected.
//
// Tables: see Development/migrations/2026-11-17_concessions.sql
// ============================================================

const PAYMENT_METHODS = ['MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CASH'];
const MAX_QTY_PER_ITEM = 20;
const MAX_LINES = 30;


function imageUrl(req, imagePath) {

    if (!imagePath) return null;

    if (/^https?:\/\//i.test(imagePath)) return imagePath;

    return `${req.protocol}://${req.get('host')}/${imagePath.replace(/^\/+/, '')}`;

}


function collectionCode() {

    return 'SNK-' + Math.random().toString(36).substring(2, 7).toUpperCase();

}


function notSetUp(res, error) {

    // 42P01 = undefined_table: migration hasn't been run yet
    if (error && error.code === '42P01') {

        res.status(503).json({
            success: false,
            message: 'Concessions are not set up yet. Run Development/migrations/2026-11-17_concessions.sql.'
        });

        return true;

    }

    return false;

}


// Option groups: one choice from SIZE / FLAVOUR / DRINK, any EXTRAs
const SINGLE_GROUPS = new Set(['SIZE', 'FLAVOUR', 'DRINK']);
const GROUP_ORDER = ['SIZE', 'FLAVOUR', 'DRINK', 'EXTRA'];


/**
 * Options for these items (their own, plus their category's).
 * Returns Map itemId -> [option]. Empty if the options migration
 * (2026-11-23_snack_upgrades.sql) hasn't been run.
 */
async function optionsFor(client, items) {

    const byItem = new Map(items.map(i => [Number(i.item_id), []]));

    if (!items.length) return byItem;

    // Savepoints only inside a transaction (a pooled client), not on the pool
    const tx = client !== pool;

    try {

        if (tx) await client.query('SAVEPOINT concession_opts');

        const result = await client.query(
            `
            SELECT option_id, item_id, category, group_code, name, price_delta, is_default, sort_order
            FROM concession_options
            WHERE is_available = TRUE
              AND (item_id = ANY($1::bigint[]) OR category = ANY($2::varchar[]))
            ORDER BY sort_order, option_id
            `,
            [items.map(i => i.item_id), [...new Set(items.map(i => String(i.category || '').toUpperCase()))]]
        );

        if (tx) await client.query('RELEASE SAVEPOINT concession_opts');

        for (const item of items) {
            const list = byItem.get(Number(item.item_id));
            for (const o of result.rows) {
                if (o.item_id != null ? Number(o.item_id) === Number(item.item_id) : o.category === String(item.category || '').toUpperCase()) {
                    list.push({
                        optionId: Number(o.option_id),
                        group: o.group_code,
                        name: o.name,
                        priceDelta: Number(o.price_delta),
                        isDefault: !!o.is_default
                    });
                }
            }
        }

    } catch (error) {

        if (tx) await client.query('ROLLBACK TO SAVEPOINT concession_opts').catch(() => {});
        if (error.code !== '42P01') throw error;

    }

    return byItem;

}


/** "Large · Extra butter" for a set of chosen options */
function optionsLabel(chosen) {

    return [...chosen]
        .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group))
        .map(o => o.name)
        .join(' · ');

}


/**
 * Validate [{ itemId, quantity, options?: [optionId] }] and price it
 * from the database. Each item + set of options is its own line:
 * unit price = item price + the chosen options' price_delta. Single-
 * choice groups (SIZE / FLAVOUR / DRINK) take one option and fall back
 * to the default. Returns { lines, total } or throws { status, message }.
 */
async function priceItems(client, rawItems) {

    if (!Array.isArray(rawItems)) {

        throw { status: 400, message: 'items must be an array' };

    }

    // Merge identical lines (same item, same options), drop zero quantities
    const wanted = new Map(); // key -> { itemId, optionIds, quantity }

    for (const raw of rawItems) {

        const itemId = Number(raw && raw.itemId);
        const quantity = Number(raw && raw.quantity);
        const optionIds = Array.isArray(raw && raw.options) ? raw.options.map(Number) : [];

        if (!Number.isInteger(itemId) || itemId <= 0) {
            throw { status: 400, message: 'Invalid itemId' };
        }

        if (!Number.isInteger(quantity) || quantity < 0) {
            throw { status: 400, message: 'Invalid quantity' };
        }

        if (optionIds.some(o => !Number.isInteger(o) || o <= 0) || optionIds.length > 12) {
            throw { status: 400, message: 'Invalid options' };
        }

        const ids = [...new Set(optionIds)].sort((a, b) => a - b);
        const key = `${itemId}|${ids.join(',')}`;
        const line = wanted.get(key) || { itemId, optionIds: ids, quantity: 0 };
        line.quantity += quantity;
        wanted.set(key, line);

    }

    for (const [key, line] of [...wanted.entries()]) {

        if (line.quantity === 0) wanted.delete(key);

        if (line.quantity > MAX_QTY_PER_ITEM) {
            throw { status: 400, message: `Maximum ${MAX_QTY_PER_ITEM} of each item` };
        }

    }

    if (wanted.size > MAX_LINES) {
        throw { status: 400, message: 'Too many different items' };
    }

    if (wanted.size === 0) {
        return { lines: [], total: 0 };
    }

    const ids = [...new Set([...wanted.values()].map(l => l.itemId))];

    const result = await client.query(
        `
        SELECT item_id, name, category, price, is_available
        FROM concession_items
        WHERE item_id = ANY($1::bigint[])
        `,
        [ids]
    );

    const byId = new Map(result.rows.map(r => [Number(r.item_id), r]));
    const optionsByItem = await optionsFor(client, result.rows);

    const lines = [];
    let total = 0;

    for (const want of wanted.values()) {

        const row = byId.get(want.itemId);

        if (!row) {
            throw { status: 400, message: `Item ${want.itemId} does not exist` };
        }

        if (!row.is_available) {
            throw { status: 400, message: `${row.name} is not available right now` };
        }

        const available = optionsByItem.get(want.itemId) || [];
        const chosen = [];

        for (const optionId of want.optionIds) {
            const option = available.find(o => o.optionId === optionId);
            if (!option) {
                throw { status: 400, message: `That choice isn't available for ${row.name}` };
            }
            if (SINGLE_GROUPS.has(option.group) && chosen.some(c => c.group === option.group)) {
                throw { status: 400, message: `Pick one ${option.group.toLowerCase()} for ${row.name}` };
            }
            chosen.push(option);
        }

        // Single-choice groups with nothing picked get their default
        for (const group of SINGLE_GROUPS) {
            if (chosen.some(c => c.group === group)) continue;
            const fallback = available.find(o => o.group === group && o.isDefault) || available.find(o => o.group === group);
            if (fallback) chosen.push(fallback);
        }

        const unitPrice = Number((Number(row.price) + chosen.reduce((a, o) => a + o.priceDelta, 0)).toFixed(2));
        const quantity = want.quantity;
        const lineTotal = Number((unitPrice * quantity).toFixed(2));
        const label = optionsLabel(chosen);

        total += lineTotal;

        lines.push({
            itemId: want.itemId,
            name: (label ? `${row.name} (${label})` : row.name).slice(0, 200),
            unitPrice,
            quantity,
            lineTotal,
            options: chosen.map(o => ({ optionId: o.optionId, group: o.group, name: o.name, priceDelta: o.priceDelta }))
        });

    }

    return { lines, total: Number(total.toFixed(2)) };

}


let optionsColumn = null; // does concession_order_items.options exist?

async function hasOptionsColumn(client) {

    if (optionsColumn === null) {
        const r = await client.query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_name = 'concession_order_items' AND column_name = 'options'`
        );
        optionsColumn = r.rows.length > 0;
    }

    return optionsColumn;

}


async function insertOrder(client, { bookingId, userId, source, status, total, lines, paymentMethod, transactionReference }) {

    const orderResult = await client.query(
        `
        INSERT INTO concession_orders (
            booking_id,
            user_id,
            source,
            status,
            total_amount,
            payment_method,
            transaction_reference,
            collection_code,
            paid_at
        )
        VALUES ($1, $2, $3::varchar, $4::varchar, $5, $6, $7, $8,
                CASE WHEN $4::varchar = 'PAID' THEN CURRENT_TIMESTAMP ELSE NULL END)
        RETURNING order_id, collection_code, created_at
        `,
        [bookingId, userId, source, status, total, paymentMethod || null, transactionReference || null, collectionCode()]
    );

    const order = orderResult.rows[0];

    const withOptions = await hasOptionsColumn(client);

    for (const line of lines) {

        if (withOptions) {

            await client.query(
                `
                INSERT INTO concession_order_items (
                    order_id, item_id, item_name, unit_price, quantity, line_total, options
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                `,
                [order.order_id, line.itemId, line.name, line.unitPrice, line.quantity, line.lineTotal,
                 line.options && line.options.length ? JSON.stringify(line.options) : null]
            );

        } else {

            await client.query(
                `
                INSERT INTO concession_order_items (
                    order_id, item_id, item_name, unit_price, quantity, line_total
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                `,
                [order.order_id, line.itemId, line.name.slice(0, 120), line.unitPrice, line.quantity, line.lineTotal]
            );

        }

    }

    return order;

}


// Effective status: BOOKING orders follow their booking.
const ORDER_SELECT = `
    SELECT
        o.order_id,
        o.booking_id,
        o.source,
        CASE
            -- A cancelled booking cancels every snack order on it
            WHEN b.status = 'CANCELLED' THEN 'CANCELLED'
            WHEN o.source = 'BOOKING' THEN
                CASE b.status
                    WHEN 'CONFIRMED' THEN 'PAID'
                    WHEN 'COMPLETED' THEN 'PAID'
                    WHEN 'CANCELLED' THEN 'CANCELLED'
                    ELSE 'PENDING'
                END
            ELSE o.status
        END AS status,
        o.total_amount,
        o.payment_method,
        o.collection_code,
        o.created_at,
        o.paid_at,
        b.booking_ref,
        st.start_time,
        m.movie_id,
        m.title AS movie_title,
        m.poster_url,
        COALESCE(
            json_agg(
                json_build_object(
                    'itemId', oi.item_id,
                    'name', oi.item_name,
                    'unitPrice', oi.unit_price,
                    'quantity', oi.quantity,
                    'lineTotal', oi.line_total,
                    'imagePath', ci.image_path,
                    'options', to_jsonb(oi) -> 'options'
                )
                ORDER BY oi.order_item_id
            ) FILTER (WHERE oi.order_item_id IS NOT NULL),
            '[]'
        ) AS items
    FROM concession_orders o
    JOIN bookings b ON b.booking_id = o.booking_id
    JOIN showtimes st ON st.showtime_id = b.showtime_id
    JOIN movies m ON m.movie_id = st.movie_id
    LEFT JOIN concession_order_items oi ON oi.order_id = o.order_id
    LEFT JOIN concession_items ci ON ci.item_id = oi.item_id
`;

const ORDER_GROUP = `
    GROUP BY o.order_id, b.booking_id, st.showtime_id, m.movie_id
`;


function orderOut(req, row) {

    const showCode = row.status === 'PAID';

    return {
        orderId: Number(row.order_id),
        bookingId: Number(row.booking_id),
        bookingRef: row.booking_ref,
        source: row.source,
        status: row.status,
        totalAmount: row.total_amount,
        paymentMethod: row.payment_method,
        // Only meaningful once paid
        collectionCode: showCode ? row.collection_code : null,
        createdAt: row.created_at,
        paidAt: row.paid_at,
        movie: {
            movieId: Number(row.movie_id),
            title: row.movie_title,
            posterUrl: row.poster_url
        },
        startTime: row.start_time,
        items: (row.items || []).map(i => ({
            itemId: Number(i.itemId),
            name: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            lineTotal: i.lineTotal,
            imageUrl: imageUrl(req, i.imagePath),
            // Option ids chosen (so the app can restore the basket)
            options: Array.isArray(i.options) ? i.options.map(o => Number(o.optionId)) : []
        }))
    };

}


// ============================================================
// GET /api/concessions  (public)
// ============================================================

async function getItems(req, res) {

    try {

        const result = await pool.query(
            `
            SELECT item_id, name, category, description, price, currency,
                   image_path, is_available, sort_order
            FROM concession_items
            WHERE is_available = TRUE
            ORDER BY sort_order, name
            `
        );

        const optionsByItem = await optionsFor(pool, result.rows);

        return res.json({
            success: true,
            count: result.rows.length,
            items: result.rows.map(r => ({
                itemId: Number(r.item_id),
                name: r.name,
                category: r.category,
                description: r.description,
                price: r.price,
                currency: r.currency,
                imageUrl: imageUrl(req, r.image_path),
                isAvailable: r.is_available,
                // Upgrades and choices: SIZE / FLAVOUR / DRINK (pick one), EXTRA (any)
                options: optionsByItem.get(Number(r.item_id)) || []
            }))
        });

    } catch (error) {

        if (notSetUp(res, error)) return;

        console.error('Get concessions error:', error);

        return res.status(500).json({ success: false, message: 'Server error loading concessions' });

    }

}


// ============================================================
// GET /api/concessions/bookings/:bookingId  (auth)
// ============================================================

async function getBookingConcessions(req, res) {

    const userId = req.user && req.user.userId;
    const bookingId = Number(req.params.bookingId);

    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!Number.isInteger(bookingId) || bookingId <= 0) return res.status(400).json({ success: false, message: 'Invalid booking ID' });

    try {

        const owner = await pool.query(
            'SELECT booking_id FROM bookings WHERE booking_id = $1 AND user_id = $2',
            [bookingId, userId]
        );

        if (owner.rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });

        const result = await pool.query(
            `${ORDER_SELECT} WHERE o.booking_id = $1 ${ORDER_GROUP} ORDER BY o.created_at`,
            [bookingId]
        );

        return res.json({ success: true, bookingId, orders: result.rows.map(r => orderOut(req, r)) });

    } catch (error) {

        if (notSetUp(res, error)) return;

        console.error('Get booking concessions error:', error);

        return res.status(500).json({ success: false, message: 'Server error loading concessions' });

    }

}


// ============================================================
// PUT /api/concessions/bookings/:bookingId  (auth)
// Body: { items: [{ itemId, quantity, options?: [optionId] }] }   (empty array clears)
// Booking must be PENDING and its hold not expired.
// ============================================================

async function setBookingConcessions(req, res) {

    const userId = req.user && req.user.userId;
    const bookingId = Number(req.params.bookingId);

    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!Number.isInteger(bookingId) || bookingId <= 0) return res.status(400).json({ success: false, message: 'Invalid booking ID' });

    let client;

    try {

        client = await pool.connect();
        await client.query('BEGIN');

        const bookingResult = await client.query(
            `
            SELECT booking_id, status, discount_amount, expires_at,
                   (expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP) AS expired
            FROM bookings
            WHERE booking_id = $1 AND user_id = $2
            FOR UPDATE
            `,
            [bookingId, userId]
        );

        if (bookingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const booking = bookingResult.rows[0];

        if (booking.status !== 'PENDING' || booking.expired) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: booking.status === 'PENDING'
                    ? 'This booking hold has expired'
                    : 'Snacks can only be added before payment. Use a pre-order instead.'
            });
        }

        const { lines, total } = await priceItems(client, req.body && req.body.items);

        // Ticket part of the total, recomputed from the seats themselves
        const seatSum = await client.query(
            'SELECT COALESCE(SUM(ticket_price), 0) AS s FROM booking_seats WHERE booking_id = $1',
            [bookingId]
        );

        const ticketsAmount = Math.max(
            0,
            Number((Number(seatSum.rows[0].s) - Number(booking.discount_amount || 0)).toFixed(2))
        );

        // Replace any earlier selection
        await client.query(
            `DELETE FROM concession_orders WHERE booking_id = $1 AND source = 'BOOKING'`,
            [bookingId]
        );

        let order = null;

        if (lines.length > 0) {
            order = await insertOrder(client, {
                bookingId, userId, source: 'BOOKING', status: 'ATTACHED', total, lines
            });
        }

        const totalAmount = Number((ticketsAmount + total).toFixed(2));

        await client.query(
            'UPDATE bookings SET total_amount = $2, updated_at = CURRENT_TIMESTAMP WHERE booking_id = $1',
            [bookingId, totalAmount]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            booking: {
                bookingId,
                ticketsAmount: ticketsAmount.toFixed(2),
                concessionsAmount: total.toFixed(2),
                totalAmount: totalAmount.toFixed(2)
            },
            orderId: order ? Number(order.order_id) : null,
            items: lines
        });

    } catch (error) {

        if (client) {
            try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
        }

        if (error && error.status) return res.status(error.status).json({ success: false, message: error.message });

        if (notSetUp(res, error)) return;

        console.error('Set booking concessions error:', error);

        return res.status(500).json({ success: false, message: 'Server error saving snacks' });

    } finally {

        if (client) client.release();

    }

}


// ============================================================
// POST /api/concessions/orders  (auth)
// Body: { bookingId, items: [{ itemId, quantity, options?: [optionId] }], paymentMethod }
// Pre-order for a CONFIRMED booking that hasn't started. Paid now.
// ============================================================

async function createPreorder(req, res) {

    const userId = req.user && req.user.userId;
    const bookingId = Number(req.body && req.body.bookingId);
    const paymentMethod = String((req.body && req.body.paymentMethod) || '').toUpperCase();

    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (!Number.isInteger(bookingId) || bookingId <= 0) return res.status(400).json({ success: false, message: 'Choose which booking the snacks are for' });
    if (!PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ success: false, message: 'Invalid payment method' });

    let client;

    try {

        client = await pool.connect();
        await client.query('BEGIN');

        const bookingResult = await client.query(
            `
            SELECT b.booking_id, b.status, st.start_time,
                   (st.start_time > CURRENT_TIMESTAMP) AS upcoming
            FROM bookings b
            JOIN showtimes st ON st.showtime_id = b.showtime_id
            WHERE b.booking_id = $1 AND b.user_id = $2
            FOR UPDATE OF b
            `,
            [bookingId, userId]
        );

        if (bookingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const booking = bookingResult.rows[0];

        if (booking.status !== 'CONFIRMED' || !booking.upcoming) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Pre-orders are only for paid tickets to upcoming shows' });
        }

        const { lines, total } = await priceItems(client, req.body.items);

        if (lines.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Your order is empty' });
        }

        // SIMULATED payment, matching paymentController
        const transactionReference = 'MOCK-SNK-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();

        const order = await insertOrder(client, {
            bookingId, userId, source: 'PREORDER', status: 'PAID', total, lines, paymentMethod, transactionReference
        });

        await client.query('COMMIT');

        const result = await pool.query(
            `${ORDER_SELECT} WHERE o.order_id = $1 ${ORDER_GROUP}`,
            [order.order_id]
        );

        return res.status(201).json({
            success: true,
            message: 'Snacks pre-ordered. Collect them at the kiosk with your code.',
            order: orderOut(req, result.rows[0])
        });

    } catch (error) {

        if (client) {
            try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
        }

        if (error && error.status) return res.status(error.status).json({ success: false, message: error.message });

        if (notSetUp(res, error)) return;

        console.error('Create pre-order error:', error);

        return res.status(500).json({ success: false, message: 'Server error placing order' });

    } finally {

        if (client) client.release();

    }

}


// ============================================================
// GET /api/concessions/orders  (auth) - the user's snack orders
// ============================================================

async function getMyOrders(req, res) {

    const userId = req.user && req.user.userId;

    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });

    try {

        const result = await pool.query(
            `${ORDER_SELECT} WHERE o.user_id = $1 ${ORDER_GROUP} ORDER BY st.start_time DESC, o.created_at DESC`,
            [userId]
        );

        return res.json({ success: true, count: result.rows.length, orders: result.rows.map(r => orderOut(req, r)) });

    } catch (error) {

        if (notSetUp(res, error)) return;

        console.error('Get my concession orders error:', error);

        return res.status(500).json({ success: false, message: 'Server error loading orders' });

    }

}


module.exports = {
    getItems,
    getBookingConcessions,
    setBookingConcessions,
    createPreorder,
    getMyOrders
};
