-- =====================================================
    -- Populate_Date_Dimension
    -- =====================================================
    PROCEDURE Populate_Date_Dimension (
    p_start_date IN DATE,
    p_end_date   IN DATE
) AS
	v_current_date	 DATE;
    v_start_date   	 DATE := p_start_date;
    v_end_date       DATE := TRUNC(p_end_date);
    v_current_year   NUMBER(4);
    v_is_leap        NUMBER(1);
    v_is_holiday     NUMBER(1);
	v_is_weekend	 NUMBER(1);
    v_holiday_id     NUMBER;
    v_row_count      NUMBER := 0;
    v_year_count     NUMBER := 0;
    v_error_msg      VARCHAR2(4000);
	
BEGIN
    -- Validate date range
    IF v_start_date > v_end_date THEN
        RAISE_APPLICATION_ERROR(-20002, 'Start date must be earlier than or equal to end date.');
    END IF;

    DBMS_OUTPUT.PUT_LINE('Populating DIM_DATE from ' || TO_CHAR(p_start_date, 'DD/MM/YYYY') || 
                         ' to ' || TO_CHAR(p_end_date, 'DD/MM/YYYY'));

    -- Clear existing data
    BEGIN
        EXECUTE IMMEDIATE 'TRUNCATE TABLE DIM_DATE REUSE STORAGE';
        DBMS_OUTPUT.PUT_LINE('DIM_DATE truncated successfully.');
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('TRUNCATE failed: ' || SUBSTR(SQLERRM, 1, 200));
            COMMIT;
    END;

	v_current_date := TRUNC(p_start_date);
    v_current_year := TO_NUMBER(TO_CHAR(v_current_date, 'YYYY'));
	
	-- Pre-calculate leap year for the first year
    IF  (MOD(v_current_year, 400) = 0)
     OR (MOD(v_current_year, 4)   = 0
     AND MOD(v_current_year, 100) != 0) THEN
        v_is_leap := 1;
    ELSE
        v_is_leap := 0;
    END IF;

    -- Loop through each day
    WHILE v_start_date <= v_end_date LOOP
    
        -- Only recalculate leap year when year changes (optimization)
        IF TO_NUMBER(TO_CHAR(v_start_date, 'YYYY')) != v_current_year THEN
            v_current_year := TO_NUMBER(TO_CHAR(v_current_date, 'YYYY'));
        END IF;

        -- Determine leap year (once per year)
        IF (MOD(v_current_year, 400) = 0)
           OR (MOD(v_current_year, 4) = 0 AND MOD(v_current_year, 100) != 0) THEN
            v_is_leap := 1;
        ELSE
            v_is_leap := 0;
        END IF;
		
		--Weekend check here
		IF TO_NUMBER(TO_CHAR(v_start_date, 'D')) IN (6, 7) THEN
            v_is_weekend := 1;
        ELSE
            v_is_weekend := 0;
        END IF;

        -- Check if holiday
        v_is_holiday := 0;
        v_holiday_id := NULL;

        BEGIN
            SELECT HOLIDAY_ID
            INTO v_holiday_id
            FROM HOLIDAYS
            WHERE HOLIDAY_DATE = TO_CHAR(v_current_date, 'DD-MM')
              AND ROWNUM = 1;

            v_is_holiday := 1;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                NULL;
        END;

        -- Insert the row
        BEGIN
            INSERT INTO DIM_DATE (
                YEAR
				,MONTH
				,DAY
				,FULL_DATE
				,MONTH_NAME
				,QTR
				,DAY_OF_WEEK
				,DAY_IN_WEEK
				,DAY_IN_YEAR
				,WEEK_IN_MONTH
				,WEEK_IN_YEAR
				,IS_WEEKEND
				,IS_LEAP_YEAR
				,IS_HOLIDAY
				,HOLIDAY_ID
            ) VALUES (
                TO_CHAR(v_start_date, 'YYYY')
                ,TO_CHAR(v_start_date, 'MM')
                ,TO_CHAR(v_start_date, 'DD')
                ,v_start_date
                ,TRIM(TO_CHAR(v_start_date, 'Month'))
                ,TO_CHAR(v_start_date, 'Q')
                ,TRIM(TO_CHAR(v_start_date, 'Day'))
                ,TO_CHAR(v_start_date, 'D')
                ,TO_CHAR(v_start_date, 'DDD')
                ,TO_CHAR(v_start_date, 'W')
                ,TO_CHAR(v_start_date, 'IW')
				,v_is_weekend
                ,v_is_leap 
                ,v_is_holiday 
                ,v_holiday_id
            );
            
            v_row_count := v_row_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_error_msg := 'Error inserting date ' || TO_CHAR(v_start_date, 'DD/MM/YYYY') || ': ' || SQLERRM;
                DBMS_OUTPUT.PUT_LINE(v_error_msg);
                -- Continue with next date instead of failing entirely
        END;

        -- Move to next day
        v_start_date := v_start_date + 1;

        -- COMMIT AFTER EACH YEAR (365/366 rows at a time)
        IF TO_NUMBER(TO_CHAR(v_start_date, 'DD')) = 1 AND TO_NUMBER(TO_CHAR(v_start_date, 'MM')) = 1 THEN
            COMMIT;
            v_year_count := v_year_count + 1;
            DBMS_OUTPUT.PUT_LINE('Year ' || TO_CHAR(v_start_date - 1, 'YYYY') || 
                                 ' committed. Running total: ' || v_row_count || ' rows.');
        END IF;
        
    END LOOP;

    -- Final commit for the last partial year
    COMMIT;
    
    DBMS_OUTPUT.PUT_LINE('========================================');
    DBMS_OUTPUT.PUT_LINE('DIM_DATE population complete.');
    DBMS_OUTPUT.PUT_LINE('Total years processed: ' || v_year_count);
    DBMS_OUTPUT.PUT_LINE('Total rows inserted: ' || v_row_count);
    DBMS_OUTPUT.PUT_LINE('========================================');
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('ERROR: ' || SQLERRM);
        RAISE;
END Populate_Date_Dimension;

    -- =====================================================
    -- Populate_Time_Dimension
    -- =====================================================
    PROCEDURE Populate_Time_Dimension AS
        hrs          DIM_TIME.HOUR_24%TYPE;
        mins         DIM_TIME.MINUTE_NUMBER%TYPE;
        secs         DIM_TIME.SECOND_NUMBER%TYPE;
        v_full_time  DIM_TIME.FULL_TIME%TYPE;
        hr_counter   PLS_INTEGER;
        mins_counter PLS_INTEGER;
        secs_counter PLS_INTEGER;
    BEGIN
        EXECUTE IMMEDIATE 'TRUNCATE TABLE DIM_TIME REUSE STORAGE';

        FOR hr_counter IN 0..23 LOOP
            FOR mins_counter IN 0..59 LOOP
                FOR secs_counter IN 0..59 LOOP
                    hrs := hr_counter;
                    mins := mins_counter;
                    secs := secs_counter;

                    v_full_time := LPAD(hrs, 2, '0') || ':' || 
                                   LPAD(mins, 2, '0') || ':' || 
                                   LPAD(secs, 2, '0');

                    INSERT INTO DIM_TIME (
                        FULL_TIME,
                        HOUR_24,
                        MINUTE_NUMBER,
                        SECOND_NUMBER
                    ) VALUES (
                        v_full_time,
                        hrs,
                        mins,
                        secs
                    );
                END LOOP;
            END LOOP;
        END LOOP;

        COMMIT;
        DBMS_OUTPUT.PUT_LINE('DIM_TIME populated successfully. Total rows inserted.');
    EXCEPTION
        WHEN OTHERS THEN
            ROLLBACK;
            RAISE_APPLICATION_ERROR(-20000, 'Error populating DIM_TIME: ' || SUBSTR(SQLERRM, 1, 100));
    END Populate_Time_Dimension;


-- ============================================================
-- SEQUENCES FOR ALL DIMENSIONS
-- ============================================================
CREATE SEQUENCE seq_dim_date START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_time START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_genre START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_channel START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_payment START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_cert START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_tier START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_age_group START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_geo START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_device START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_movie_status START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_showtime START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_branch START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_supplier START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_screen START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_seat START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_employee START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_product START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_promotion START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_event START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_movie START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE seq_dim_customer START WITH 1 INCREMENT BY 1 NOCACHE;