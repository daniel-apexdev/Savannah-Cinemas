-- ============================================================
-- SAVANNAH CINEMAS - SPECIAL SCREENINGS (older films come back)
-- 2026-11-23_special_screenings.sql
--
-- special_programmes   recurring nights for catalogue films whose run
--                      has ended, with a discount on every seat.
-- special_screenings   which showtimes belong to a programme (and the
--                      discount they were sold at).
--
-- weekday is ISO: 1 = Monday ... 7 = Sunday.
-- start_times is a comma list of HH:MM.
-- min_age_years: prefer films at least this old (falls back to any
-- ended film if the catalogue has none that old).
--
-- The showtime generator (npm run showtimes:generate, or the 6-hourly
-- job) programmes these first and fits regular shows around them.
-- To change a night, edit its row; to pause one, set is_active = 'N'.
-- Safe to run more than once.
-- ============================================================

CREATE TABLE IF NOT EXISTS special_programmes (
    code             VARCHAR(40)  PRIMARY KEY,
    name             VARCHAR(80)  NOT NULL,
    tagline          VARCHAR(200),
    weekday          SMALLINT     NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_times      VARCHAR(60)  NOT NULL,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    min_age_years    SMALLINT     NOT NULL DEFAULT 0,
    sort_order       INT          NOT NULL DEFAULT 0,
    is_active        CHAR(1)      NOT NULL DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP
);

CREATE TABLE IF NOT EXISTS special_screenings (
    showtime_id      BIGINT       PRIMARY KEY REFERENCES showtimes(showtime_id) ON DELETE CASCADE,
    programme_code   VARCHAR(40)  NOT NULL REFERENCES special_programmes(code) ON UPDATE CASCADE,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_special_screenings_programme ON special_screenings (programme_code);

INSERT INTO special_programmes (code, name, tagline, weekday, start_times, discount_percent, min_age_years, sort_order)
VALUES
    ('THROWBACK_THURSDAY', 'Throwback Thursday',
     'A favourite from the Savannah catalogue, back on the big screen.',
     4, '19:30', 30, 2, 1),
    ('BARGAIN_TUESDAY', 'Bargain Tuesday',
     'Half-price tickets for a film you missed, matinee and evening.',
     2, '13:00,18:00', 50, 0, 2)
ON CONFLICT (code) DO NOTHING;
