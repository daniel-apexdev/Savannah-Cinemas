-- ============================================================
-- SAVANNAH CINEMAS - SCREEN CAPACITY MATCHES THE SEAT PLAN
-- 2026-11-24_screen_capacity.sql
--
-- The setup script created Accra Mall Screen 1 with capacity 10 but
-- 52 seats, so its capacity was wrong. This sets every screen's
-- capacity to the number of active seats in its seat plan.
-- Screens with no seats are left alone.
--
-- Safe to run more than once.
-- ============================================================

UPDATE screens s
SET capacity = c.seats
FROM (
    SELECT screen_id, COUNT(*)::int AS seats
    FROM seats
    WHERE is_active = 'Y'
    GROUP BY screen_id
) c
WHERE c.screen_id = s.screen_id
  AND s.capacity IS DISTINCT FROM c.seats;
