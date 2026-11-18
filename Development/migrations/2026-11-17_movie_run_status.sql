-- ============================================================
-- Savannah Cinemas - film status by run length
-- Safe to run more than once.
--
-- Before: calculate_movie_status() used the calendar YEAR. Every
-- film released in an earlier year became ENDED (so on 1 January
-- the whole programme would drop out), and statuses only changed
-- when a row's release_date was edited, so UPCOMING films never
-- turned NOW_SHOWING on their release day by themselves.
--
-- Now:
--   UPCOMING     release_date is unknown or still in the future
--   NOW_SHOWING  from release_date until the end of its run
--   ENDED        after the run
--   ARCHIVED     set by hand, never changed automatically
--
--   Run end = movies.run_ends_on if set (extend a hit, or pull a
--   film early), else release_date + movie_run_weeks weeks - 1 day.
--   movie_run_weeks lives in app_settings (default 12).
--
-- refresh_movie_statuses() brings every film up to date; the
-- backend calls it at start-up and hourly
-- (backend/services/movieStatus.js).
-- ============================================================


-- ------------------------------------------------------------
-- 1. Settings
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key   VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(500) NOT NULL,
    description   VARCHAR(500),
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO app_settings (setting_key, setting_value, description) VALUES
    ('movie_run_weeks', '12',
     'Weeks a film stays NOW_SHOWING after its release date, unless movies.run_ends_on is set')
ON CONFLICT (setting_key) DO NOTHING;


-- ------------------------------------------------------------
-- 2. Per-film override of the run's last day
-- ------------------------------------------------------------

ALTER TABLE movies
    ADD COLUMN IF NOT EXISTS run_ends_on DATE;

ALTER TABLE movies
    DROP CONSTRAINT IF EXISTS ck_movies_run_ends;

ALTER TABLE movies
    ADD CONSTRAINT ck_movies_run_ends
    CHECK (run_ends_on IS NULL OR release_date IS NULL OR run_ends_on >= release_date);


-- ------------------------------------------------------------
-- 3. The rule
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION movie_run_weeks()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        (SELECT setting_value::INTEGER
           FROM app_settings
          WHERE setting_key = 'movie_run_weeks'
            AND setting_value ~ '^[0-9]{1,3}$'),
        12
    );
$$;


-- Last day a film is NOW_SHOWING (NULL if the release date is unknown)
CREATE OR REPLACE FUNCTION movie_run_end(p_release_date DATE, p_run_ends_on DATE)
RETURNS DATE
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN p_release_date IS NULL THEN NULL
        ELSE COALESCE(p_run_ends_on, p_release_date + (movie_run_weeks() * 7 - 1))
    END;
$$;


-- Status of a film on a given day
CREATE OR REPLACE FUNCTION movie_status_on(p_release_date DATE, p_run_ends_on DATE, p_on DATE)
RETURNS VARCHAR
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN p_release_date IS NULL OR p_release_date > p_on THEN 'UPCOMING'
        WHEN p_on <= movie_run_end(p_release_date, p_run_ends_on) THEN 'NOW_SHOWING'
        ELSE 'ENDED'
    END;
$$;


-- Kept for anything that still calls the old one-argument version
CREATE OR REPLACE FUNCTION calculate_movie_status(p_release_date DATE)
RETURNS VARCHAR
LANGUAGE sql
STABLE
AS $$
    SELECT movie_status_on(p_release_date, NULL, CURRENT_DATE);
$$;


-- ------------------------------------------------------------
-- 4. Trigger: recalculate whenever the dates (or status) are written,
--    except for films archived by hand
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_movies_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'ARCHIVED' THEN
        RETURN NEW;
    END IF;

    NEW.status := movie_status_on(NEW.release_date, NEW.run_ends_on, CURRENT_DATE);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movies_status ON movies;

CREATE TRIGGER trg_movies_status
    BEFORE INSERT OR UPDATE OF release_date, run_ends_on, status
    ON movies
    FOR EACH ROW
    EXECUTE FUNCTION trg_movies_status();


-- ------------------------------------------------------------
-- 5. Bring every film up to date (called hourly by the backend)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION refresh_movie_statuses()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_changed INTEGER;
BEGIN
    UPDATE movies
       SET status = movie_status_on(release_date, run_ends_on, CURRENT_DATE)
     WHERE status <> 'ARCHIVED'
       AND status IS DISTINCT FROM movie_status_on(release_date, run_ends_on, CURRENT_DATE);

    GET DIAGNOSTICS v_changed = ROW_COUNT;
    RETURN v_changed;
END;
$$;

SELECT refresh_movie_statuses() AS films_updated;
