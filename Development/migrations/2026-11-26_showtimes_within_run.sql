-- ============================================================
-- SAVANNAH CINEMAS - SHOWTIMES ONLY FOR FILMS IN THEIR RUN
-- 2026-11-26_showtimes_within_run.sql
--
-- A film only has regular showtimes while it's out: from its release
-- date (so upcoming films get advance sales from opening day) to the
-- end of its run. Older films come back only as special screenings
-- (Throwback Thursday, Bargain Tuesday) or when a manager sets their
-- run by hand.
--
-- Until now the daily TMDB sync extended the run of ANY film TMDB
-- listed as "now playing", including anniversary re-releases of old
-- films (The Hunger Games, Catching Fire, Dune...), so they were back
-- on the Now Showing shelf with showtimes. The sync now only extends
-- recent releases (services/catalogSync.js). This migration:
--   1. marks showtimes the generator made (showtimes.auto_generated),
--      so tidying up never touches shows added by hand;
--   2. adds prune_showtimes_outside_run(), which the generator calls on
--      every run: generated, unbooked, future shows outside their
--      film's run come off sale (specials are never touched);
--   3. puts right films whose run was stretched by a re-release
--      (released more than 120 days ago), then prunes.
--
-- Safe to run more than once.
-- ============================================================

-- 1. Which showtimes the generator made
ALTER TABLE showtimes
    ADD COLUMN IF NOT EXISTS auto_generated CHAR(1) NOT NULL DEFAULT 'N';

ALTER TABLE showtimes DROP CONSTRAINT IF EXISTS ck_showtimes_auto_generated;
ALTER TABLE showtimes
    ADD CONSTRAINT ck_showtimes_auto_generated CHECK (auto_generated IN ('Y', 'N'));

-- Every showtime so far came from the generator (specials have their
-- own table). Only done the first time, so later hand-made shows keep 'N'.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM showtimes WHERE auto_generated = 'Y') THEN
        UPDATE showtimes st
           SET auto_generated = 'Y'
         WHERE NOT EXISTS (SELECT 1 FROM special_screenings ss WHERE ss.showtime_id = st.showtime_id);
    END IF;
END $$;


-- 2. Take generated shows outside their film's run off sale
CREATE OR REPLACE FUNCTION prune_showtimes_outside_run(
    p_cinema_id    BIGINT  DEFAULT NULL,
    p_lead_minutes INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM showtimes st
     USING movies m
     WHERE m.movie_id = st.movie_id
       AND st.auto_generated = 'Y'
       AND st.start_time > LOCALTIMESTAMP + make_interval(mins => COALESCE(p_lead_minutes, 0))
       AND (p_cinema_id IS NULL OR st.cinema_id = p_cinema_id)
       AND (
              m.status = 'ARCHIVED'
           OR m.release_date IS NULL
           OR st.show_date < m.release_date
           OR st.show_date > movie_run_end(m.release_date, m.run_ends_on)
       )
       AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.showtime_id = st.showtime_id)
       AND NOT EXISTS (SELECT 1 FROM special_screenings ss WHERE ss.showtime_id = st.showtime_id);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


-- 3. Old films the sync kept "now showing": back to their normal run
--    (which ended long ago), so they're ENDED and in the specials pool.
UPDATE movies
   SET run_ends_on = NULL
 WHERE run_ends_on IS NOT NULL
   AND release_date < CURRENT_DATE - 120
   AND status <> 'ARCHIVED';

SELECT refresh_movie_statuses() AS films_updated;
SELECT prune_showtimes_outside_run() AS showtimes_removed;
