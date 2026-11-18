-- ============================================================
-- SAVANNAH CINEMAS - MORE SCREENS, SEAT PLANS, ACCRA MALL
-- 2026-11-19_screens_and_location.sql
--
-- 1. The Accra cinema's address is Accra Mall (used by Directions,
--    Help and the confirmation email).
-- 2. Screens 3 and 4, so films can play on two or three screens.
-- 3. A seat plan for any screen that has none. Screen 2 (VIP) was
--    created by the setup script without seats, so its shows
--    couldn't be booked.
--
-- Safe to run more than once: nothing is duplicated, and screens
-- that already have seats are left alone.
-- ============================================================


-- 1. Address ----------------------------------------------------

UPDATE cinemas
SET address    = 'Accra Mall, Plot C11, Tetteh Quarshie Interchange, Spintex Road',
    city       = 'Accra',
    region     = 'Greater Accra',
    updated_at = CURRENT_TIMESTAMP
WHERE cinema_name ILIKE '%Accra%'
  AND COALESCE(address, '') NOT ILIKE '%Accra Mall%';


-- 2. Screens 3 and 4 ---------------------------------------------

INSERT INTO screens (cinema_id, screen_name, screen_number, capacity, screen_type, sound_system)
SELECT c.cinema_id, s.name, s.num, 1, 'STANDARD', s.sound
FROM cinemas c
CROSS JOIN (VALUES
    ('Screen 3', 3, 'Dolby Digital'),
    ('Screen 4', 4, 'Dolby Digital')
) AS s(name, num, sound)
WHERE c.cinema_name ILIKE '%Accra%'
ON CONFLICT (cinema_id, screen_number) DO NOTHING;


-- 3. Seat plans for screens without seats -----------------------
--    VIP screen:      rows A-D x 8, all VIP, + 2 wheelchair spaces
--    Standard screen: rows A-H x 12 (Screen 3) or A-F x 10 (others),
--                     the two back rows' centre seats VIP,
--                     + 2 wheelchair spaces

DO $$
DECLARE
    sc RECORD;
    n_rows INT;
    n_seats INT;
BEGIN
    FOR sc IN
        SELECT s.screen_id, s.screen_number, UPPER(COALESCE(s.screen_type, '')) AS screen_type
        FROM screens s
        WHERE s.is_active = 'Y'
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
