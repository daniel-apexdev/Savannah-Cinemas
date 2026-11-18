-- ============================================================
-- SAVANNAH CINEMAS - SECOND LOCATION: WEST HILLS MALL
-- 2026-11-22_west_hills.sql
--
-- 1. The Accra cinema is renamed "Savannah Cinemas - Accra Mall" so
--    the app can tell the two locations apart.
-- 2. "Savannah Cinemas - West Hills Mall" (Dunkonah, Weija, off the
--    Accra - Cape Coast Highway) with three screens and seat plans.
-- 3. Ticket prices for West Hills, copied from Accra Mall.
-- 4. The sample weekly events, copied to West Hills.
--
-- After running this, generate showtimes (npm run showtimes:generate, or wait
-- for the 6-hourly job): the generator now programmes each cinema
-- separately, so West Hills gets its own shows.
--
-- Phone and email below are placeholders: put in the real ones.
-- Safe to run more than once.
-- ============================================================


-- 1. Accra Mall name -----------------------------------------------

UPDATE cinemas
SET cinema_name = 'Savannah Cinemas - Accra Mall',
    updated_at  = CURRENT_TIMESTAMP
WHERE cinema_name ILIKE '%Accra%'
  AND cinema_name NOT ILIKE '%Accra Mall%'
  AND COALESCE(address, '') ILIKE '%Accra Mall%';


-- 2. West Hills Mall -----------------------------------------------

INSERT INTO cinemas (cinema_name, description, address, city, region, phone_number, email, is_active)
SELECT 'Savannah Cinemas - West Hills Mall',
       'Savannah Cinemas on the west side of Accra',
       'West Hills Mall, Dunkonah, Weija, off the Accra - Cape Coast Highway',
       'Accra',
       'Greater Accra',
       '+233 20 000 0001',
       'westhills@savannahcinemas.com',
       'Y'
WHERE NOT EXISTS (SELECT 1 FROM cinemas WHERE cinema_name ILIKE '%West Hills%');

INSERT INTO screens (cinema_id, screen_name, screen_number, capacity, screen_type, sound_system)
SELECT c.cinema_id, s.name, s.num, 1, s.type, s.sound
FROM cinemas c
CROSS JOIN (VALUES
    ('Screen 1', 1, 'STANDARD', 'Dolby Digital'),
    ('Screen 2', 2, 'VIP',      'Dolby Atmos'),
    ('Screen 3', 3, 'STANDARD', 'Dolby Digital')
) AS s(name, num, type, sound)
WHERE c.cinema_name ILIKE '%West Hills%'
ON CONFLICT (cinema_id, screen_number) DO NOTHING;

--    Seat plans for the new screens (same layouts as Accra Mall):
--    VIP rows A-D x 8; Screen 3 rows A-H x 12; Screen 1 rows A-F x 10;
--    standard screens get VIP centre seats in the back two rows;
--    every screen gets two wheelchair spaces.
DO $$
DECLARE
    sc RECORD;
    n_rows INT;
    n_seats INT;
BEGIN
    FOR sc IN
        SELECT s.screen_id, s.screen_number, UPPER(COALESCE(s.screen_type, '')) AS screen_type
        FROM screens s
        JOIN cinemas c ON c.cinema_id = s.cinema_id
        WHERE c.cinema_name ILIKE '%West Hills%'
          AND NOT EXISTS (SELECT 1 FROM seats se WHERE se.screen_id = s.screen_id)
    LOOP
        IF sc.screen_type = 'VIP' THEN
            n_rows := 4; n_seats := 8;
        ELSIF sc.screen_number = 3 THEN
            n_rows := 8; n_seats := 12;
        ELSE
            n_rows := 6; n_seats := 10;
        END IF;

        INSERT INTO seats (screen_id, row_label, seat_number, seat_label, seat_type)
        SELECT sc.screen_id,
               chr(64 + r),
               n,
               chr(64 + r) || n::text,
               CASE
                   WHEN sc.screen_type = 'VIP' THEN 'VIP'
                   WHEN r > n_rows - 2 AND n BETWEEN (n_seats / 2 - 1) AND (n_seats / 2 + 2) THEN 'VIP'
                   ELSE 'STANDARD'
               END
        FROM generate_series(1, n_rows) AS r
        CROSS JOIN generate_series(1, n_seats) AS n;

        INSERT INTO seats (screen_id, row_label, seat_number, seat_label, seat_type)
        VALUES (sc.screen_id, 'W', 1, 'W1', 'WHEELCHAIR'),
               (sc.screen_id, 'W', 2, 'W2', 'WHEELCHAIR');

        UPDATE screens
        SET capacity = (SELECT COUNT(*) FROM seats WHERE screen_id = sc.screen_id)
        WHERE screen_id = sc.screen_id;
    END LOOP;
END $$;


-- 3. Ticket prices (copied from Accra Mall's cinema-wide prices) ---

INSERT INTO ticket_prices (cinema_id, screen_id, price_name, ticket_type, amount, currency, day_type, start_time, end_time, is_active)
SELECT wh.cinema_id, NULL, p.price_name, p.ticket_type, p.amount, p.currency, p.day_type, p.start_time, p.end_time, p.is_active
FROM ticket_prices p
JOIN cinemas am ON am.cinema_id = p.cinema_id AND am.cinema_name ILIKE '%Accra Mall%'
CROSS JOIN (SELECT cinema_id FROM cinemas WHERE cinema_name ILIKE '%West Hills%' ORDER BY cinema_id LIMIT 1) wh
WHERE p.screen_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM ticket_prices x WHERE x.cinema_id = wh.cinema_id);


-- 4. Sample weekly events at West Hills too ------------------------

DO $$
BEGIN
    IF to_regclass('public.cinema_events') IS NOT NULL THEN
        INSERT INTO cinema_events (cinema_id, title, summary, details, tag, weekday, start_time, ends_on, movie_id, sort_order, is_active)
        SELECT wh.cinema_id, e.title, e.summary, e.details, e.tag, e.weekday, e.start_time, e.ends_on, e.movie_id, e.sort_order, e.is_active
        FROM cinema_events e
        JOIN cinemas am ON am.cinema_id = e.cinema_id AND am.cinema_name ILIKE '%Accra Mall%'
        CROSS JOIN (SELECT cinema_id FROM cinemas WHERE cinema_name ILIKE '%West Hills%' ORDER BY cinema_id LIMIT 1) wh
        WHERE e.weekday IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM cinema_events x WHERE x.cinema_id = wh.cinema_id AND x.title = e.title);
    END IF;
END $$;
