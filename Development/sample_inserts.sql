-- Branches (Ghana context)
INSERT INTO dim_branch (branch_sk, branch_id, branch_name, address_line1, city, region, country, mall_name, number_of_screens, total_capacity, opening_date, status, timezone, currency_code)
VALUES (seq_branch_sk.NEXTVAL, 'BR001', 'Accra Mall Cinema', 'Accra Mall, Spintex Road', 'Accra', 'Greater Accra', 'Ghana', 'Accra Mall', 8, 1200, DATE '2020-01-15', 'Active', 'Africa/Accra', 'GHS');

INSERT INTO dim_branch (branch_sk, branch_id, branch_name, address_line1, city, region, country, mall_name, number_of_screens, total_capacity, opening_date, status, timezone, currency_code)
VALUES (seq_branch_sk.NEXTVAL, 'BR002', 'Kumasi City Cinema', 'Kumasi City Mall, Lake Road', 'Kumasi', 'Ashanti', 'Ghana', 'Kumasi City Mall', 6, 850, DATE '2021-06-20', 'Active', 'Africa/Accra', 'GHS');

INSERT INTO dim_branch (branch_sk, branch_id, branch_name, address_line1, city, region, country, mall_name, number_of_screens, total_capacity, opening_date, status, timezone, currency_code)
VALUES (seq_branch_sk.NEXTVAL, 'BR003', 'Tema Shopping Cinema', 'Tema Community 25, Industrial Area', 'Tema', 'Greater Accra', 'Ghana', 'Tema Shopping Centre', 4, 500, DATE '2022-11-10', 'Active', 'Africa/Accra', 'GHS');

-- Screen (for each branch)
INSERT INTO dim_screen (screen_sk, screen_id, branch_sk, screen_number, screen_type, is_imax, is_dolby_atmos, is_vip, is_3d, capacity, projection_type, status)
SELECT seq_screen_sk.NEXTVAL, 'SCR' || LPAD(ROWNUM, 3, '0'), b.branch_sk, 'Screen ' || ROWNUM, 
       CASE WHEN ROWNUM = 1 THEN 'IMAX' ELSE 'Standard' END,
       CASE WHEN ROWNUM = 1 THEN 'Y' ELSE 'N' END,
       CASE WHEN ROWNUM <= 2 THEN 'Y' ELSE 'N' END,
       CASE WHEN ROWNUM = 3 THEN 'Y' ELSE 'N' END,
       CASE WHEN ROWNUM <= 2 THEN 'Y' ELSE 'N' END,
       CASE WHEN ROWNUM = 1 THEN 300 WHEN ROWNUM = 2 THEN 200 ELSE 150 END,
       'Digital', 'Active'
FROM dim_branch b, (SELECT LEVEL AS rn FROM DUAL CONNECT BY LEVEL <= 8) 
WHERE rn <= b.number_of_screens;

-- Seats (Generate A01 to J20 for each screen)
BEGIN
    FOR scr IN (SELECT screen_sk, capacity FROM dim_screen) LOOP
        FOR row_num IN 1 .. 10 LOOP  -- A to J
            FOR seat_num IN 1 .. LEAST(20, scr.capacity / 10) LOOP
                INSERT INTO dim_seat (seat_sk, seat_id, screen_sk, row_letter, seat_number, seat_type, is_wheelchair_accessible, is_accessible_aisle, is_premium, price_tier, status)
                VALUES (
                    seq_seat_sk.NEXTVAL,
                    CHR(64 + row_num) || LPAD(seat_num, 2, '0'),
                    scr.screen_sk,
                    CHR(64 + row_num),
                    seat_num,
                    CASE WHEN row_num <= 2 THEN 'Premium' ELSE 'Standard' END,
                    'N',
                    CASE WHEN seat_num = 1 THEN 'Y' ELSE 'N' END,
                    CASE WHEN row_num <= 2 THEN 'Y' ELSE 'N' END,
                    CASE WHEN row_num <= 2 THEN 'Premium' ELSE 'Standard' END,
                    'Active'
                );
            END LOOP;
        END LOOP;
    END LOOP;
    COMMIT;
END;
/

-- Movies
INSERT INTO dim_movie (movie_sk, movie_id, title, genre, language, duration_minutes, release_year, studio, distributor, rating, director, is_foreign, is_animated)
SELECT seq_movie_sk.NEXTVAL, 'MOV001', 'Black Panther: Wakanda Forever', 'Action', 'English', 161, 2022, 'Marvel Studios', 'Walt Disney', 'PG-13', 'Ryan Coogler', 'N', 'N' FROM DUAL UNION ALL
SELECT seq_movie_sk.NEXTVAL, 'MOV002', 'Avatar: The Way of Water', 'Sci-Fi', 'English', 192, 2022, '20th Century Studios', 'Walt Disney', 'PG-13', 'James Cameron', 'N', 'N' FROM DUAL UNION ALL
SELECT seq_movie_sk.NEXTVAL, 'MOV003', 'Spider-Man: No Way Home', 'Action', 'English', 148, 2021, 'Marvel Studios', 'Sony', 'PG-13', 'Jon Watts', 'N', 'N' FROM DUAL UNION ALL
SELECT seq_movie_sk.NEXTVAL, 'MOV004', 'The Woman King', 'Drama', 'English', 135, 2022, 'TriStar Pictures', 'Sony', 'R', 'Gina Prince-Bythewood', 'N', 'N' FROM DUAL UNION ALL
SELECT seq_movie_sk.NEXTVAL, 'MOV005', 'Top Gun: Maverick', 'Action', 'English', 131, 2022, 'Skydance Media', 'Paramount', 'PG-13', 'Joseph Kosinski', 'N', 'N' FROM DUAL UNION ALL
SELECT seq_movie_sk.NEXTVAL, 'MOV006', 'Puss in Boots: The Last Wish', 'Animation', 'English', 102, 2022, 'DreamWorks', 'Universal', 'PG', 'Joel Crawford', 'N', 'Y' FROM DUAL UNION ALL
SELECT seq_movie_sk.NEXTVAL, 'MOV007', 'The Flash', 'Action', 'English', 144, 2023, 'DC Studios', 'Warner Bros', 'PG-13', 'Andy Muschietti', 'N', 'N' FROM DUAL UNION ALL
SELECT seq_movie_sk.NEXTVAL, 'MOV008', 'Barbie', 'Comedy', 'English', 114, 2023, 'Warner Bros', 'Warner Bros', 'PG-13', 'Greta Gerwig', 'N', 'N' FROM DUAL;

-- Events (Map movies to events)
INSERT INTO dim_event (event_sk, event_id, event_type, content_id, event_name, event_category, age_rating, content_duration)
SELECT seq_event_sk.NEXTVAL, 'E' || movie_id, 'Movie', movie_id, title, genre, rating, duration_minutes
FROM dim_movie;

-- Payment Methods
INSERT INTO dim_payment (payment_sk, payment_id, payment_type, is_digital, settlement_days, status)
SELECT seq_payment_sk.NEXTVAL, 'PAY_CASH', 'Cash', 'N', 0, 'Active' FROM DUAL UNION ALL
SELECT seq_payment_sk.NEXTVAL, 'PAY_VISA', 'Credit Card', 'Y', 2, 'Active' FROM DUAL UNION ALL
SELECT seq_payment_sk.NEXTVAL, 'PAY_MOMO', 'Mobile Money', 'Y', 1, 'Active' FROM DUAL UNION ALL
SELECT seq_payment_sk.NEXTVAL, 'PAY_GHANA', 'Debit Card', 'Y', 1, 'Active' FROM DUAL;

-- Channels
INSERT INTO dim_channel (channel_sk, channel_id, channel_type, booking_fee_applied)
SELECT seq_channel_sk.NEXTVAL, 'CHN_ONLINE', 'Online Web', 2.50 FROM DUAL UNION ALL
SELECT seq_channel_sk.NEXTVAL, 'CHN_APP', 'Mobile App', 2.00 FROM DUAL UNION ALL
SELECT seq_channel_sk.NEXTVAL, 'CHN_BOX', 'Box Office', 0.00 FROM DUAL UNION ALL
SELECT seq_channel_sk.NEXTVAL, 'CHN_KIOSK', 'Kiosk', 0.50 FROM DUAL;

-- Promotions
INSERT INTO dim_promotion (promotion_sk, promotion_id, promotion_name, promotion_type, discount_value, is_percentage, start_date, end_date, is_active)
SELECT seq_promotion_sk.NEXTVAL, 'PROMO_STU', 'Student Discount', 'Percentage', 10.00, 'Y', DATE '2024-01-01', DATE '2025-12-31', 'Y' FROM DUAL UNION ALL
SELECT seq_promotion_sk.NEXTVAL, 'PROMO_FAM', 'Family Pack (4+)', 'Percentage', 15.00, 'Y', DATE '2024-01-01', DATE '2025-12-31', 'Y' FROM DUAL UNION ALL
SELECT seq_promotion_sk.NEXTVAL, 'PROMO_BF', 'Black Friday', 'Percentage', 25.00, 'Y', DATE '2024-11-20', DATE '2024-11-30', 'Y' FROM DUAL;

-- Employees (Minimal)
INSERT INTO dim_employee (employee_sk, employee_id, branch_sk, first_name, last_name, hire_date, role, is_active)
SELECT seq_employee_sk.NEXTVAL, 'EMP001', (SELECT branch_sk FROM dim_branch WHERE branch_id='BR001'), 'John', 'Doe', DATE '2023-01-01', 'Manager', 'Y' FROM DUAL UNION ALL
SELECT seq_employee_sk.NEXTVAL, 'EMP002', (SELECT branch_sk FROM dim_branch WHERE branch_id='BR001'), 'Jane', 'Smith', DATE '2023-02-01', 'Cashier', 'Y' FROM DUAL UNION ALL
SELECT seq_employee_sk.NEXTVAL, 'EMP003', (SELECT branch_sk FROM dim_branch WHERE branch_id='BR002'), 'Kwame', 'Mensah', DATE '2023-03-01', 'Manager', 'Y' FROM DUAL;

-- Products (Concessions)
INSERT INTO dim_product (product_sk, product_id, product_name, product_category, unit_cost, selling_price, par_level, reorder_point, lead_time_days, is_perishable)
SELECT seq_product_sk.NEXTVAL, 'PROD_POP', 'Popcorn (Regular)', 'Popcorn', 5.00, 15.00, 500, 200, 3, 'Y' FROM DUAL UNION ALL
SELECT seq_product_sk.NEXTVAL, 'PROD_POPB', 'Popcorn (Butter)', 'Popcorn', 6.00, 18.00, 400, 150, 3, 'Y' FROM DUAL UNION ALL
SELECT seq_product_sk.NEXTVAL, 'PROD_COKE', 'Coca-Cola (Large)', 'Beverages', 3.00, 8.00, 800, 300, 2, 'Y' FROM DUAL UNION ALL
SELECT seq_product_sk.NEXTVAL, 'PROD_NACHO', 'Nachos with Cheese', 'Snacks', 4.00, 12.00, 300, 100, 4, 'Y' FROM DUAL UNION ALL
SELECT seq_product_sk.NEXTVAL, 'PROD_HOTD', 'Hot Dog', 'Hot Dogs', 6.00, 18.00, 200, 80, 2, 'Y' FROM DUAL;

-- Generate 200 random customers (natural keys)
BEGIN
    FOR i IN 1..200 LOOP
        INSERT INTO dim_customer (
            customer_sk, customer_id, first_name, last_name, email, phone, gender,
            date_of_birth, age_group, occupation, city, region, country,
            membership_tier, join_date, favorite_genre,
            effective_start_date, effective_end_date, is_current,
            created_date, last_modified_date, modified_by
        ) VALUES (
            seq_customer_sk.NEXTVAL,
            'CUST' || LPAD(i, 5, '0'),
            CASE MOD(i, 4) WHEN 0 THEN 'Kwame' WHEN 1 THEN 'Ama' WHEN 2 THEN 'Kojo' ELSE 'Esi' END,
            CASE MOD(i, 5) WHEN 0 THEN 'Asante' WHEN 1 THEN 'Mensah' WHEN 2 THEN 'Adjei' WHEN 3 THEN 'Owusu' ELSE 'Appiah' END,
            'cust' || i || '@example' || MOD(i,3) || '.com',
            '024' || LPAD(TRUNC(DBMS_RANDOM.VALUE(1000000,9999999)), 7, '0'),
            CASE MOD(i,3) WHEN 0 THEN 'M' WHEN 1 THEN 'F' ELSE 'O' END,
            TRUNC(SYSDATE) - TRUNC(DBMS_RANDOM.VALUE(6570, 21915)), -- 18-60 years old
            NULL,
            CASE MOD(i,5) WHEN 0 THEN 'Student' WHEN 1 THEN 'Teacher' WHEN 2 THEN 'Engineer' WHEN 3 THEN 'Doctor' ELSE 'Business' END,
            CASE MOD(i,4) WHEN 0 THEN 'Accra' WHEN 1 THEN 'Kumasi' WHEN 2 THEN 'Tema' ELSE 'Takoradi' END,
            CASE MOD(i,3) WHEN 0 THEN 'Greater Accra' WHEN 1 THEN 'Ashanti' ELSE 'Western' END,
            'Ghana',
            CASE MOD(i,4) WHEN 0 THEN 'Silver' WHEN 1 THEN 'Gold' WHEN 2 THEN 'Platinum' ELSE 'Bronze' END,
            TRUNC(SYSDATE) - TRUNC(DBMS_RANDOM.VALUE(1, 365)),
            CASE MOD(i,3) WHEN 0 THEN 'Action' WHEN 1 THEN 'Comedy' ELSE 'Drama' END,
            TRUNC(SYSDATE) - TRUNC(DBMS_RANDOM.VALUE(1, 365)), -- effective start (joined recently or long ago)
            TO_DATE('31-DEC-9999', 'DD-MON-YYYY'),
            'Y',
            SYSDATE, SYSDATE, 'SYSTEM'
        );
    END LOOP;
    COMMIT;
END;
/



-- ============================================================
-- SEED: DIM_GENRE
-- ============================================================
INSERT INTO dim_genre (genre_sk, genre_id, genre_code, genre_name, genre_description, tmdb_genre_id, genre_category, display_order, is_active, created_date, last_modified_date) VALUES
(seq_dim_genre.NEXTVAL, 'GEN001', 'ACT', 'Action', 'High-octane action sequences, fights, and stunts', 28, 'ACTION', 1, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN002', 'ADV', 'Adventure', 'Heroic journeys, exploration, and discovery', 12, 'ACTION', 2, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN003', 'ANI', 'Animation', 'Animated films featuring hand-drawn or CGI art', 16, 'ANIMATION', 3, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN004', 'COM', 'Comedy', 'Humorous films designed to make audiences laugh', 35, 'COMEDY', 4, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN005', 'CRI', 'Crime', 'Criminal activities, investigations, and the underworld', 80, 'DRAMA', 5, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN006', 'DOC', 'Documentary', 'Factual films documenting real-world events', 99, 'DOCUMENTARY', 6, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN007', 'DRA', 'Drama', 'Character-driven narratives focusing on realistic themes', 18, 'DRAMA', 7, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN008', 'FAM', 'Family', 'Films suitable for family audiences and children', 10751, 'OTHER', 8, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN009', 'FAN', 'Fantasy', 'Magical worlds, mythical creatures, and supernatural elements', 14, 'FANTASY', 9, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN010', 'HIS', 'History', 'Historical events and periods', 36, 'DRAMA', 10, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN011', 'HOR', 'Horror', 'Designed to scare, shock, and create fear', 27, 'HORROR', 11, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN012', 'MUS', 'Music', 'Featuring music, musical performances, or musicals', 10402, 'OTHER', 12, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN013', 'MYS', 'Mystery', 'Enigmatic plots, puzzles, and whodunits', 9648, 'THRILLER', 13, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN014', 'ROM', 'Romance', 'Love stories, relationships, and romantic drama', 10749, 'ROMANCE', 14, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN015', 'SCI', 'Science Fiction', 'Futuristic technology, space exploration, and sci-fi concepts', 878, 'SCI_FI', 15, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN016', 'THR', 'Thriller', 'Suspenseful plots with tension and excitement', 53, 'THRILLER', 16, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN017', 'WAR', 'War', 'Battle scenes, wartime narratives, and military settings', 10752, 'ACTION', 17, 'Y', SYSDATE, SYSDATE),
(seq_dim_genre.NEXTVAL, 'GEN018', 'WES', 'Western', 'Cowboys, outlaws, and the American Old West', 37, 'ACTION', 18, 'Y', SYSDATE, SYSDATE);

COMMIT;


-- ============================================================
-- SEED: DIM_CHANNEL
-- ============================================================
INSERT INTO dim_channel (channel_sk, channel_id, channel_code, channel_name, channel_description, channel_type, channel_category, is_self_service, requires_human, is_remote, booking_fee_rate, booking_fee_fixed, commission_rate, is_active, display_order, icon_class, color_code, created_date, last_modified_date) VALUES
(seq_dim_channel.NEXTVAL, 'CHN001', 'ONLINE', 'Online Website', 'Online booking via cinema website', 'ONLINE', 'DIGITAL', 'Y', 'N', 'Y', 2.50, 0, 0, 'Y', 1, 'fa-globe', '#4CAF50', SYSDATE, SYSDATE),
(seq_dim_channel.NEXTVAL, 'CHN002', 'MOBILE_APP', 'Mobile Application', 'Booking via official mobile app', 'MOBILE_APP', 'DIGITAL', 'Y', 'N', 'Y', 2.00, 0, 0, 'Y', 2, 'fa-mobile-alt', '#2196F3', SYSDATE, SYSDATE),
(seq_dim_channel.NEXTVAL, 'CHN003', 'BOX_OFFICE', 'Box Office', 'In-person counter at the cinema', 'BOX_OFFICE', 'PHYSICAL', 'N', 'Y', 'N', 0, 0, 0, 'Y', 3, 'fa-ticket-alt', '#FF9800', SYSDATE, SYSDATE),
(seq_dim_channel.NEXTVAL, 'CHN004', 'KIOSK', 'Self-Service Kiosk', 'In-cinema self-service kiosk', 'KIOSK', 'PHYSICAL', 'Y', 'N', 'N', 0.50, 0, 0, 'Y', 4, 'fa-desktop', '#9C27B0', SYSDATE, SYSDATE),
(seq_dim_channel.NEXTVAL, 'CHN005', 'POS', 'POS Terminal', 'Point of sale terminal', 'POS_TERMINAL', 'PHYSICAL', 'N', 'Y', 'N', 0, 0, 0, 'Y', 5, 'fa-cash-register', '#795548', SYSDATE, SYSDATE),
(seq_dim_channel.NEXTVAL, 'CHN006', 'THIRD_PARTY', 'Third Party Aggregator', 'External booking platform', 'THIRD_PARTY', 'THIRD_PARTY', 'N', 'N', 'Y', 3.50, 0, 5.00, 'Y', 6, 'fa-link', '#607D8B', SYSDATE, SYSDATE),
(seq_dim_channel.NEXTVAL, 'CHN007', 'CALL_CENTER', 'Call Center', 'Phone booking via call center', 'CALL_CENTER', 'PHYSICAL', 'N', 'Y', 'Y', 1.00, 0, 0, 'Y', 7, 'fa-phone', '#E91E63', SYSDATE, SYSDATE);

COMMIT;


-- ============================================================
-- SEED: DIM_PAYMENT
-- ============================================================
INSERT INTO dim_payment (payment_sk, payment_id, payment_code, payment_name, payment_description, payment_category, payment_subcategory, is_digital, is_prepaid, requires_pin, requires_cvv, requires_otp, processing_fee_rate, processing_fee_fixed, settlement_days, is_active, display_order, icon_class, color_code, created_date, last_modified_date) VALUES
(seq_dim_payment.NEXTVAL, 'PAY001', 'CASH', 'Cash', 'Physical cash payment', 'CASH', NULL, 'N', 'N', 'N', 'N', 'N', 0, 0, 0, 'Y', 1, 'fa-money-bill', '#4CAF50', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY002', 'VISA', 'Visa Card', 'Visa credit/debit card', 'CARD', 'VISA', 'Y', 'N', 'Y', 'Y', 'Y', 2.50, 0.50, 2, 'Y', 2, 'fa-credit-card', '#1A73E8', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY003', 'MASTERCARD', 'Mastercard', 'Mastercard credit/debit card', 'CARD', 'MASTERCARD', 'Y', 'N', 'Y', 'Y', 'Y', 2.50, 0.50, 2, 'Y', 3, 'fa-credit-card', '#EB001B', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY004', 'AMEX', 'American Express', 'American Express card', 'CARD', 'AMEX', 'Y', 'N', 'Y', 'Y', 'Y', 3.00, 0.50, 3, 'Y', 4, 'fa-credit-card', '#006FCF', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY005', 'MOMO_MTN', 'MTN Mobile Money', 'MTN MoMo mobile payment', 'MOBILE_MONEY', 'MTN_MOMO', 'Y', 'Y', 'Y', 'N', 'Y', 1.50, 0, 1, 'Y', 5, 'fa-mobile', '#FFCD00', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY006', 'MOMO_VOD', 'Vodafone Cash', 'Vodafone Cash mobile payment', 'MOBILE_MONEY', 'VODAFONE_CASH', 'Y', 'Y', 'Y', 'N', 'Y', 1.50, 0, 1, 'Y', 6, 'fa-mobile', '#E2001A', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY007', 'MOMO_AT', 'AirtelTigo Money', 'AirtelTigo mobile money', 'MOBILE_MONEY', 'AIRTEL_TIGO', 'Y', 'Y', 'Y', 'N', 'Y', 1.50, 0, 1, 'Y', 7, 'fa-mobile', '#ED1B2E', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY008', 'GIFT', 'Gift Card', 'Prepaid cinema gift card', 'GIFT_CARD', NULL, 'Y', 'Y', 'N', 'N', 'N', 0, 0, 0, 'Y', 8, 'fa-gift', '#FF4081', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY009', 'VOUCHER', 'Voucher', 'Promotional voucher', 'VOUCHER', NULL, 'Y', 'Y', 'N', 'N', 'N', 0, 0, 0, 'Y', 9, 'fa-ticket', '#FF6F00', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY010', 'LOYALTY', 'Loyalty Points', 'Points earned through loyalty program', 'LOYALTY_POINTS', NULL, 'Y', 'Y', 'N', 'N', 'N', 0, 0, 0, 'Y', 10, 'fa-star', '#FFD700', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY011', 'BANK', 'Bank Transfer', 'Direct bank transfer', 'BANK_TRANSFER', NULL, 'Y', 'N', 'N', 'N', 'N', 0, 0, 2, 'Y', 11, 'fa-university', '#455A64', SYSDATE, SYSDATE),
(seq_dim_payment.NEXTVAL, 'PAY012', 'CRYPTO', 'Cryptocurrency', 'Bitcoin and other cryptocurrencies', 'CRYPTO', NULL, 'Y', 'Y', 'N', 'N', 'Y', 1.00, 0.50, 1, 'N', 12, 'fa-bitcoin', '#F7931A', SYSDATE, SYSDATE);

COMMIT;


-- ============================================================
-- SEED: DIM_CERTIFICATION
-- ============================================================
INSERT INTO dim_certification (cert_sk, cert_id, cert_code, cert_name, cert_description, min_age, max_age, age_group, certification_board, country, is_adult_content, requires_guardian, display_order, created_date, last_modified_date) VALUES
(seq_dim_cert.NEXTVAL, 'CERT001', 'G', 'General Audiences', 'All ages admitted', 0, NULL, 'ALL', 'GHANA', 'Ghana', 'N', 'N', 1, SYSDATE, SYSDATE),
(seq_dim_cert.NEXTVAL, 'CERT002', 'PG', 'Parental Guidance', 'Some material may not be suitable for children', 8, NULL, 'CHILDREN', 'GHANA', 'Ghana', 'N', 'Y', 2, SYSDATE, SYSDATE),
(seq_dim_cert.NEXTVAL, 'CERT003', 'PG-13', 'Parents Strongly Cautioned', 'Some material may be inappropriate for children under 13', 13, NULL, 'TEEN', 'GHANA', 'Ghana', 'N', 'Y', 3, SYSDATE, SYSDATE),
(seq_dim_cert.NEXTVAL, 'CERT004', 'R', 'Restricted', 'Under 17 requires accompanying parent or adult guardian', 17, NULL, 'YOUNG_ADULT', 'GHANA', 'Ghana', 'N', 'Y', 4, SYSDATE, SYSDATE),
(seq_dim_cert.NEXTVAL, 'CERT005', '18', 'Adults Only', 'No one under 18 admitted', 18, NULL, 'ADULT', 'GHANA', 'Ghana', 'Y', 'N', 5, SYSDATE, SYSDATE),
(seq_dim_cert.NEXTVAL, 'CERT006', 'U', 'Universal', 'Suitable for all ages', 0, NULL, 'ALL', 'BBFC', 'United Kingdom', 'N', 'N', 1, SYSDATE, SYSDATE),
(seq_dim_cert.NEXTVAL, 'CERT007', '12A', '12 Accompanied', 'Under 12 must be accompanied by adult', 12, NULL, 'CHILDREN', 'BBFC', 'United Kingdom', 'N', 'Y', 2, SYSDATE, SYSDATE),
(seq_dim_cert.NEXTVAL, 'CERT008', '15', '15', 'No one under 15 admitted', 15, NULL, 'TEEN', 'BBFC', 'United Kingdom', 'N', 'N', 3, SYSDATE, SYSDATE),
(seq_dim_cert.NEXTVAL, 'CERT009', '18_UK', '18', 'No one under 18 admitted', 18, NULL, 'ADULT', 'BBFC', 'United Kingdom', 'Y', 'N', 4, SYSDATE, SYSDATE);

COMMIT;


-- ============================================================
-- SEED: DIM_MEMBERSHIP_TIER
-- ============================================================
INSERT INTO dim_membership_tier (tier_sk, tier_id, tier_code, tier_name, tier_description, points_required, annual_spend_required, visit_required, discount_percentage, points_earn_rate, free_tickets_year, companion_tickets, concession_vouchers_year, priority_booking, exclusive_events, free_upgrades, early_access_hours, tier_color, tier_icon, display_order, is_active, created_date, created_by, last_modified_date, last_modified_by) VALUES
(seq_dim_tier.NEXTVAL, 'TIER001', 'BRONZE', 'Bronze', 'Entry level tier for new members - earn points on every purchase', 0, 0, 0, 0, 1.00, 0, 0, 0, 'N', 'N', 'N', 0, '#CD7F32', 'fa-star', 1, 'Y', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_tier.NEXTVAL, 'TIER002', 'SILVER', 'Silver', 'Silver tier - 5% discount, 1.25x points, early access to showtimes', 500, 500.00, 10, 5, 1.25, 0, 0, 0, 'N', 'N', 'N', 0, '#C0C0C0', 'fa-star-half-alt', 2, 'Y', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_tier.NEXTVAL, 'TIER003', 'GOLD', 'Gold', 'Gold tier - 10% discount, 1.5x points, 1 free ticket/year, free upgrade', 1500, 1500.00, 25, 10, 1.50, 1, 0, 0, 'N', 'N', 'Y', 2, '#FFD700', 'fa-star', 3, 'Y', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_tier.NEXTVAL, 'TIER004', 'PLATINUM', 'Platinum', 'Platinum tier - 15% discount, 2x points, priority booking, exclusive events', 3000, 3000.00, 50, 15, 2.00, 2, 1, 1, 'Y', 'Y', 'Y', 4, '#E5E4E2', 'fa-gem', 4, 'Y', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_tier.NEXTVAL, 'TIER005', 'DIAMOND', 'Diamond', 'Diamond tier - 20% discount, 2.5x points, VIP treatment, all-access pass', 6000, 6000.00, 100, 20, 2.50, 4, 2, 2, 'Y', 'Y', 'Y', 6, '#B9F2FF', 'fa-crown', 5, 'Y', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM');

COMMIT;


-- ============================================================
-- SEED: DIM_AGE_GROUP
-- ============================================================
INSERT INTO dim_age_group (age_group_sk, age_group_id, age_group_code, age_group_name, age_group_description, age_min, age_max, generation, generation_years, age_segment, display_order, color_code, created_date, last_modified_date) VALUES
(seq_dim_age_group.NEXTVAL, 'AGE001', 'U18', 'Under 18', 'Children and teenagers under 18', 0, 17, 'GEN_ALPHA', '2010+', 'CHILDREN', 1, '#4CAF50', SYSDATE, SYSDATE),
(seq_dim_age_group.NEXTVAL, 'AGE002', '18-24', '18-24', 'Young adults aged 18-24', 18, 24, 'GEN_Z', '1997-2012', 'TEENS', 2, '#2196F3', SYSDATE, SYSDATE),
(seq_dim_age_group.NEXTVAL, 'AGE003', '25-34', '25-34', 'Adults aged 25-34', 25, 34, 'MILLENNIAL', '1981-1996', 'YOUNG_ADULTS', 3, '#FF9800', SYSDATE, SYSDATE),
(seq_dim_age_group.NEXTVAL, 'AGE004', '35-44', '35-44', 'Adults aged 35-44', 35, 44, 'GEN_X', '1965-1980', 'ADULTS', 4, '#9C27B0', SYSDATE, SYSDATE),
(seq_dim_age_group.NEXTVAL, 'AGE005', '45-54', '45-54', 'Adults aged 45-54', 45, 54, 'GEN_X', '1965-1980', 'ADULTS', 5, '#E91E63', SYSDATE, SYSDATE),
(seq_dim_age_group.NEXTVAL, 'AGE006', '55-64', '55-64', 'Adults aged 55-64', 55, 64, 'BOOMER', '1946-1964', 'MIDDLE_AGE', 6, '#F44336', SYSDATE, SYSDATE),
(seq_dim_age_group.NEXTVAL, 'AGE007', '65+', '65+', 'Seniors aged 65 and above', 65, 120, 'SILENT', '1928-1945', 'SENIORS', 7, '#795548', SYSDATE, SYSDATE);

COMMIT;



-- ============================================================
-- SEED: DIM_GEOGRAPHY - Ghana Locations
-- ============================================================
INSERT INTO dim_geography (geo_sk, geo_id, geo_code, country, country_code, region, region_code, city, city_code, postal_code, district, latitude, longitude, display_order, timezone, created_date, last_modified_date) VALUES
-- Ghana - Greater Accra
(seq_dim_geo.NEXTVAL, 'GEO001', 'GHA-ACC-01', 'Ghana', 'GH', 'Greater Accra', 'GHA-GA', 'Accra', 'ACC-01', '00233', 'Accra Metropolitan', 5.6037, -0.1870, 1, 'Africa/Accra', SYSDATE, SYSDATE),
(seq_dim_geo.NEXTVAL, 'GEO002', 'GHA-ACC-02', 'Ghana', 'GH', 'Greater Accra', 'GHA-GA', 'Accra', 'ACC-02', '00233', 'La Dade Kotopon', 5.6050, -0.1800, 2, 'Africa/Accra', SYSDATE, SYSDATE),
(seq_dim_geo.NEXTVAL, 'GEO003', 'GHA-TEM-01', 'Ghana', 'GH', 'Greater Accra', 'GHA-GA', 'Tema', 'TEM-01', '00233', 'Tema Metropolitan', 5.6698, -0.0166, 3, 'Africa/Accra', SYSDATE, SYSDATE),
(seq_dim_geo.NEXTVAL, 'GEO004', 'GHA-TEM-02', 'Ghana', 'GH', 'Greater Accra', 'GHA-GA', 'Tema', 'TEM-02', '00233', 'Tema West', 5.6800, -0.0200, 4, 'Africa/Accra', SYSDATE, SYSDATE),

-- Ghana - Ashanti
(seq_dim_geo.NEXTVAL, 'GEO005', 'GHA-KUM-01', 'Ghana', 'GH', 'Ashanti', 'GHA-AS', 'Kumasi', 'KUM-01', '00233', 'Kumasi Metropolitan', 6.6666, -1.6163, 5, 'Africa/Accra', SYSDATE, SYSDATE),
(seq_dim_geo.NEXTVAL, 'GEO006', 'GHA-KUM-02', 'Ghana', 'GH', 'Ashanti', 'GHA-AS', 'Kumasi', 'KUM-02', '00233', 'Asokwa', 6.6500, -1.6200, 6, 'Africa/Accra', SYSDATE, SYSDATE),

-- Ghana - Western
(seq_dim_geo.NEXTVAL, 'GEO007', 'GHA-SEK-01', 'Ghana', 'GH', 'Western', 'GHA-WE', 'Sekondi-Takoradi', 'SEK-01', '00233', 'Sekondi Takoradi Metropolitan', 4.9440, -1.7134, 7, 'Africa/Accra', SYSDATE, SYSDATE),

-- Ghana - Eastern
(seq_dim_geo.NEXTVAL, 'GEO008', 'GHA-KOF-01', 'Ghana', 'GH', 'Eastern', 'GHA-EA', 'Koforidua', 'KOF-01', '00233', 'New Juaben Municipal', 6.1000, -0.2600, 8, 'Africa/Accra', SYSDATE, SYSDATE),

-- Ghana - Northern
(seq_dim_geo.NEXTVAL, 'GEO009', 'GHA-TAM-01', 'Ghana', 'GH', 'Northern', 'GHA-NO', 'Tamale', 'TAM-01', '00233', 'Tamale Metropolitan', 9.4075, -0.8533, 9, 'Africa/Accra', SYSDATE, SYSDATE),

-- Ghana - Volta
(seq_dim_geo.NEXTVAL, 'GEO010', 'GHA-HOH-01', 'Ghana', 'GH', 'Volta', 'GHA-VO', 'Ho', 'HOH-01', '00233', 'Ho Municipal', 6.6000, 0.4700, 10, 'Africa/Accra', SYSDATE, SYSDATE);

COMMIT;


-- ============================================================
-- SEED: DIM_DEVICE
-- ============================================================
INSERT INTO dim_device (device_sk, device_id, device_code, device_name, device_description, device_category, device_type, platform, platform_version, browser, browser_version, is_mobile, is_tablet, is_desktop, mobile_os, screen_resolution, screen_size_inches, device_tags, created_date, last_modified_date) VALUES
(seq_dim_device.NEXTVAL, 'DEV001', 'DESKTOP_WIN', 'Windows Desktop', 'Desktop computer running Windows OS', 'DESKTOP', 'DESKTOP', 'WINDOWS', '11', 'CHROME', '120', 'N', 'N', 'Y', NULL, '1920x1080', 24, 'standard, office', SYSDATE, SYSDATE),
(seq_dim_device.NEXTVAL, 'DEV002', 'DESKTOP_MAC', 'Mac Desktop', 'Desktop computer running macOS', 'DESKTOP', 'DESKTOP', 'MACOS', '14', 'SAFARI', '17', 'N', 'N', 'Y', NULL, '2560x1440', 27, 'premium, apple', SYSDATE, SYSDATE),
(seq_dim_device.NEXTVAL, 'DEV003', 'MOBILE_ANDROID', 'Android Smartphone', 'Mobile phone running Android OS', 'MOBILE', 'SMARTPHONE', 'ANDROID', '14', 'CHROME', '120', 'Y', 'N', 'N', 'ANDROID', '1080x2400', 6.5, 'mobile, popular', SYSDATE, SYSDATE),
(seq_dim_device.NEXTVAL, 'DEV004', 'MOBILE_IOS', 'iPhone', 'Apple iPhone running iOS', 'MOBILE', 'SMARTPHONE', 'IOS', '17', 'SAFARI', '17', 'Y', 'N', 'N', 'IOS', '1170x2532', 6.1, 'premium, apple', SYSDATE, SYSDATE),
(seq_dim_device.NEXTVAL, 'DEV005', 'TABLET_IOS', 'iPad', 'Apple iPad tablet', 'TABLET', 'TABLET', 'IOS', '17', 'SAFARI', '17', 'N', 'Y', 'N', 'IOS', '1640x2360', 10.9, 'tablet, premium', SYSDATE, SYSDATE),
(seq_dim_device.NEXTVAL, 'DEV006', 'TABLET_ANDROID', 'Android Tablet', 'Android tablet device', 'TABLET', 'TABLET', 'ANDROID', '14', 'CHROME', '120', 'N', 'Y', 'N', 'ANDROID', '1600x2560', 10.5, 'tablet, standard', SYSDATE, SYSDATE),
(seq_dim_device.NEXTVAL, 'DEV007', 'SMART_TV', 'Smart TV', 'Smart television with built-in apps', 'SMART_TV', 'TV', 'WEBOS', '6.0', 'WEBOS', NULL, 'N', 'N', 'N', NULL, '3840x2160', 55, 'tv, streaming', SYSDATE, SYSDATE);

COMMIT;


-- ============================================================
-- SEED: DIM_MOVIE_STATUS
-- ============================================================
INSERT INTO dim_movie_status (status_sk, status_id, status_code, status_name, status_description, is_released, is_upcoming, is_post_production, is_cancelled, is_available, status_category, display_order, color_code, icon_class, created_date, last_modified_date) VALUES
(seq_dim_movie_status.NEXTVAL, 'STAT001', 'RELEASED', 'Released', 'Movie has been officially released to cinemas', 'Y', 'N', 'N', 'N', 'Y', 'RELEASED', 1, '#4CAF50', 'fa-check-circle', SYSDATE, SYSDATE),
(seq_dim_movie_status.NEXTVAL, 'STAT002', 'UPCOMING', 'Upcoming', 'Movie is scheduled for future release', 'N', 'Y', 'N', 'N', 'N', 'PRE_RELEASE', 2, '#2196F3', 'fa-calendar-plus', SYSDATE, SYSDATE),
(seq_dim_movie_status.NEXTVAL, 'STAT003', 'POST_PROD', 'Post Production', 'Movie is in post-production phase', 'N', 'N', 'Y', 'N', 'N', 'PRE_RELEASE', 3, '#FF9800', 'fa-film', SYSDATE, SYSDATE),
(seq_dim_movie_status.NEXTVAL, 'STAT004', 'UNRELEASED', 'Unreleased', 'Movie has been announced but not scheduled', 'N', 'N', 'N', 'N', 'N', 'PRE_RELEASE', 4, '#9E9E9E', 'fa-clock', SYSDATE, SYSDATE),
(seq_dim_movie_status.NEXTVAL, 'STAT005', 'CANCELLED', 'Cancelled', 'Movie release has been cancelled', 'N', 'N', 'N', 'Y', 'N', 'CANCELLED', 5, '#F44336', 'fa-times-circle', SYSDATE, SYSDATE),
(seq_dim_movie_status.NEXTVAL, 'STAT006', 'PREMIERE', 'Premiere', 'Movie is having its premiere showing', 'Y', 'N', 'N', 'N', 'Y', 'RELEASED', 6, '#E91E63', 'fa-star', SYSDATE, SYSDATE);

COMMIT;


-- ============================================================
-- SEED: DIM_SHOWTIME
-- ============================================================
INSERT INTO dim_showtime (showtime_sk, showtime_id, showtime_code, session_type, session_timing, day_part, time_slot, start_hour, end_hour, hour_range, is_peak_time, is_holiday, is_weekend, is_special, weekday_weekend, price_tier, created_date, last_modified_date) VALUES
(seq_dim_showtime.NEXTVAL, 'ST001', 'MORNING_EB', 'MORNING', 'EARLY_BIRD', 'MORNING', '09:00-11:00', 9, 11, '09:00-11:00', 'N', 'N', 'N', 'N', 'WEEKDAY', 'DISCOUNT', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST002', 'MORNING_WK', 'MORNING', 'EARLY_BIRD', 'MORNING', '09:00-11:00', 9, 11, '09:00-11:00', 'N', 'N', 'Y', 'N', 'WEEKEND', 'STANDARD', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST003', 'MATINEE_WD', 'MATINEE', 'STANDARD', 'AFTERNOON', '12:00-14:00', 12, 14, '12:00-14:00', 'N', 'N', 'N', 'N', 'WEEKDAY', 'STANDARD', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST004', 'MATINEE_WK', 'MATINEE', 'STANDARD', 'AFTERNOON', '12:00-14:00', 12, 14, '12:00-14:00', 'N', 'N', 'Y', 'N', 'WEEKEND', 'PREMIUM', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST005', 'AFTERNOON_WD', 'MATINEE', 'STANDARD', 'AFTERNOON', '14:00-16:00', 14, 16, '14:00-16:00', 'N', 'N', 'N', 'N', 'WEEKDAY', 'STANDARD', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST006', 'AFTERNOON_WK', 'MATINEE', 'STANDARD', 'AFTERNOON', '14:00-16:00', 14, 16, '14:00-16:00', 'N', 'N', 'Y', 'N', 'WEEKEND', 'PREMIUM', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST007', 'EVENING_WD', 'EVENING', 'STANDARD', 'EVENING', '16:00-18:00', 16, 18, '16:00-18:00', 'N', 'N', 'N', 'N', 'WEEKDAY', 'STANDARD', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST008', 'EVENING_WK', 'EVENING', 'STANDARD', 'EVENING', '16:00-18:00', 16, 18, '16:00-18:00', 'N', 'N', 'Y', 'N', 'WEEKEND', 'PREMIUM', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST009', 'PRIME_WD', 'EVENING', 'PRIME', 'EVENING', '19:00-21:00', 19, 21, '19:00-21:00', 'Y', 'N', 'N', 'N', 'WEEKDAY', 'PREMIUM', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST010', 'PRIME_WK', 'EVENING', 'PRIME', 'EVENING', '19:00-21:00', 19, 21, '19:00-21:00', 'Y', 'N', 'Y', 'N', 'WEEKEND', 'PREMIUM', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST011', 'LATE_WD', 'LATE_NIGHT', 'LATE_NIGHT', 'NIGHT', '22:00-23:59', 22, 0, '22:00-23:59', 'N', 'N', 'N', 'N', 'WEEKDAY', 'DISCOUNT', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST012', 'LATE_WK', 'LATE_NIGHT', 'LATE_NIGHT', 'NIGHT', '22:00-23:59', 22, 0, '22:00-23:59', 'N', 'N', 'Y', 'N', 'WEEKEND', 'STANDARD', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST013', 'PREMIERE', 'PREMIERE', 'PRIME', 'EVENING', '19:00-21:00', 19, 21, '19:00-21:00', 'Y', 'N', 'N', 'Y', 'WEEKDAY', 'PREMIUM', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST014', 'SPECIAL', 'SPECIAL', 'PRIME', 'EVENING', '19:00-22:00', 19, 22, '19:00-22:00', 'Y', 'N', 'N', 'Y', 'WEEKDAY', 'PREMIUM', SYSDATE, SYSDATE),
(seq_dim_showtime.NEXTVAL, 'ST015', 'HOLIDAY', 'EVENING', 'PRIME', 'EVENING', '18:00-21:00', 18, 21, '18:00-21:00', 'Y', 'Y', 'N', 'N', 'WEEKDAY', 'PREMIUM', SYSDATE, SYSDATE);

COMMIT;



-- ============================================================
-- SEED: DIM_BRANCH
-- ============================================================
INSERT INTO dim_branch (branch_sk, branch_id, branch_code, branch_name, address_line1, address_line2, city, region, country, postal_code, mall_name, geo_sk, number_of_screens, total_capacity, phone_number, email, manager_name, opening_date, status, timezone, currency_code, latitude, longitude, created_date, last_modified_date) VALUES
(seq_dim_branch.NEXTVAL, 'BR001', 'ACC-MALL', 'Accra Mall Cinema', 'Accra Mall, Spintex Road', 'Near Game Store', 'Accra', 'Greater Accra', 'Ghana', '00233', 'Accra Mall', (SELECT geo_sk FROM dim_geography WHERE geo_code = 'GHA-ACC-01'), 8, 1200, '+233 30 212 3456', 'accramall@cinemachain.com', 'John Mensah', DATE '2020-01-15', 'ACTIVE', 'Africa/Accra', 'GHS', 5.6037, -0.1870, SYSDATE, SYSDATE),
(seq_dim_branch.NEXTVAL, 'BR002', 'KUM-CITY', 'Kumasi City Cinema', 'Kumasi City Mall, Lake Road', 'Opposite Kumasi Cultural Centre', 'Kumasi', 'Ashanti', 'Ghana', '00233', 'Kumasi City Mall', (SELECT geo_sk FROM dim_geography WHERE geo_code = 'GHA-KUM-01'), 6, 850, '+233 32 212 3456', 'kumasicity@cinemachain.com', 'Ama Asante', DATE '2021-06-20', 'ACTIVE', 'Africa/Accra', 'GHS', 6.6666, -1.6163, SYSDATE, SYSDATE),
(seq_dim_branch.NEXTVAL, 'BR003', 'TEM-SHOP', 'Tema Shopping Cinema', 'Tema Community 25, Industrial Area', 'Near Tema Harbour', 'Tema', 'Greater Accra', 'Ghana', '00233', 'Tema Shopping Centre', (SELECT geo_sk FROM dim_geography WHERE geo_code = 'GHA-TEM-01'), 4, 500, '+233 30 312 3456', 'temashopping@cinemachain.com', 'Kwame Owusu', DATE '2022-11-10', 'ACTIVE', 'Africa/Accra', 'GHS', 5.6698, -0.0166, SYSDATE, SYSDATE),
(seq_dim_branch.NEXTVAL, 'BR004', 'SEK-TOWN', 'Sekondi Cinema', 'Takoradi Mall, Sekondi Road', 'Near Takoradi Market', 'Sekondi-Takoradi', 'Western', 'Ghana', '00233', 'Takoradi Mall', (SELECT geo_sk FROM dim_geography WHERE geo_code = 'GHA-SEK-01'), 3, 350, '+233 31 212 3456', 'sekondi@cinemachain.com', 'Esi Agyemang', DATE '2023-03-15', 'ACTIVE', 'Africa/Accra', 'GHS', 4.9440, -1.7134, SYSDATE, SYSDATE);

COMMIT;


-- ============================================================
-- SEED: DIM_SUPPLIER
-- ============================================================
INSERT INTO dim_supplier (supplier_sk, supplier_id, supplier_code, supplier_name, supplier_alias, supplier_type, contact_name, contact_phone, contact_email, website, address_line1, address_line2, city, region, country, postal_code, geo_sk, payment_terms, tax_id, quality_rating, delivery_rating, price_rating, lead_time_days, min_order_value, preferred_delivery_day, is_preferred, status, contract_start, contract_end, created_date, created_by, last_modified_date, last_modified_by) VALUES
(seq_dim_supplier.NEXTVAL, 'SUP001', 'POPCORN_SUP', 'Ghana Popcorn Co.', 'GPC', 'FOOD', 'Kwame Adjei', '+233 24 400 0001', 'orders@ghanapopcorn.com', 'www.ghanapopcorn.com', 'Industrial Area', 'Plot 12', 'Accra', 'Greater Accra', 'Ghana', '00233', (SELECT geo_sk FROM dim_geography WHERE geo_code = 'GHA-ACC-01'), 'NET 30', 'GPC-12345', 4.5, 4.0, 4.2, 3, 500.00, 'Wednesday', 'Y', 'ACTIVE', SYSDATE, NULL, SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_supplier.NEXTVAL, 'SUP002', 'BEV_SUP', 'Beverage Distributors Ltd', 'BDL', 'BEVERAGE', 'Ama Serwah', '+233 24 400 0002', 'orders@beveragedist.com', 'www.beveragedist.com', 'Industrial Road', 'Plot 8', 'Tema', 'Greater Accra', 'Ghana', '00233', (SELECT geo_sk FROM dim_geography WHERE geo_code = 'GHA-TEM-01'), 'NET 45', 'BDL-67890', 4.0, 4.5, 4.0, 2, 1000.00, 'Friday', 'Y', 'ACTIVE', SYSDATE, NULL, SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_supplier.NEXTVAL, 'SUP003', 'SNACK_SUP', 'Global Snacks Inc.', 'GSI', 'FOOD', 'Yaw Asare', '+233 24 400 0003', 'orders@globalsnacks.com', 'www.globalsnacks.com', 'Industrial Area', 'Plot 20', 'Kumasi', 'Ashanti', 'Ghana', '00233', (SELECT geo_sk FROM dim_geography WHERE geo_code = 'GHA-KUM-01'), 'NET 30', 'GSI-54321', 3.5, 3.5, 4.0, 4, 300.00, 'Tuesday', 'N', 'ACTIVE', SYSDATE, NULL, SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM');

COMMIT;


-- ============================================================
-- SEED: DIM_SCREEN - Screens per branch
-- ============================================================
BEGIN
    -- Accra Mall Cinema (8 screens)
    FOR i IN 1..8 LOOP
        INSERT INTO dim_screen (screen_sk, screen_id, screen_code, screen_number, screen_name, branch_sk, screen_type, projection_type, sound_system, is_3d, is_imax, is_dolby_atmos, is_vip, is_accessibility, capacity, row_count, seats_per_row, screen_width_cm, screen_height_cm, room_width_cm, room_height_cm, status, created_date, last_modified_date)
        VALUES (
            seq_dim_screen.NEXTVAL,
            'SCR' || LPAD(TO_CHAR(i), 3, '0'),
            'ACC-SCR' || LPAD(TO_CHAR(i), 2, '0'),
            'Screen ' || i,
            CASE 
                WHEN i = 1 THEN 'IMAX Screen'
                WHEN i = 2 THEN 'Dolby Atmos Screen'
                WHEN i <= 3 THEN 'Premier Screen'
                ELSE 'Standard Screen'
            END,
            (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR001'),
            CASE 
                WHEN i = 1 THEN 'IMAX'
                WHEN i = 2 THEN 'DOLBY'
                WHEN i = 3 THEN 'VIP'
                ELSE 'STANDARD'
            END,
            CASE WHEN i <= 2 THEN 'LASER' ELSE 'DIGITAL' END,
            CASE WHEN i = 2 THEN 'DOLBY_ATMOS' ELSE 'DOLBY_7_1' END,
            CASE WHEN i <= 3 THEN 'Y' ELSE 'N' END,
            CASE WHEN i = 1 THEN 'Y' ELSE 'N' END,
            CASE WHEN i = 2 THEN 'Y' ELSE 'N' END,
            CASE WHEN i = 3 THEN 'Y' ELSE 'N' END,
            'Y',
            CASE 
                WHEN i = 1 THEN 300
                WHEN i = 2 THEN 250
                WHEN i = 3 THEN 150
                ELSE 120
            END,
            CASE 
                WHEN i = 1 THEN 15
                WHEN i = 2 THEN 12
                WHEN i = 3 THEN 10
                ELSE 8
            END,
            CASE 
                WHEN i = 1 THEN 20
                WHEN i = 2 THEN 18
                WHEN i = 3 THEN 15
                ELSE 15
            END,
            CASE WHEN i = 1 THEN 1500 ELSE 1200 END,
            CASE WHEN i = 1 THEN 800 ELSE 600 END,
            CASE WHEN i = 1 THEN 1800 ELSE 1500 END,
            CASE WHEN i = 1 THEN 900 ELSE 700 END,
            'ACTIVE',
            SYSDATE,
            SYSDATE
        );
    END LOOP;

    -- Kumasi City Cinema (6 screens)
    FOR i IN 1..6 LOOP
        INSERT INTO dim_screen (screen_sk, screen_id, screen_code, screen_number, screen_name, branch_sk, screen_type, projection_type, sound_system, is_3d, is_imax, is_dolby_atmos, is_vip, is_accessibility, capacity, row_count, seats_per_row, screen_width_cm, screen_height_cm, room_width_cm, room_height_cm, status, created_date, last_modified_date)
        VALUES (
            seq_dim_screen.NEXTVAL,
            'SCR' || LPAD(TO_CHAR(10 + i), 3, '0'),
            'KUM-SCR' || LPAD(TO_CHAR(i), 2, '0'),
            'Screen ' || i,
            CASE 
                WHEN i = 1 THEN 'Premier Screen'
                WHEN i <= 2 THEN 'Dolby Screen'
                ELSE 'Standard Screen'
            END,
            (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR002'),
            CASE 
                WHEN i = 1 THEN 'VIP'
                WHEN i = 2 THEN 'DOLBY'
                ELSE 'STANDARD'
            END,
            'DIGITAL',
            CASE WHEN i = 2 THEN 'DOLBY_ATMOS' ELSE 'STANDARD' END,
            CASE WHEN i <= 2 THEN 'Y' ELSE 'N' END,
            'N',
            CASE WHEN i = 2 THEN 'Y' ELSE 'N' END,
            CASE WHEN i = 1 THEN 'Y' ELSE 'N' END,
            'Y',
            CASE 
                WHEN i = 1 THEN 200
                WHEN i = 2 THEN 180
                ELSE 120
            END,
            CASE 
                WHEN i = 1 THEN 10
                ELSE 8
            END,
            CASE 
                WHEN i = 1 THEN 20
                ELSE 15
            END,
            1200,
            600,
            1500,
            700,
            'ACTIVE',
            SYSDATE,
            SYSDATE
        );
    END LOOP;

    -- Tema Shopping Cinema (4 screens)
    FOR i IN 1..4 LOOP
        INSERT INTO dim_screen (screen_sk, screen_id, screen_code, screen_number, screen_name, branch_sk, screen_type, projection_type, sound_system, is_3d, is_imax, is_dolby_atmos, is_vip, is_accessibility, capacity, row_count, seats_per_row, screen_width_cm, screen_height_cm, room_width_cm, room_height_cm, status, created_date, last_modified_date)
        VALUES (
            seq_dim_screen.NEXTVAL,
            'SCR' || LPAD(TO_CHAR(20 + i), 3, '0'),
            'TEM-SCR' || LPAD(TO_CHAR(i), 2, '0'),
            'Screen ' || i,
            'Standard Screen',
            (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR003'),
            'STANDARD',
            'DIGITAL',
            'STANDARD',
            'N',
            'N',
            'N',
            'N',
            'Y',
            120,
            8,
            15,
            1000,
            500,
            1200,
            600,
            'ACTIVE',
            SYSDATE,
            SYSDATE
        );
    END LOOP;
    COMMIT;
END;
/



-- ============================================================
-- SEED: DIM_SEAT - Generate seats for one screen (example)
-- ============================================================
DECLARE
    v_screen_sk NUMBER;
    v_branch_sk NUMBER;
    v_capacity NUMBER;
    v_row_letter VARCHAR2(2);
    v_seat_num NUMBER;
    v_seat_type VARCHAR2(20);
    v_price_tier VARCHAR2(10);
    v_row_count NUMBER;
    v_seats_per_row NUMBER;
BEGIN
    -- Get first screen (you can change this to any screen)
    SELECT screen_sk, branch_sk, capacity, row_count, seats_per_row 
    INTO v_screen_sk, v_branch_sk, v_capacity, v_row_count, v_seats_per_row
    FROM dim_screen 
    WHERE screen_code = 'ACC-SCR01'  -- IMAX screen
    AND ROWNUM = 1;
    
    FOR r IN 1..v_row_count LOOP
        v_row_letter := CHR(64 + r);  -- A, B, C, ...
        FOR s IN 1..v_seats_per_row LOOP
            -- Define seat type based on row
            IF r <= 2 THEN
                v_seat_type := 'PREMIUM';
                v_price_tier := 'PREMIUM';
            ELSIF r <= 4 THEN
                v_seat_type := 'STANDARD';
                v_price_tier := 'STANDARD';
            ELSIF r = v_row_count THEN
                v_seat_type := 'ACCESSIBLE';
                v_price_tier := 'STANDARD';
            ELSE
                v_seat_type := 'STANDARD';
                v_price_tier := 'STANDARD';
            END IF;
            
            INSERT INTO dim_seat (
                seat_sk, seat_id, seat_code, screen_sk, branch_sk, seat_number, 
                row_letter, seat_position, seat_type, price_tier, 
                is_wheelchair_accessible, is_accessible_aisle, is_hearing_impaired, 
                is_vision_impaired, has_cup_holder, has_table, has_power_outlet, 
                has_call_button, viewing_angle, distance_from_screen, view_quality, 
                status, created_date, last_modified_date
            ) VALUES (
                seq_dim_seat.NEXTVAL,
                v_row_letter || LPAD(s, 2, '0'),
                'SEAT-' || v_row_letter || LPAD(s, 2, '0'),
                v_screen_sk,
                v_branch_sk,
                TO_CHAR(s),
                v_row_letter,
                s,
                v_seat_type,
                v_price_tier,
                CASE WHEN r = v_row_count THEN 'Y' ELSE 'N' END,
                CASE WHEN s = 1 THEN 'Y' ELSE 'N' END,
                'N',
                'N',
                'Y',
                CASE WHEN r <= 2 THEN 'Y' ELSE 'N' END,
                CASE WHEN r <= 2 THEN 'Y' ELSE 'N' END,
                'N',
                NULL,
                NULL,
                CASE 
                    WHEN r <= 2 THEN 'EXCELLENT'
                    WHEN r <= 4 THEN 'GOOD'
                    ELSE 'AVERAGE'
                END,
                'ACTIVE',
                SYSDATE,
                SYSDATE
            );
        END LOOP;
    END LOOP;
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Seats generated for screen: ACC-SCR01');
END;
/


-- ============================================================
-- SEED: DIM_PRODUCT
-- ============================================================
INSERT INTO dim_product (product_sk, product_id, product_code, product_name, product_description, sku, product_category, product_subcategory, category_type, supplier_sk, brand, manufacturer, unit_cost, selling_price, tax_rate, unit_of_measure, package_quantity, reorder_level, reorder_quantity, par_level, safety_stock, is_perishable, shelf_life_days, requires_refrigeration, contains_allergens, nutritional_info, is_active, status, image_url, created_date, last_modified_date) VALUES
(seq_dim_product.NEXTVAL, 'PROD001', 'POP_REG', 'Popcorn (Regular)', 'Freshly popped regular popcorn', 'POP-REG-001', 'POPCORN', 'Regular', 'FOOD', (SELECT supplier_sk FROM dim_supplier WHERE supplier_id = 'SUP001'), 'GPC', 'Ghana Popcorn Co.', 5.00, 15.00, 12.5, 'EACH', 1, 500, 1000, 800, 200, 'Y', 7, 'N', NULL, NULL, 'Y', 'ACTIVE', NULL, SYSDATE, SYSDATE),
(seq_dim_product.NEXTVAL, 'PROD002', 'POP_BUT', 'Popcorn (Butter)', 'Freshly popped butter popcorn', 'POP-BUT-002', 'POPCORN', 'Butter', 'FOOD', (SELECT supplier_sk FROM dim_supplier WHERE supplier_id = 'SUP001'), 'GPC', 'Ghana Popcorn Co.', 6.00, 18.00, 12.5, 'EACH', 1, 400, 800, 600, 150, 'Y', 7, 'N', '{"allergens":["milk"]}', NULL, 'Y', 'ACTIVE', NULL, SYSDATE, SYSDATE),
(seq_dim_product.NEXTVAL, 'PROD003', 'COKE_L', 'Coca-Cola (Large)', 'Large Coca-Cola beverage', 'BEV-COKE-L-001', 'BEVERAGES', 'Soda', 'BEVERAGE', (SELECT supplier_sk FROM dim_supplier WHERE supplier_id = 'SUP002'), 'Coca-Cola', 'Coca-Cola Company', 3.00, 8.00, 12.5, 'EACH', 1, 800, 1500, 1000, 300, 'Y', 30, 'Y', NULL, '{"serving_size":"500ml","calories":210,"sugar":53}', 'Y', 'ACTIVE', NULL, SYSDATE, SYSDATE),
(seq_dim_product.NEXTVAL, 'PROD004', 'SPRITE_L', 'Sprite (Large)', 'Large Sprite beverage', 'BEV-SPR-L-001', 'BEVERAGES', 'Soda', 'BEVERAGE', (SELECT supplier_sk FROM dim_supplier WHERE supplier_id = 'SUP002'), 'Sprite', 'Coca-Cola Company', 3.00, 8.00, 12.5, 'EACH', 1, 500, 1000, 700, 200, 'Y', 30, 'Y', NULL, '{"serving_size":"500ml","calories":200,"sugar":50}', 'Y', 'ACTIVE', NULL, SYSDATE, SYSDATE),
(seq_dim_product.NEXTVAL, 'PROD005', 'NACHOS', 'Nachos with Cheese', 'Crispy nachos with cheese sauce', 'SNK-NACH-001', 'SNACKS', 'Nachos', 'SNACK', (SELECT supplier_sk FROM dim_supplier WHERE supplier_id = 'SUP003'), 'Global Snacks', 'Global Snacks Inc.', 4.00, 12.00, 12.5, 'EACH', 1, 300, 600, 400, 100, 'Y', 14, 'N', '{"allergens":["milk","gluten"]}', '{"calories":450,"fat":25,"carbs":45}', 'Y', 'ACTIVE', NULL, SYSDATE, SYSDATE),
(seq_dim_product.NEXTVAL, 'PROD006', 'HOTDOG', 'Hot Dog', 'Classic hot dog with bun', 'SNK-HOTD-001', 'HOT_DOGS', 'Classic', 'FOOD', (SELECT supplier_sk FROM dim_supplier WHERE supplier_id = 'SUP003'), 'Global Snacks', 'Global Snacks Inc.', 6.00, 18.00, 12.5, 'EACH', 1, 200, 400, 300, 80, 'Y', 3, 'Y', '{"allergens":["gluten","milk"]}', '{"calories":350,"protein":12,"fat":18}', 'Y', 'ACTIVE', NULL, SYSDATE, SYSDATE),
(seq_dim_product.NEXTVAL, 'PROD007', 'COMBO_FAM', 'Family Combo Meal', '2x Large Popcorn + 2x Large Drinks', 'CMB-FAM-001', 'COMBO', 'Family', 'COMBO', NULL, 'Cinema Chain', 'Cinema Chain', 16.00, 35.00, 12.5, 'EACH', 1, 100, 200, 150, 50, 'N', NULL, 'N', NULL, NULL, 'Y', 'ACTIVE', NULL, SYSDATE, SYSDATE),
(seq_dim_product.NEXTVAL, 'PROD008', 'COMBO_DATE', 'Date Night Combo', '1x Butter Popcorn + 2x Large Drinks + 2x Chocolates', 'CMB-DAT-001', 'COMBO', 'Date Night', 'COMBO', NULL, 'Cinema Chain', 'Cinema Chain', 15.00, 30.00, 12.5, 'EACH', 1, 80, 160, 120, 30, 'N', NULL, 'N', NULL, NULL, 'Y', 'ACTIVE', NULL, SYSDATE, SYSDATE);

COMMIT;


-- ============================================================
-- SEED: DIM_PROMOTION
-- ============================================================
INSERT INTO dim_promotion (promotion_sk, promotion_id, promotion_code, promotion_name, promotion_description, promotion_type, promotion_category, discount_value, discount_type, max_discount_amount, min_purchase_amount, start_date, end_date, days_of_week, target_tiers, min_ticket_quantity, max_ticket_quantity, requires_coupon, is_stackable, stack_priority, usage_limit_per_customer, usage_limit_total, status, promo_text, created_date, created_by, last_modified_date, last_modified_by) VALUES
(seq_dim_promotion.NEXTVAL, 'PROM001', 'STUDENT10', 'Student Discount 10%', '10% off for students with valid ID', 'PERCENTAGE_DISCOUNT', 'TICKET', 10.00, 'PERCENTAGE', NULL, 0, SYSDATE, SYSDATE + 365, NULL, '{"student"}', 1, 10, 'Y', 'N', 1, 1, 0, 'ACTIVE', 'Show your student ID at the box office', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_promotion.NEXTVAL, 'PROM002', 'FAMILY15', 'Family Pack 15%', '15% off for families of 4 or more', 'PERCENTAGE_DISCOUNT', 'TICKET', 15.00, 'PERCENTAGE', 30.00, 60.00, SYSDATE, SYSDATE + 365, NULL, '{"family"}', 4, 10, 'N', 'N', 2, 0, 0, 'ACTIVE', 'Bring the whole family!', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_promotion.NEXTVAL, 'PROM003', 'BOGO', 'Buy One Get One Free', 'Buy one ticket, get one free', 'BUY_ONE_GET_ONE', 'TICKET', 0.00, 'FIXED_AMOUNT', 15.00, 15.00, SYSDATE, SYSDATE + 90, 'MON,TUE,WED', NULL, 2, 10, 'Y', 'N', 3, 0, 500, 'ACTIVE', 'Valid Tuesday - Thursday only', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_promotion.NEXTVAL, 'PROM004', 'LOYALTY_BONUS', 'Loyalty Bonus Points', 'Double loyalty points on all purchases', 'LOYALTY_BONUS', 'MEMBERSHIP', 100.00, 'FIXED_AMOUNT', NULL, 0, SYSDATE, SYSDATE + 180, NULL, '{"silver","gold","platinum"}', 1, 10, 'N', 'Y', 4, 0, 0, 'ACTIVE', 'Exclusive for loyalty members', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_promotion.NEXTVAL, 'PROM005', 'PREMIERE', 'Premiere Special Offer', 'Special pricing for premiere screenings', 'PREMIERE_OFFER', 'TICKET', 5.00, 'FIXED_AMOUNT', NULL, 20.00, SYSDATE, SYSDATE + 30, 'FRI,SAT,SUN', NULL, 2, 10, 'N', 'N', 5, 0, 200, 'ACTIVE', 'Be among the first to see new releases!', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM'),
(seq_dim_promotion.NEXTVAL, 'PROM006', 'FLASH_20', 'Flash Sale 20%', '20% off for 24 hours only', 'FLASH_SALE', 'TICKET', 20.00, 'PERCENTAGE', 40.00, 0, SYSDATE, SYSDATE + 1, NULL, NULL, 1, 10, 'Y', 'N', 6, 0, 1000, 'ACTIVE', 'Hurry! Limited time offer!', SYSDATE, 'SYSTEM', SYSDATE, 'SYSTEM');

COMMIT;



-- ============================================================
-- SEED: DIM_EMPLOYEE
-- ============================================================
INSERT INTO dim_employee (employee_sk, employee_id, employee_code, first_name, last_name, gender, date_of_birth, email, phone, branch_sk, position_name, role_type, position_level, supervisor_sk, hire_date, employment_type, shift_preference, department, hourly_rate, is_active, employee_status, created_date, last_modified_date) VALUES
(seq_dim_employee.NEXTVAL, 'EMP001', 'GM-ACC', 'John', 'Mensah', 'M', DATE '1980-05-15', 'john.mensah@cinemachain.com', '+233 24 400 0101', (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR001'), 'General Manager', 'MANAGEMENT', 5, NULL, DATE '2019-01-15', 'FULL_TIME', 'FLEXIBLE', 'Management', 50.00, 'Y', 'ACTIVE', SYSDATE, SYSDATE),
(seq_dim_employee.NEXTVAL, 'EMP002', 'ASST-KUM', 'Ama', 'Asante', 'F', DATE '1985-08-22', 'ama.asante@cinemachain.com', '+233 24 400 0102', (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR002'), 'Assistant Manager', 'MANAGEMENT', 4, (SELECT employee_sk FROM dim_employee WHERE employee_id = 'EMP001'), DATE '2020-03-20', 'FULL_TIME', 'EVENING', 'Management', 35.00, 'Y', 'ACTIVE', SYSDATE, SYSDATE),
(seq_dim_employee.NEXTVAL, 'EMP003', 'CASH-ACC-01', 'Kwame', 'Owusu', 'M', DATE '1990-11-10', 'kwame.owusu@cinemachain.com', '+233 24 400 0103', (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR001'), 'Senior Cashier', 'CASHIER', 3, (SELECT employee_sk FROM dim_employee WHERE employee_id = 'EMP001'), DATE '2021-06-01', 'FULL_TIME', 'MORNING', 'Box Office', 18.00, 'Y', 'ACTIVE', SYSDATE, SYSDATE),
(seq_dim_employee.NEXTVAL, 'EMP004', 'CONC-ACC-01', 'Esi', 'Agyemang', 'F', DATE '1995-03-25', 'esi.agyemang@cinemachain.com', '+233 24 400 0104', (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR001'), 'Concession Staff', 'CONCESSION_STAFF', 2, (SELECT employee_sk FROM dim_employee WHERE employee_id = 'EMP001'), DATE '2022-01-15', 'PART_TIME', 'AFTERNOON', 'Concessions', 14.00, 'Y', 'ACTIVE', SYSDATE, SYSDATE),
(seq_dim_employee.NEXTVAL, 'EMP005', 'PROJ-ACC-01', 'Yaw', 'Asare', 'M', DATE '1988-07-18', 'yaw.asare@cinemachain.com', '+233 24 400 0105', (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR001'), 'Projectionist', 'PROJECTIONIST', 3, (SELECT employee_sk FROM dim_employee WHERE employee_id = 'EMP001'), DATE '2020-09-01', 'FULL_TIME', 'EVENING', 'Technical', 20.00, 'Y', 'ACTIVE', SYSDATE, SYSDATE),
(seq_dim_employee.NEXTVAL, 'EMP006', 'USHER-ACC-01', 'Abena', 'Adjei', 'F', DATE '1998-12-01', 'abena.adjei@cinemachain.com', '+233 24 400 0106', (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR001'), 'Usher', 'USHER', 1, (SELECT employee_sk FROM dim_employee WHERE employee_id = 'EMP001'), DATE '2023-03-10', 'PART_TIME', 'EVENING', 'Operations', 12.00, 'Y', 'ACTIVE', SYSDATE, SYSDATE),
(seq_dim_employee.NEXTVAL, 'EMP007', 'CLEAN-ACC-01', 'Kofi', 'Boateng', 'M', DATE '2000-06-30', 'kofi.boateng@cinemachain.com', '+233 24 400 0107', (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR001'), 'Cleaner', 'CLEANER', 1, (SELECT employee_sk FROM dim_employee WHERE employee_id = 'EMP001'), DATE '2023-05-01', 'PART_TIME', 'MORNING', 'Housekeeping', 11.00, 'Y', 'ACTIVE', SYSDATE, SYSDATE),
(seq_dim_employee.NEXTVAL, 'EMP008', 'SEC-ACC-01', 'Atta', 'Mensah', 'M', DATE '1985-09-12', 'atta.mensah@cinemachain.com', '+233 24 400 0108', (SELECT branch_sk FROM dim_branch WHERE branch_id = 'BR001'), 'Security Guard', 'SECURITY', 2, (SELECT employee_sk FROM dim_employee WHERE employee_id = 'EMP001'), DATE '2021-11-15', 'FULL_TIME', 'NIGHT', 'Security', 13.00, 'Y', 'ACTIVE', SYSDATE, SYSDATE);

COMMIT;