-- =====================================================
-- STAGING TABLES
-- =====================================================

-- ============================================================
-- CUSTOMER MASTER TABLE
-- ============================================================
CREATE TABLE customer (
    customer_id         NUMBER(12)      PRIMARY KEY,
    customer_guid       VARCHAR2(36)    UNIQUE,          -- For external systems
    first_name          VARCHAR2(50)    NOT NULL,
    last_name           VARCHAR2(50)    NOT NULL,
    middle_name         VARCHAR2(50),
    gender              VARCHAR2(1)     CHECK (gender IN ('M', 'F', 'O', 'U')),
    date_of_birth       DATE,
    occupation          VARCHAR2(50),
    company_name        VARCHAR2(100),
    tax_id              VARCHAR2(20),                   -- For invoicing
    national_id         VARCHAR2(20),                   -- National ID / SSN
    passport_number     VARCHAR2(20),
    preferred_language  VARCHAR2(10)    DEFAULT 'EN',
    preferred_currency  VARCHAR2(3)     DEFAULT 'GHS',
    marketing_consent   CHAR(1)         DEFAULT 'Y' CHECK (marketing_consent IN ('Y', 'N')),
    data_privacy_consent CHAR(1)        DEFAULT 'Y' CHECK (data_privacy_consent IN ('Y', 'N')),
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')),
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER,
    last_login_date     DATE,
    last_login_ip       VARCHAR2(45),                  -- IPv6 compatible
    registration_channel VARCHAR2(30)   DEFAULT 'WEB' CHECK (registration_channel IN ('WEB', 'APP', 'BOX_OFFICE', 'KIOSK', 'THIRD_PARTY'))
);

-- Indexes for performance
CREATE INDEX idx_customer_name ON customer(last_name, first_name);
CREATE INDEX idx_customer_status ON customer(status);
CREATE INDEX idx_customer_registration ON customer(registration_channel);
CREATE INDEX idx_customer_consent ON customer(marketing_consent);

-- ============================================================
-- CUSTOMER ADDRESSES (Support multiple addresses per customer)
-- ============================================================
CREATE TABLE customer_addresses (
    address_id          NUMBER(12)      PRIMARY KEY,
    customer_id         NUMBER(12)      NOT NULL REFERENCES customer(customer_id),
    address_type        VARCHAR2(20)    NOT NULL CHECK (address_type IN ('HOME', 'WORK', 'BILLING', 'SHIPPING', 'MAILING', 'OTHER')),
    address_line1       VARCHAR2(100)   NOT NULL,
    address_line2       VARCHAR2(100),
    city                VARCHAR2(50)    NOT NULL,
    region              VARCHAR2(50)    NOT NULL,
    country             VARCHAR2(50)    NOT NULL,
    postal_code         VARCHAR2(20),
    latitude            NUMBER(10,8),                   -- For geolocation
    longitude           NUMBER(11,8),
    is_primary          CHAR(1)         DEFAULT 'N' CHECK (is_primary IN ('Y', 'N')),
    is_verified         CHAR(1)         DEFAULT 'N' CHECK (is_verified IN ('Y', 'N')),
    verification_date   DATE,
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER,
    
    -- Ensure only one primary address per customer
    CONSTRAINT chk_primary_address UNIQUE (customer_id, address_type, is_primary)
);

CREATE INDEX idx_addr_customer ON customer_addresses(customer_id);
CREATE INDEX idx_addr_type ON customer_addresses(address_type);
CREATE INDEX idx_addr_primary ON customer_addresses(is_primary);
CREATE INDEX idx_addr_location ON customer_addresses(city, region);

-- ============================================================
-- CUSTOMER CONTACTS (Phone, Email, Social Media)
-- ============================================================
CREATE TABLE customer_contacts (
    contact_id          NUMBER(12)      PRIMARY KEY,
    customer_id         NUMBER(12)      NOT NULL REFERENCES customer(customer_id),
    contact_type        VARCHAR2(20)    NOT NULL CHECK (contact_type IN ('EMAIL', 'PHONE', 'MOBILE', 'WHATSAPP', 'FACEBOOK', 'TWITTER', 'INSTAGRAM', 'TELEGRAM', 'OTHER')),
    contact_value       VARCHAR2(100)   NOT NULL,
    is_primary          CHAR(1)         DEFAULT 'N' CHECK (is_primary IN ('Y', 'N')),
    is_verified         CHAR(1)         DEFAULT 'N' CHECK (is_verified IN ('Y', 'N')),
    verification_date   DATE,
    verification_code   VARCHAR2(10),
    verification_attempts NUMBER(3)     DEFAULT 0,
    last_attempt_date   DATE,
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'UNSUBSCRIBED', 'BOUNCED')),
    -- For emails only
    email_status        VARCHAR2(20)    DEFAULT 'NONE' CHECK (email_status IN ('NONE', 'SENT', 'OPENED', 'CLICKED', 'BOUNCED', 'SPAM', 'UNSUBSCRIBED')),
    email_bounce_reason VARCHAR2(255),
    -- For SMS/WhatsApp
    sms_opt_in          CHAR(1)         DEFAULT 'N' CHECK (sms_opt_in IN ('Y', 'N')),
    sms_opt_in_date     DATE,
    -- For marketing
    marketing_opt_in    CHAR(1)         DEFAULT 'N' CHECK (marketing_opt_in IN ('Y', 'N')),
    marketing_opt_in_date DATE,
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER,
    
    -- Ensure only one primary contact per type
    CONSTRAINT chk_primary_contact UNIQUE (customer_id, contact_type, is_primary)
);

CREATE INDEX idx_contact_customer ON customer_contacts(customer_id);
CREATE INDEX idx_contact_type ON customer_contacts(contact_type);
CREATE INDEX idx_contact_value ON customer_contacts(contact_value);
CREATE INDEX idx_contact_verified ON customer_contacts(is_verified);

-- ============================================================
-- CUSTOMER PREFERENCES (Movie preferences, notification settings)
-- ============================================================
CREATE TABLE customer_preferences (
    preference_id       NUMBER(12)      PRIMARY KEY,
    customer_id         NUMBER(12)      NOT NULL REFERENCES customer(customer_id) UNIQUE,
    
    -- Movie preferences
    favorite_genre1     VARCHAR2(30),
    favorite_genre2     VARCHAR2(30),
    favorite_genre3     VARCHAR2(30),
    favorite_actor1     VARCHAR2(50),
    favorite_actor2     VARCHAR2(50),
    favorite_director   VARCHAR2(50),
    preferred_language  VARCHAR2(20)    DEFAULT 'EN',
    preferred_subtitles VARCHAR2(20),
    preferred_movie_rating VARCHAR2(10),
    
    -- Cinema preferences
    preferred_branch    VARCHAR2(50),
    preferred_screen_type VARCHAR2(30)  CHECK (preferred_screen_type IN ('STANDARD', 'IMAX', 'DOLBY', 'VIP', '4DX')),
    preferred_seat_type VARCHAR2(20)    CHECK (preferred_seat_type IN ('STANDARD', 'PREMIUM', 'RECLINER', 'VIP')),
    preferred_seat_row  VARCHAR2(10),
    preferred_seat_section VARCHAR2(20) CHECK (preferred_seat_section IN ('FRONT', 'MIDDLE', 'BACK', 'SIDE', 'CENTER')),
    
    -- Concession preferences
    favorite_snack      VARCHAR2(50),
    favorite_drink      VARCHAR2(50),
    preferred_combo     VARCHAR2(50),
    dietary_restrictions CLOB,                         -- JSON array of restrictions
    
    -- Notification preferences (overrides customer level)
    email_notifications CHAR(1)         DEFAULT 'Y' CHECK (email_notifications IN ('Y', 'N')),
    sms_notifications   CHAR(1)         DEFAULT 'N' CHECK (sms_notifications IN ('Y', 'N')),
    push_notifications  CHAR(1)         DEFAULT 'Y' CHECK (push_notifications IN ('Y', 'N')),
    notification_frequency VARCHAR2(20) DEFAULT 'DAILY' CHECK (notification_frequency IN ('IMMEDIATE', 'DAILY', 'WEEKLY', 'MONTHLY', 'NEVER')),
    
    -- Interest topics
    interests_new_releases CHAR(1)      DEFAULT 'Y' CHECK (interests_new_releases IN ('Y', 'N')),
    interests_special_events CHAR(1)    DEFAULT 'Y' CHECK (interests_special_events IN ('Y', 'N')),
    interests_promotions CHAR(1)        DEFAULT 'Y' CHECK (interests_promotions IN ('Y', 'N')),
    interests_loyalty   CHAR(1)         DEFAULT 'Y' CHECK (interests_loyalty IN ('Y', 'N')),
    
    -- Privacy
    share_activity_with_friends CHAR(1) DEFAULT 'N' CHECK (share_activity_with_friends IN ('Y', 'N')),
    show_in_leaderboard CHAR(1)         DEFAULT 'Y' CHECK (show_in_leaderboard IN ('Y', 'N')),
    
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_pref_genre ON customer_preferences(favorite_genre1);
CREATE INDEX idx_pref_branch ON customer_preferences(preferred_branch);

-- ============================================================
-- CUSTOMER POINTS (Current points balance)
-- ============================================================
CREATE TABLE customer_points (
    points_id           NUMBER(12)      PRIMARY KEY,
    customer_id         NUMBER(12)      NOT NULL REFERENCES customer(customer_id) UNIQUE,
    
    -- Current balances
    current_balance     NUMBER(10)      DEFAULT 0 NOT NULL,
    lifetime_earned     NUMBER(10)      DEFAULT 0 NOT NULL,
    lifetime_redeemed   NUMBER(10)      DEFAULT 0 NOT NULL,
    lifetime_expired    NUMBER(10)      DEFAULT 0 NOT NULL,
    
    -- Tier information
    tier_level          VARCHAR2(20)    DEFAULT 'BRONZE' CHECK (tier_level IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND')),
    tier_start_date     DATE,
    tier_end_date       DATE,
    points_to_next_tier NUMBER(10),
    tier_benefits       VARCHAR2(500),                 -- JSON array of benefits
    
    -- Summary
    total_visits        NUMBER(6)       DEFAULT 0,
    total_spent         NUMBER(12,2)    DEFAULT 0,
    average_spend_per_visit NUMBER(10,2),
    last_activity_date  DATE,
    next_tier_eligible  CHAR(1)         DEFAULT 'N' CHECK (next_tier_eligible IN ('Y', 'N')),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE
);

CREATE INDEX idx_points_customer ON customer_points(customer_id);
CREATE INDEX idx_points_tier ON customer_points(tier_level);

-- ============================================================
-- CUSTOMER POINTS HISTORY (Audit trail of all point transactions)
-- ============================================================
CREATE TABLE customer_points_history (
    history_id          NUMBER(12)      PRIMARY KEY,
    customer_id         NUMBER(12)      NOT NULL REFERENCES customer(customer_id),
    
    -- Transaction details
    transaction_type    VARCHAR2(30)    NOT NULL CHECK (transaction_type IN ('EARN_TICKET', 'EARN_CONCESSION', 'EARN_BONUS', 'EARN_PROMOTION', 'EARN_BIRTHDAY', 'EARN_REFERRAL', 'REDEEM_TICKET', 'REDEEM_CONCESSION', 'REDEEM_PROMOTION', 'EXPIRATION', 'ADJUSTMENT')),
    points_amount       NUMBER(10)      NOT NULL,
    points_balance_after NUMBER(10)     NOT NULL,
    
    -- Related records
    source_table        VARCHAR2(50),                   -- e.g., 'ticket_sale', 'concession_sale'
    source_record_id    VARCHAR2(50),                   -- FK to the source record
    promotion_id        NUMBER(12),                     -- If promotion related
    booking_id          NUMBER(12),                     -- If booking related
    transaction_date    DATE            NOT NULL,
    expiry_date         DATE,                           -- When points expire
    expiration_reason   VARCHAR2(100),
    
    -- Metadata
    notes               VARCHAR2(500),
    processed_by        VARCHAR2(30)    DEFAULT USER,
    created_date        DATE            DEFAULT SYSDATE
);

CREATE INDEX idx_hist_customer ON customer_points_history(customer_id);
CREATE INDEX idx_hist_type ON customer_points_history(transaction_type);
CREATE INDEX idx_hist_date ON customer_points_history(transaction_date DESC);
CREATE INDEX idx_hist_expiry ON customer_points_history(expiry_date);

-- ============================================================
-- CUSTOMER PAYMENT METHODS (Saved payment options)
-- ============================================================
CREATE TABLE customer_payment_methods (
    payment_method_id   NUMBER(12)      PRIMARY KEY,
    customer_id         NUMBER(12)      NOT NULL REFERENCES customer(customer_id),
    
    -- Payment details
    payment_type        VARCHAR2(30)    NOT NULL CHECK (payment_type IN ('CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'GIFT_CARD', 'VOUCHER', 'BANK_TRANSFER', 'CRYPTO')),
    card_type           VARCHAR2(20)    CHECK (card_type IN ('VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'OTHER')),
    card_number_encrypted VARCHAR2(255),               -- Encrypted
    card_number_masked  VARCHAR2(20),                  -- e.g., **** **** **** 1234
    cardholder_name     VARCHAR2(100),
    expiry_month        NUMBER(2),
    expiry_year         NUMBER(4),
    cvv_encrypted       VARCHAR2(255),                 -- Encrypted
    bank_name           VARCHAR2(100),
    account_number_encrypted VARCHAR2(255),            -- For bank transfers
    
    -- Mobile Money
    mobile_operator     VARCHAR2(50)    CHECK (mobile_operator IN ('MTN', 'VODAFONE', 'AIRTEL_TIGO', 'GLO', 'ORANGE')),
    mobile_number       VARCHAR2(20),
    momo_name           VARCHAR2(100),
    
    -- Gift Card / Voucher
    gift_card_number    VARCHAR2(50),
    gift_card_balance   NUMBER(10,2),
    gift_card_pin       VARCHAR2(20),                  -- Encrypted
    
    -- Flags
    is_primary          CHAR(1)         DEFAULT 'N' CHECK (is_primary IN ('Y', 'N')),
    is_tokenized        CHAR(1)         DEFAULT 'N' CHECK (is_tokenized IN ('Y', 'N')),
    token_value         VARCHAR2(100),                 -- Payment gateway token
    gateway_name        VARCHAR2(50),
    gateway_reference   VARCHAR2(100),
    
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED')),
    last_used_date      DATE,
    last_used_amount    NUMBER(10,2),
    
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_paymethod_customer ON customer_payment_methods(customer_id);
CREATE INDEX idx_paymethod_primary ON customer_payment_methods(is_primary);
CREATE INDEX idx_paymethod_type ON customer_payment_methods(payment_type);

-- ============================================================
-- CUSTOMER NOTIFICATIONS (Outbound communication log)
-- ============================================================
CREATE TABLE customer_notifications (
    notification_id     NUMBER(12)      PRIMARY KEY,
    customer_id         NUMBER(12)      NOT NULL REFERENCES customer(customer_id),
    
    -- Notification details
    notification_type   VARCHAR2(30)    NOT NULL CHECK (notification_type IN ('EMAIL', 'SMS', 'PUSH', 'IN_APP', 'WHATSAPP', 'VOICE')),
    notification_channel VARCHAR2(30)   NOT NULL CHECK (notification_channel IN ('MARKETING', 'TRANSACTIONAL', 'LOYALTY', 'REMINDER', 'ALERT', 'PROMOTION', 'NEWSLETTER')),
    priority            VARCHAR2(20)    DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    
    -- Content
    subject             VARCHAR2(500),
    message_body        CLOB,
    link_url            VARCHAR2(500),
    template_id         VARCHAR2(50),                   -- If using a notification template
    template_params     CLOB,                          -- JSON parameters for template
    
    -- Status tracking
    status              VARCHAR2(20)    DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'OPENED', 'CLICKED', 'BOUNCED', 'FAILED')),
    sent_date           DATE,
    delivered_date      DATE,
    read_date           DATE,
    opened_date         DATE,
    clicked_date        DATE,
    bounce_reason       VARCHAR2(255),
    failure_reason      VARCHAR2(255),
    
    -- Tracking
    sent_by             VARCHAR2(30)    DEFAULT USER,
    send_count          NUMBER(3)       DEFAULT 0,
    last_send_attempt   DATE,
    tracking_id         VARCHAR2(100),                 -- For email tracking pixels
    utm_source          VARCHAR2(50),
    utm_medium          VARCHAR2(50),
    utm_campaign        VARCHAR2(50),
    utm_content         VARCHAR2(50),
    
    -- Scheduling
    scheduled_date      DATE,
    is_automated        CHAR(1)         DEFAULT 'N' CHECK (is_automated IN ('Y', 'N')),
    trigger_event       VARCHAR2(50),                  -- e.g., 'BIRTHDAY', 'LOYALTY_TIER_UPGRADE'
    
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_notif_customer ON customer_notifications(customer_id);
CREATE INDEX idx_notif_type ON customer_notifications(notification_type);
CREATE INDEX idx_notif_status ON customer_notifications(status);
CREATE INDEX idx_notif_date ON customer_notifications(created_date DESC);
CREATE INDEX idx_notif_scheduled ON customer_notifications(scheduled_date);


-- ============================================================
-- CINEMAS (Parent company/chain)
-- ============================================================
CREATE TABLE cinemas (
    cinema_id           NUMBER(12)      PRIMARY KEY,
    cinema_code         VARCHAR2(20)    UNIQUE NOT NULL,
    cinema_name         VARCHAR2(100)   NOT NULL,
    legal_name          VARCHAR2(200),
    registration_number VARCHAR2(50),
    tax_id              VARCHAR2(50),
    
    -- Contact information
    head_office_address VARCHAR2(200),
    head_office_city    VARCHAR2(50),
    head_office_region  VARCHAR2(50),
    head_office_country VARCHAR2(50),
    head_office_phone   VARCHAR2(20),
    head_office_email   VARCHAR2(100),
    website_url         VARCHAR2(200),
    
    -- Branding
    logo_url            VARCHAR2(500),
    primary_color       VARCHAR2(7),    -- Hex color code
    secondary_color     VARCHAR2(7),
    
    -- Business details
    established_date    DATE,
    number_of_branches  NUMBER(3)       DEFAULT 0,
    total_screens       NUMBER(4)       DEFAULT 0,
    total_seats         NUMBER(8)       DEFAULT 0,
    
    -- Currency and localization
    base_currency       VARCHAR2(3)     DEFAULT 'GHS',
    default_timezone    VARCHAR2(50)    DEFAULT 'Africa/Accra',
    supported_currencies CLOB,          -- JSON array of currencies
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MERGER', 'ACQUISITION')),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_cinemas_code ON cinemas(cinema_code);
CREATE INDEX idx_cinemas_status ON cinemas(status);

-- ============================================================
-- BRANCHES (Physical locations)
-- ============================================================
CREATE TABLE branches (
    branch_id           NUMBER(12)      PRIMARY KEY,
    cinema_id           NUMBER(12)      NOT NULL REFERENCES cinemas(cinema_id),
    branch_code         VARCHAR2(20)    UNIQUE NOT NULL,
    branch_name         VARCHAR2(100)   NOT NULL,
    
    -- Physical address
    address_line1       VARCHAR2(100)   NOT NULL,
    address_line2       VARCHAR2(100),
    city                VARCHAR2(50)    NOT NULL,
    region              VARCHAR2(50)    NOT NULL,
    country             VARCHAR2(50)    NOT NULL,
    postal_code         VARCHAR2(20),
    latitude            NUMBER(10,8),
    longitude           NUMBER(11,8),
    
    -- Contact details
    phone_number        VARCHAR2(20),
    email               VARCHAR2(100),
    manager_name        VARCHAR2(100),
    manager_phone       VARCHAR2(20),
    manager_email       VARCHAR2(100),
    
    -- Location context
    mall_name           VARCHAR2(100),
    floor_location      VARCHAR2(20),
    nearby_landmarks    VARCHAR2(200),
    parking_available   CHAR(1)         DEFAULT 'Y' CHECK (parking_available IN ('Y', 'N')),
    parking_capacity    NUMBER(5),
    
    -- Operational details
    number_of_screens   NUMBER(3)       NOT NULL,
    total_capacity      NUMBER(6)       NOT NULL,
    opening_date        DATE            NOT NULL,
    closing_date        DATE,           -- For historical records
    operating_hours     CLOB,           -- JSON with days/hours
    
    -- Financial
    timezone            VARCHAR2(50)    DEFAULT 'Africa/Accra',
    currency_code       VARCHAR2(3)     DEFAULT 'GHS',
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'UNDER_RENOVATION', 'PERMANENTLY_CLOSED')),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_branches_cinema ON branches(cinema_id);
CREATE INDEX idx_branches_code ON branches(branch_code);
CREATE INDEX idx_branches_city ON branches(city);
CREATE INDEX idx_branches_status ON branches(status);
CREATE INDEX idx_branches_location ON branches(latitude, longitude);

-- ============================================================
-- SCREENS (Individual cinema screens/auditoriums)
-- ============================================================
CREATE TABLE screens (
    screen_id           NUMBER(12)      PRIMARY KEY,
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    screen_code         VARCHAR2(20)    UNIQUE NOT NULL,
    screen_number       VARCHAR2(10)    NOT NULL,
    screen_name         VARCHAR2(50),
    
    -- Technical specifications
    screen_type         VARCHAR2(30)    NOT NULL CHECK (screen_type IN ('STANDARD', 'IMAX', 'DOLBY', '4DX', 'VIP', 'D-BOX', 'SCREENX', 'PREMIUM')),
    projection_type     VARCHAR2(20)    CHECK (projection_type IN ('DIGITAL', 'LASER', 'FILM', 'DLP', '4K')),
    sound_system        VARCHAR2(30)    CHECK (sound_system IN ('DOLBY_7_1', 'DOLBY_ATMOS', 'DTS_X', 'AURA', 'STANDARD')),
    
    -- Capabilities
    is_3d               CHAR(1)         DEFAULT 'N' CHECK (is_3d IN ('Y', 'N')),
    is_imax             CHAR(1)         DEFAULT 'N' CHECK (is_imax IN ('Y', 'N')),
    is_dolby_atmos      CHAR(1)         DEFAULT 'N' CHECK (is_dolby_atmos IN ('Y', 'N')),
    is_vip              CHAR(1)         DEFAULT 'N' CHECK (is_vip IN ('Y', 'N')),
    is_accessibility    CHAR(1)         DEFAULT 'N' CHECK (is_accessibility IN ('Y', 'N')), -- Wheelchair accessible
    
    -- Physical dimensions
    capacity            NUMBER(6)       NOT NULL,
    screen_width_cm     NUMBER(6),      -- Screen dimensions
    screen_height_cm    NUMBER(6),
    room_width_cm       NUMBER(6),
    room_height_cm      NUMBER(6),
    row_count           NUMBER(3),      -- Number of rows
    seats_per_row       NUMBER(3),      -- Average seats per row
    
    -- Equipment
    projector_model     VARCHAR2(50),
    projector_specs     CLOB,
    sound_equipment     CLOB,
    last_equipment_upgrade DATE,
    
    -- Maintenance
    last_maintenance    DATE,
    next_maintenance    DATE,
    maintenance_notes   CLOB,
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'RETIRED')),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_screens_branch ON screens(branch_id);
CREATE INDEX idx_screens_code ON screens(screen_code);
CREATE INDEX idx_screens_type ON screens(screen_type);
CREATE INDEX idx_screens_status ON screens(status);

-- ============================================================
-- SEATS (Individual seats within screens)
-- ============================================================
CREATE TABLE seats (
    seat_id             NUMBER(12)      PRIMARY KEY,
    screen_id           NUMBER(12)      NOT NULL REFERENCES screens(screen_id),
    seat_code           VARCHAR2(20)    UNIQUE NOT NULL,
    seat_number         VARCHAR2(10)    NOT NULL,
    row_letter          VARCHAR2(2)     NOT NULL,
    seat_position       NUMBER(3)       NOT NULL,
    
    -- Seat classification
    seat_type           VARCHAR2(20)    NOT NULL CHECK (seat_type IN ('STANDARD', 'PREMIUM', 'RECLINER', 'VIP', 'ACCESSIBLE', 'LOVESEAT')),
    price_tier          VARCHAR2(10)    NOT NULL CHECK (price_tier IN ('STANDARD', 'PREMIUM', 'VIP', 'COMPANION')),
    
    -- Accessibility
    is_wheelchair_accessible CHAR(1)    DEFAULT 'N' CHECK (is_wheelchair_accessible IN ('Y', 'N')),
    is_accessible_aisle CHAR(1)         DEFAULT 'N' CHECK (is_accessible_aisle IN ('Y', 'N')),
    is_hearing_impaired CHAR(1)         DEFAULT 'N' CHECK (is_hearing_impaired IN ('Y', 'N')),
    is_vision_impaired  CHAR(1)         DEFAULT 'N' CHECK (is_vision_impaired IN ('Y', 'N')),
    
    -- Seat features
    has_cup_holder      CHAR(1)         DEFAULT 'Y' CHECK (has_cup_holder IN ('Y', 'N')),
    has_table           CHAR(1)         DEFAULT 'N' CHECK (has_table IN ('Y', 'N')),
    has_power_outlet    CHAR(1)         DEFAULT 'N' CHECK (has_power_outlet IN ('Y', 'N')),
    has_call_button     CHAR(1)         DEFAULT 'N' CHECK (has_call_button IN ('Y', 'N')),
    
    -- Viewing angles
    viewing_angle       NUMBER(5,2),    -- Degrees from center
    distance_from_screen NUMBER(5,2),   -- In meters
    view_quality        VARCHAR2(20)    CHECK (view_quality IN ('EXCELLENT', 'GOOD', 'AVERAGE', 'POOR')),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'UNDER_MAINTENANCE', 'DAMAGED', 'RETIRED')),
    status_date         DATE,
    status_reason       VARCHAR2(255),
    
    -- Maintenance
    last_maintenance    DATE,
    next_maintenance    DATE,
    maintenance_notes   CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_seats_screen ON seats(screen_id);
CREATE INDEX idx_seats_code ON seats(seat_code);
CREATE INDEX idx_seats_type ON seats(seat_type);
CREATE INDEX idx_seats_status ON seats(status);
CREATE INDEX idx_seats_accessible ON seats(is_wheelchair_accessible);


-- ============================================================
-- SHOWTIMES (Scheduled movie screenings)
-- ============================================================
CREATE TABLE showtimes (
    showtime_id         NUMBER(12)      PRIMARY KEY,
    screen_id           NUMBER(12)      NOT NULL REFERENCES screens(screen_id),
    
    -- Movie reference (could link to external movie ID)
    movie_id            VARCHAR2(20),   -- From your movie source (TMDb ID)
    movie_title         VARCHAR2(200),  -- Denormalized for performance
    movie_duration      NUMBER(4),      -- In minutes
    
    -- Schedule
    show_date           DATE            NOT NULL,
    show_time           DATE            NOT NULL,   -- Full timestamp with time
    end_time            DATE            NOT NULL,   -- Calculated from start + duration
    session_type        VARCHAR2(20)    NOT NULL CHECK (session_type IN ('MORNING', 'MATINEE', 'EVENING', 'LATE_NIGHT', 'SPECIAL')),
    
    -- Pricing
    base_price          NUMBER(10,2)    NOT NULL,
    premium_price       NUMBER(10,2),   -- For premium seats
    discount_price      NUMBER(10,2),   -- For off-peak
    
    -- Availability
    total_seats         NUMBER(6)       NOT NULL,
    available_seats     NUMBER(6)       NOT NULL,
    reserved_seats      NUMBER(6)       DEFAULT 0,
    sold_seats          NUMBER(6)       DEFAULT 0,
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'OPEN', 'CLOSED', 'SOLD_OUT', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED')),
    cancellation_reason VARCHAR2(255),
    cancellation_date   DATE,
    
    -- Special flags
    is_holiday_screening CHAR(1)        DEFAULT 'N' CHECK (is_holiday_screening IN ('Y', 'N')),
    is_premiere         CHAR(1)         DEFAULT 'N' CHECK (is_premiere IN ('Y', 'N')),
    is_special_event    CHAR(1)         DEFAULT 'N' CHECK (is_special_event IN ('Y', 'N')),
    special_event_type  VARCHAR2(50),   -- e.g., 'FOOTBALL', 'CONCERT', 'COMEDY', 'LIVE'
    
    -- Booking controls
    advance_booking_days NUMBER(3)      DEFAULT 7,
    booking_cutoff_minutes NUMBER(4)    DEFAULT 15,
    max_seats_per_booking NUMBER(3)     DEFAULT 10,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_showtimes_screen ON showtimes(screen_id);
CREATE INDEX idx_showtimes_date ON showtimes(show_date);
CREATE INDEX idx_showtimes_movie ON showtimes(movie_id);
CREATE INDEX idx_showtimes_status ON showtimes(status);
CREATE INDEX idx_showtimes_session ON showtimes(session_type);
CREATE INDEX idx_showtimes_special ON showtimes(is_special_event);

-- ============================================================
-- MAINTENANCE (Equipment and facility maintenance)
-- ============================================================
CREATE TABLE maintenance (
    maintenance_id      NUMBER(12)      PRIMARY KEY,
    screen_id           NUMBER(12)      NOT NULL REFERENCES screens(screen_id),
    
    -- Maintenance type
    maintenance_type    VARCHAR2(30)    NOT NULL CHECK (maintenance_type IN ('PROJECTOR', 'SOUND', 'SCREEN', 'SEATS', 'LIGHTING', 'HVAC', 'ELECTRICAL', 'BUILDING', 'PLUMBING', 'OTHER')),
    priority            VARCHAR2(20)    NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    
    -- Description
    issue_description   CLOB            NOT NULL,
    resolution_notes    CLOB,
    equipment_affected  VARCHAR2(100),
    parts_replaced      CLOB,           -- JSON array of parts
    
    -- Scheduling
    reported_date       DATE            NOT NULL,
    scheduled_date      DATE,
    start_date          DATE,
    completion_date     DATE,
    duration_hours      NUMBER(5,2),
    
    -- Personnel
    assigned_to         NUMBER(12),     -- Employee ID from STAFF table
    supervisor_id       NUMBER(12),
    
    -- Costs
    estimated_cost      NUMBER(10,2),
    actual_cost         NUMBER(10,2),
    labor_hours         NUMBER(5,2),
    parts_cost          NUMBER(10,2),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DEFERRED')),
    
    -- Impact
    affected_showtimes  CLOB,           -- JSON array of showtime IDs
    was_screen_offline  CHAR(1)         DEFAULT 'N' CHECK (was_screen_offline IN ('Y', 'N')),
    
    -- Follow-up
    follow_up_needed    CHAR(1)         DEFAULT 'N' CHECK (follow_up_needed IN ('Y', 'N')),
    follow_up_date      DATE,
    follow_up_notes     CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_maint_screen ON maintenance(screen_id);
CREATE INDEX idx_maint_status ON maintenance(status);
CREATE INDEX idx_maint_type ON maintenance(maintenance_type);
CREATE INDEX idx_maint_priority ON maintenance(priority);
CREATE INDEX idx_maint_assigned ON maintenance(assigned_to);

-- ============================================================
-- STAFF (Branch employees)
-- ============================================================
CREATE TABLE staff (
    staff_id            NUMBER(12)      PRIMARY KEY,
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    staff_code          VARCHAR2(20)    UNIQUE NOT NULL,
    
    -- Personal information
    first_name          VARCHAR2(50)    NOT NULL,
    last_name           VARCHAR2(50)    NOT NULL,
    middle_name         VARCHAR2(50),
    gender              VARCHAR2(1)     CHECK (gender IN ('M', 'F', 'O')),
    date_of_birth       DATE,
    national_id         VARCHAR2(20),
    passport_number     VARCHAR2(20),
    
    -- Contact
    email               VARCHAR2(100)   UNIQUE,
    phone               VARCHAR2(20),
    emergency_contact   VARCHAR2(100),
    emergency_phone     VARCHAR2(20),
    
    -- Employment
    job_title           VARCHAR2(50)    NOT NULL,
    role_type           VARCHAR2(30)    NOT NULL CHECK (role_type IN ('MANAGEMENT', 'CASHIER', 'PROJECTIONIST', 'USHER', 'CONCESSION_STAFF', 'CLEANER', 'SECURITY', 'MAINTENANCE', 'IT', 'MARKETING', 'HR', 'ACCOUNTING', 'OTHER')),
    
    hire_date           DATE            NOT NULL,
    termination_date    DATE,
    contract_type       VARCHAR2(20)    NOT NULL CHECK (contract_type IN ('FULL_TIME', 'PART_TIME', 'TEMPORARY', 'CONTRACT', 'INTERN')),
    shift_preference    VARCHAR2(20)    CHECK (shift_preference IN ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'FLEXIBLE')),
    
    -- Financial
    salary_grade        VARCHAR2(10),
    hourly_rate         NUMBER(10,2),
    bank_name           VARCHAR2(100),
    bank_account        VARCHAR2(50),
    
    -- HR details
    supervisor_id       NUMBER(12)      REFERENCES staff(staff_id),
    department          VARCHAR2(50),
    team_leader         CHAR(1)         DEFAULT 'N' CHECK (team_leader IN ('Y', 'N')),
    
    -- Qualifications
    certifications      CLOB,           -- JSON array of certifications
    skills              CLOB,           -- JSON array of skills
    languages_spoken    VARCHAR2(200),  -- Comma-separated
    
    -- Performance
    performance_rating  NUMBER(2,1)     CHECK (performance_rating BETWEEN 1 AND 5),
    last_review_date    DATE,
    next_review_date    DATE,
    review_notes        CLOB,
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED')),
    
    -- Access
    login_username      VARCHAR2(50)    UNIQUE,
    login_password_hash VARCHAR2(255),  -- Store hashed password
    access_level        VARCHAR2(30)    DEFAULT 'BASIC' CHECK (access_level IN ('BASIC', 'SUPERVISOR', 'MANAGER', 'ADMIN', 'SYSTEM')),
    last_login_date     DATE,
    last_login_ip       VARCHAR2(45),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_staff_branch ON staff(branch_id);
CREATE INDEX idx_staff_code ON staff(staff_code);
CREATE INDEX idx_staff_role ON staff(role_type);
CREATE INDEX idx_staff_status ON staff(status);
CREATE INDEX idx_staff_supervisor ON staff(supervisor_id);


-- ============================================================
-- MOVIES (Master movie record)
-- ============================================================
CREATE TABLE movies (
    movie_id            NUMBER(12)      PRIMARY KEY,
    movie_guid          VARCHAR2(36)    UNIQUE,
    
    -- Identifiers from external sources
    tmdb_id             VARCHAR2(20)    UNIQUE,
    imdb_id             VARCHAR2(20)    UNIQUE,
    vidapi_id           VARCHAR2(20),
    omdb_id             VARCHAR2(20),
    
    -- Core metadata
    title               VARCHAR2(200)   NOT NULL,
    original_title      VARCHAR2(200),
    title_sortable      VARCHAR2(200)   GENERATED ALWAYS AS (UPPER(REGEXP_REPLACE(title, '^(The|A|An) ', ''))) VIRTUAL,
    
    -- Release information
    release_date        DATE,
    release_year        NUMBER(4)       GENERATED ALWAYS AS (EXTRACT(YEAR FROM release_date)) VIRTUAL,
    release_status      VARCHAR2(30)    CHECK (release_status IN ('RELEASED', 'UNRELEASED', 'POST_PRODUCTION', 'CANCELLED')),
    release_country     VARCHAR2(50),
    
    -- Technical details
    runtime_minutes     NUMBER(4),
    budget              NUMBER(12,2),
    revenue             NUMBER(12,2),
    box_office          NUMBER(12,2),
    
    -- Content details
    synopsis            CLOB,
    tagline             VARCHAR2(500),
    plot_summary        CLOB,
    overview            CLOB,
    
    -- Content ratings (from official boards)
    rating              VARCHAR2(10),   -- e.g., PG, PG-13, R
    rating_notes        VARCHAR2(255),
    content_advisory    CLOB,           -- Detailed content warnings
    
    -- Media URLs
    poster_url          VARCHAR2(500),
    backdrop_url        VARCHAR2(500),
    logo_url            VARCHAR2(500),
    still_url           VARCHAR2(500),
    
    -- Popularity metrics
    popularity          NUMBER(10,2),
    vote_average        NUMBER(3,1),
    vote_count          NUMBER(8),
    tmdb_popularity     NUMBER(10,2),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'DELETED')),
    is_adult            CHAR(1)         DEFAULT 'N' CHECK (is_adult IN ('Y', 'N')),
    is_animated         CHAR(1)         DEFAULT 'N' CHECK (is_animated IN ('Y', 'N')),
    is_foreign          CHAR(1)         DEFAULT 'N' CHECK (is_foreign IN ('Y', 'N')),
    is_short_film       CHAR(1)         DEFAULT 'N' CHECK (is_short_film IN ('Y', 'N')),
    is_documentary      CHAR(1)         DEFAULT 'N' CHECK (is_documentary IN ('Y', 'N')),
    
    -- Source tracking
    source_system       VARCHAR2(30),   -- TMDb, OMDb, VidAPI, etc.
    source_last_sync    TIMESTAMP,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_movies_tmdb ON movies(tmdb_id);
CREATE INDEX idx_movies_imdb ON movies(imdb_id);
CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_movies_release ON movies(release_date);
CREATE INDEX idx_movies_status ON movies(status);
CREATE INDEX idx_movies_popularity ON movies(popularity DESC);
CREATE INDEX idx_movies_rating ON movies(rating);
CREATE INDEX idx_movies_title_sort ON movies(title_sortable);

-- ============================================================
-- ACTORS (Master actor/actress reference)
-- ============================================================
CREATE TABLE actors (
    actor_id            NUMBER(12)      PRIMARY KEY,
    actor_guid          VARCHAR2(36)    UNIQUE,
    
    -- External IDs
    tmdb_person_id      VARCHAR2(20)    UNIQUE,
    imdb_name_id        VARCHAR2(20)    UNIQUE,
    
    -- Personal details
    first_name          VARCHAR2(50)    NOT NULL,
    last_name           VARCHAR2(50)    NOT NULL,
    middle_name         VARCHAR2(50),
    display_name        VARCHAR2(200)   GENERATED ALWAYS AS (first_name || ' ' || last_name) VIRTUAL,
    gender              VARCHAR2(1)     CHECK (gender IN ('M', 'F', 'O')),
    
    -- Professional details
    birth_date          DATE,
    birthplace          VARCHAR2(100),
    nationality         VARCHAR2(50),
    biography           CLOB,
    profile_url         VARCHAR2(500),
    popularity          NUMBER(10,2),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DECEASED')),
    
    -- Source tracking
    source_system       VARCHAR2(30),
    source_last_sync    TIMESTAMP,
    
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_actors_name ON actors(last_name, first_name);
CREATE INDEX idx_actors_tmdb ON actors(tmdb_person_id);
CREATE INDEX idx_actors_imdb ON actors(imdb_name_id);
CREATE INDEX idx_actors_popularity ON actors(popularity DESC);

-- ============================================================
-- IMAGE_TYPES (Poster, backdrop, logo, etc.)
-- ============================================================
CREATE TABLE image_types (
    image_type_id       NUMBER(12)      PRIMARY KEY,
    type_code           VARCHAR2(20)    UNIQUE NOT NULL,
    type_name           VARCHAR2(50)    NOT NULL,
    type_description    VARCHAR2(255),
    default_width       NUMBER(5),
    default_height      NUMBER(5),
    aspect_ratio        NUMBER(5,2),
    display_order       NUMBER(3)
);

INSERT INTO image_types (image_type_id, type_code, type_name, default_width, default_height, aspect_ratio) VALUES(1, 'POSTER', 'Poster', 500, 750, 2.5);
INSERT INTO image_types (image_type_id, type_code, type_name, default_width, default_height, aspect_ratio) VALUES(2, 'BACKDROP', 'Backdrop', 1920, 1080, 16.9);
INSERT INTO image_types (image_type_id, type_code, type_name, default_width, default_height, aspect_ratio) VALUES(3, 'LOGO', 'Logo', 500, 200, 2.5);
INSERT INTO image_types (image_type_id, type_code, type_name, default_width, default_height, aspect_ratio) VALUES(4, 'STILL', 'Film Still', 1920, 1080, 16.9);
INSERT INTO image_types (image_type_id, type_code, type_name, default_width, default_height, aspect_ratio) VALUES(5, 'BANNER', 'Banner', 1920, 300, 6.4);
INSERT INTO image_types (image_type_id, type_code, type_name, default_width, default_height, aspect_ratio) VALUES(6, 'COVER', 'Cover Art', 500, 500, 1.0);

-- ============================================================
-- MOVIE_TRAILERS (Video trailers)
-- ============================================================
CREATE TABLE movie_trailers (
    trailer_id          NUMBER(12)      PRIMARY KEY,
    movie_id            NUMBER(12)      NOT NULL REFERENCES movies(movie_id),
    
    -- External IDs
    youtube_id          VARCHAR2(20),
    vimeo_id            VARCHAR2(20),
    tmdb_video_id       VARCHAR2(20),
    
    -- Details
    title               VARCHAR2(200),
    description         VARCHAR2(500),
    language            VARCHAR2(10)    DEFAULT 'EN',
    
    -- URLs
    trailer_url         VARCHAR2(500)   NOT NULL,
    thumbnail_url       VARCHAR2(500),
    embed_url           VARCHAR2(500),
    
    -- Metadata
    duration_seconds    NUMBER(6),
    quality             VARCHAR2(20)    CHECK (quality IN ('SD', 'HD', 'FULL_HD', '4K', '8K')),
    is_official         CHAR(1)         DEFAULT 'Y' CHECK (is_official IN ('Y', 'N')),
    is_primary          CHAR(1)         DEFAULT 'N' CHECK (is_primary IN ('Y', 'N')),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PRIVATE', 'DELETED')),
    
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_trailers_movie ON movie_trailers(movie_id);
CREATE INDEX idx_trailers_primary ON movie_trailers(is_primary);

-- ============================================================
-- MOVIE_RATINGS (Aggregated ratings from various sources)
-- ============================================================
CREATE TABLE movie_ratings (
    movie_rating_id     NUMBER(12)      PRIMARY KEY,
    movie_id            NUMBER(12)      NOT NULL REFERENCES movies(movie_id),
    
    -- Rating sources
    rating_source       VARCHAR2(30)    NOT NULL CHECK (rating_source IN ('IMDB', 'TMDB', 'ROTTEN_TOMATOES', 'METACRITIC', 'LETTERBOXD', 'CRITICS', 'USER', 'CUSTOM')),
    rating_value        NUMBER(3,1)     NOT NULL,  -- Score out of 10
    rating_count        NUMBER(8),                 -- Number of votes
    rating_percentage   NUMBER(5,2),              -- For Rotten Tomatoes style
    
    -- Source-specific fields
    source_rating_id    VARCHAR2(50),
    source_rating_url   VARCHAR2(500),
    
    -- Metadata
    is_official         CHAR(1)         DEFAULT 'N' CHECK (is_official IN ('Y', 'N')),
    
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER,
    
    CONSTRAINT uq_movie_rating_source UNIQUE (movie_id, rating_source)
);

CREATE INDEX idx_ratings_movie ON movie_ratings(movie_id);
CREATE INDEX idx_ratings_source ON movie_ratings(rating_source);
CREATE INDEX idx_ratings_value ON movie_ratings(rating_value DESC);

-- ============================================================
-- MOVIE_STUDIOS (Production companies)
-- ============================================================
CREATE TABLE movie_studios (
    studio_id           NUMBER(12)      PRIMARY KEY,
    studio_name         VARCHAR2(100)   UNIQUE NOT NULL,
    studio_code         VARCHAR2(20)    UNIQUE,
    studio_description  VARCHAR2(255),
    
    -- Contact
    headquarters        VARCHAR2(200),
    website             VARCHAR2(200),
    founded_year        NUMBER(4),
    
    -- Metadata
    tmdb_company_id     VARCHAR2(20)    UNIQUE,
    is_major_studio     CHAR(1)         DEFAULT 'N' CHECK (is_major_studio IN ('Y', 'N')),
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DEFUNCT')),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE
);

-- Insert major studios
INSERT INTO movie_studios (studio_id, studio_name, studio_code, tmdb_company_id, is_major_studio) VALUES(1, 'Warner Bros. Pictures', 'WB', '174', 'Y');
INSERT INTO movie_studios (studio_id, studio_name, studio_code, tmdb_company_id, is_major_studio) VALUES(2, 'Universal Pictures', 'UNI', '33', 'Y');
INSERT INTO movie_studios (studio_id, studio_name, studio_code, tmdb_company_id, is_major_studio) VALUES(3, 'Paramount Pictures', 'PAR', '4', 'Y');
INSERT INTO movie_studios (studio_id, studio_name, studio_code, tmdb_company_id, is_major_studio) VALUES(4, 'Walt Disney Studios', 'DIS', '2', 'Y');
INSERT INTO movie_studios (studio_id, studio_name, studio_code, tmdb_company_id, is_major_studio) VALUES(5, 'Sony Pictures Entertainment', 'SPE', '5', 'Y');
INSERT INTO movie_studios (studio_id, studio_name, studio_code, tmdb_company_id, is_major_studio) VALUES(6, '20th Century Studios', '20CS', '25', 'Y');
INSERT INTO movie_studios (studio_id, studio_name, studio_code, tmdb_company_id, is_major_studio) VALUES(7, 'Marvel Studios', 'MARVEL', '420', 'N');
INSERT INTO movie_studios (studio_id, studio_name, studio_code, tmdb_company_id, is_major_studio) VALUES(8, 'DC Studios', 'DC', '9996', 'N');


-- ============================================================
-- SHOWTIMES (Every screening instance)
-- ============================================================
CREATE TABLE showtimes (
    showtime_id         NUMBER(12)      PRIMARY KEY,
    showtime_guid       VARCHAR2(36)    UNIQUE,
    
    -- References
    movie_id            NUMBER(12)      NOT NULL REFERENCES movies(movie_id),
    screen_id           NUMBER(12)      NOT NULL REFERENCES screens(screen_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Schedule dates
    show_date           DATE            NOT NULL,
    start_time          TIMESTAMP       NOT NULL,   -- Full timestamp with timezone
    end_time            TIMESTAMP,                  -- Calculated from start + runtime
    scheduled_start     TIMESTAMP       NOT NULL,   -- Original scheduled time (for changes tracking)
    scheduled_end       TIMESTAMP,
    
    -- Showtime details
    session_type        VARCHAR2(30)    NOT NULL CHECK (session_type IN ('MORNING', 'MATINEE', 'EVENING', 'LATE_NIGHT', 'SPECIAL', 'PREMIERE')),
    session_timing      VARCHAR2(20)    CHECK (session_timing IN ('EARLY_BIRD', 'STANDARD', 'PRIME', 'LATE_NIGHT')),
    
    -- Capacity and sales
    total_capacity      NUMBER(6)       NOT NULL,   -- From screen capacity
    available_seats     NUMBER(6)       NOT NULL,   -- Current availability
    reserved_seats      NUMBER(6)       DEFAULT 0,
    sold_seats          NUMBER(6)       DEFAULT 0,
    complimentary_seats NUMBER(6)       DEFAULT 0,   -- Free seats for staff/VIP
    cancelled_seats     NUMBER(6)       DEFAULT 0,
    
    -- Status flags
    status_id           NUMBER(12)      NOT NULL REFERENCES showtime_status(status_id),
    is_special_screening CHAR(1)        DEFAULT 'N' CHECK (is_special_screening IN ('Y', 'N')),
    is_holiday          CHAR(1)         DEFAULT 'N' CHECK (is_holiday IN ('Y', 'N')),
    is_festival         CHAR(1)         DEFAULT 'N' CHECK (is_festival IN ('Y', 'N')),
    is_school_holiday   CHAR(1)         DEFAULT 'N' CHECK (is_school_holiday IN ('Y', 'N')),
    
    -- Financials
    base_price          NUMBER(10,2)    NOT NULL,
    min_price           NUMBER(10,2),                  -- Lowest possible price (with discounts)
    max_price           NUMBER(10,2),                  -- Highest possible price (premium)
    total_revenue       NUMBER(12,2)    DEFAULT 0,
    
    -- Event categorization
    event_type          VARCHAR2(30)    DEFAULT 'MOVIE' CHECK (event_type IN ('MOVIE', 'LIVE_SPORT', 'CONCERT', 'THEATRE', 'COMEDY', 'GAMING', 'CORPORATE', 'PRIVATE', 'OTHER')),
    event_subtype       VARCHAR2(50),                 -- e.g., 'FOOTBALL', 'BASKETBALL', 'CONCERT_NAME'
    external_event_id   VARCHAR2(50),                 -- ID from external system
    
    -- Booking controls
    advance_booking_days NUMBER(3)      DEFAULT 7,
    booking_cutoff_minutes NUMBER(4)    DEFAULT 15,
    max_seats_per_booking NUMBER(3)     DEFAULT 10,
    allow_online_booking CHAR(1)        DEFAULT 'Y' CHECK (allow_online_booking IN ('Y', 'N')),
    allow_walkin        CHAR(1)         DEFAULT 'Y' CHECK (allow_walkin IN ('Y', 'N')),
    
    -- Notes
    internal_notes      CLOB,
    public_notes        CLOB,           -- Shown to customers
    cancellation_reason VARCHAR2(255),
    last_modified_reason VARCHAR2(255),
    
    -- Operational
    created_by_user     NUMBER(12)      REFERENCES staff(staff_id),
    approved_by         NUMBER(12)      REFERENCES staff(staff_id),
    approved_date       DATE,
    
    -- Version control
    version_number      NUMBER(3)       DEFAULT 1,
    version_comment     VARCHAR2(255),
    parent_showtime_id  NUMBER(12)      REFERENCES showtimes(showtime_id),  -- For rescheduled shows
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes (Critical for performance)
CREATE INDEX idx_showtimes_date ON showtimes(show_date);
CREATE INDEX idx_showtimes_start ON showtimes(start_time);
CREATE INDEX idx_showtimes_movie ON showtimes(movie_id);
CREATE INDEX idx_showtimes_screen ON showtimes(screen_id);
CREATE INDEX idx_showtimes_branch ON showtimes(branch_id);
CREATE INDEX idx_showtimes_status ON showtimes(status_id);
CREATE INDEX idx_showtimes_session ON showtimes(session_type);
CREATE INDEX idx_showtimes_event_type ON showtimes(event_type);
CREATE INDEX idx_showtimes_special ON showtimes(is_special_screening);
CREATE INDEX idx_showtimes_online ON showtimes(allow_online_booking);
CREATE INDEX idx_showtimes_available ON showtimes(available_seats) WHERE available_seats > 0;

-- Composite indexes for common queries
CREATE INDEX idx_showtimes_branch_date ON showtimes(branch_id, show_date);
CREATE INDEX idx_showtimes_movie_date ON showtimes(movie_id, show_date);
CREATE INDEX idx_showtimes_date_status ON showtimes(show_date, status_id);
CREATE INDEX idx_showtimes_branch_session ON showtimes(branch_id, session_type, show_date);


-- ============================================================
-- SHOWTIME_PRICES (Pricing for different tiers/days/times)
-- ============================================================
CREATE TABLE showtime_prices (
    price_id            NUMBER(12)      PRIMARY KEY,
    showtime_id         NUMBER(12)      NOT NULL REFERENCES showtimes(showtime_id),
    
    -- Pricing tier
    price_tier          VARCHAR2(20)    NOT NULL CHECK (price_tier IN ('STANDARD', 'PREMIUM', 'VIP', 'COMPANION', 'CHILD', 'SENIOR', 'STUDENT', 'MILITARY', 'FAMILY', 'GROUP', 'HOLIDAY', 'SPECIAL')),
    
    -- Price details
    price_amount        NUMBER(10,2)    NOT NULL,
    original_price      NUMBER(10,2),                   -- Original price before discounts
    discount_percentage NUMBER(5,2)     DEFAULT 0,
    discount_amount     NUMBER(10,2)    DEFAULT 0,
    
    -- Restrictions
    min_age             NUMBER(3),
    max_age             NUMBER(3),
    min_quantity        NUMBER(3)       DEFAULT 1,
    max_quantity        NUMBER(3)       DEFAULT 10,
    requires_id         CHAR(1)         DEFAULT 'N' CHECK (requires_id IN ('Y', 'N')),
    
    -- Availability
    available_count     NUMBER(6),                      -- Limited availability tickets
    sold_count          NUMBER(6)       DEFAULT 0,
    is_limited_time     CHAR(1)         DEFAULT 'N' CHECK (is_limited_time IN ('Y', 'N')),
    valid_from          TIMESTAMP,
    valid_until         TIMESTAMP,
    days_of_week        VARCHAR2(14),                   -- e.g., 'MON,TUE,WED'
    
    -- Eligibility
    membership_tiers    VARCHAR2(50),                   -- e.g., 'BRONZE,SILVER,GOLD'
    applicable_channels VARCHAR2(100)   DEFAULT 'ALL',  -- 'ONLINE,APP,BOX_OFFICE,KIOSK'
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED', 'SOLD_OUT')),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_prices_showtime ON showtime_prices(showtime_id);
CREATE INDEX idx_prices_tier ON showtime_prices(price_tier);
CREATE INDEX idx_prices_status ON showtime_prices(status);
CREATE INDEX idx_prices_valid ON showtime_prices(valid_from, valid_until) WHERE valid_from IS NOT NULL;

-- ============================================================
-- SHOWTIME_STATUS (Reference/Status codes)
-- ============================================================
CREATE TABLE showtime_status (
    status_id           NUMBER(12)      PRIMARY KEY,
    status_code         VARCHAR2(20)    UNIQUE NOT NULL,
    status_name         VARCHAR2(50)    NOT NULL,
    status_description  VARCHAR2(255),
    
    -- Categorization
    status_category     VARCHAR2(30)    NOT NULL CHECK (status_category IN ('SCHEDULED', 'AVAILABLE', 'SALES', 'UNAVAILABLE', 'TERMINAL', 'ADMIN')),
    display_order       NUMBER(3),
    is_customer_visible CHAR(1)         DEFAULT 'Y' CHECK (is_customer_visible IN ('Y', 'N')),
    can_book            CHAR(1)         DEFAULT 'Y' CHECK (can_book IN ('Y', 'N')),
    
    -- Color coding for UI
    color_code          VARCHAR2(7),                    -- Hex color
    icon_class          VARCHAR2(50),                   -- For APEX icons
    
    -- Metadata
    is_final_state      CHAR(1)         DEFAULT 'N' CHECK (is_final_state IN ('Y', 'N')),
    requires_approval   CHAR(1)         DEFAULT 'N' CHECK (requires_approval IN ('Y', 'N')),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE
);

-- Insert default statuses
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(1, 'SCHEDULED', 'Scheduled', 'SCHEDULED', 'N', '#FFC107', 'N');
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(2, 'OPEN', 'Open for Bookings', 'AVAILABLE', 'Y', '#4CAF50', 'N');
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(3, 'ALMOST_SOLD', 'Almost Sold Out', 'AVAILABLE', 'Y', '#FF9800', 'N');
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(4, 'SOLD_OUT', 'Sold Out', 'SALES', 'N', '#F44336', 'N');
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(5, 'CLOSED', 'Closed', 'AVAILABLE', 'N', '#9E9E9E', 'N');
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(6, 'CANCELLED', 'Cancelled', 'TERMINAL', 'N', '#D32F2F', 'Y');
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(7, 'IN_PROGRESS', 'In Progress', 'UNAVAILABLE', 'N', '#2196F3', 'N');
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(8, 'COMPLETED', 'Completed', 'TERMINAL', 'N', '#4CAF50', 'Y');
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(9, 'POSTPONED', 'Postponed', 'ADMIN', 'N', '#FF5722', 'N');
INSERT INTO showtime_status (status_id, status_code, status_name, status_category, can_book, color_code, is_final_state) VALUES(10, 'RESCHEDULED', 'Rescheduled', 'ADMIN', 'N', '#FF5722', 'N');

-- ============================================================
-- MOVIE_SCREEN_ASSIGNMENTS (Historical/planned screen assignments)
-- ============================================================
CREATE TABLE movie_screen_assignments (
    assignment_id       NUMBER(12)      PRIMARY KEY,
    movie_id            NUMBER(12)      NOT NULL REFERENCES movies(movie_id),
    screen_id           NUMBER(12)      NOT NULL REFERENCES screens(screen_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Assignment period
    start_date          DATE            NOT NULL,
    end_date            DATE,
    is_current          CHAR(1)         DEFAULT 'Y' CHECK (is_current IN ('Y', 'N')),
    
    -- Assignment type
    assignment_type     VARCHAR2(30)    NOT NULL CHECK (assignment_type IN ('REGULAR', 'PREMIERE', 'SPECIAL_EVENT', 'ONE_OFF', 'FESTIVAL', 'SEASONAL')),
    
    -- Priority and booking rules
    priority            NUMBER(3)       DEFAULT 1,     -- Higher number = higher priority
    max_showings_per_day NUMBER(3)      DEFAULT 5,
    min_days_between    NUMBER(3)       DEFAULT 1,
    
    -- Notes
    assignment_notes    CLOB,
    created_by_user     NUMBER(12)      REFERENCES staff(staff_id),
    approved_by         NUMBER(12)      REFERENCES staff(staff_id),
    approved_date       DATE,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_assignments_movie ON movie_screen_assignments(movie_id);
CREATE INDEX idx_assignments_screen ON movie_screen_assignments(screen_id);
CREATE INDEX idx_assignments_branch ON movie_screen_assignments(branch_id);
CREATE INDEX idx_assignments_current ON movie_screen_assignments(is_current);
CREATE INDEX idx_assignments_date ON movie_screen_assignments(start_date, end_date);
CREATE INDEX idx_assignments_type ON movie_screen_assignments(assignment_type);

-- ============================================================
-- SPECIAL_SCREENINGS (Premieres, festivals, private events)
-- ============================================================
CREATE TABLE special_screenings (
    special_id          NUMBER(12)      PRIMARY KEY,
    showtime_id         NUMBER(12)      NOT NULL REFERENCES showtimes(showtime_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Special type
    special_type        VARCHAR2(30)    NOT NULL CHECK (special_type IN ('PREMIERE', 'FILM_FESTIVAL', 'CHARITY_EVENT', 'PRIVATE_SCREENING', 'CORPORATE_EVENT', 'DIRECTOR_CUT', 'SILENT_SCREENING', 'INTERACTIVE', 'OTHER')),
    
    -- Event details
    event_name          VARCHAR2(200)   NOT NULL,
    event_description   CLOB,
    event_organizer     VARCHAR2(100),
    organizer_contact   VARCHAR2(100),
    
    -- Guest/speaker information
    special_guests      CLOB,           -- JSON array of guest names/roles
    guest_list          CLOB,           -- JSON array of invited guests
    has_qna             CHAR(1)         DEFAULT 'N' CHECK (has_qna IN ('Y', 'N')),
    has_red_carpet      CHAR(1)         DEFAULT 'N' CHECK (has_red_carpet IN ('Y', 'N')),
    has_after_party     CHAR(1)         DEFAULT 'N' CHECK (has_after_party IN ('Y', 'N')),
    
    -- Ticket availability
    invitation_only     CHAR(1)         DEFAULT 'N' CHECK (invitation_only IN ('Y', 'N')),
    tickets_available   NUMBER(6),
    tickets_sold        NUMBER(6)       DEFAULT 0,
    vip_tickets_available NUMBER(3)     DEFAULT 0,
    vip_tickets_sold    NUMBER(3)       DEFAULT 0,
    
    -- Pricing
    price_tier          VARCHAR2(20)    DEFAULT 'SPECIAL',
    vip_price           NUMBER(10,2),
    standard_price      NUMBER(10,2),
    
    -- Marketing
    marketing_promotion VARCHAR2(500),
    poster_url          VARCHAR2(500),
    banner_url          VARCHAR2(500),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    cancellation_reason VARCHAR2(255),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_special_showtime ON special_screenings(showtime_id);
CREATE INDEX idx_special_branch ON special_screenings(branch_id);
CREATE INDEX idx_special_type ON special_screenings(special_type);
CREATE INDEX idx_special_status ON special_screenings(status);

-- ============================================================
-- SHOWTIME_EXCEPTIONS (Audit trail of showtime changes)
-- ============================================================
CREATE TABLE showtime_exceptions (
    exception_id        NUMBER(12)      PRIMARY KEY,
    showtime_id         NUMBER(12)      NOT NULL REFERENCES showtimes(showtime_id),
    
    -- Exception type
    exception_type      VARCHAR2(30)    NOT NULL CHECK (exception_type IN ('CANCELLATION', 'RESCHEDULE', 'TIME_CHANGE', 'PRICE_CHANGE', 'SCREEN_CHANGE', 'MOVIE_CHANGE', 'SEAT_CAPACITY_CHANGE', 'BOOKING_RESTRICTION_CHANGE', 'STATUS_CHANGE', 'OTHER')),
    
    -- Original values (for auditing)
    original_start_time TIMESTAMP,
    original_end_time   TIMESTAMP,
    original_screen_id  NUMBER(12),
    original_price      NUMBER(10,2),
    original_status_id  NUMBER(12),
    original_available_seats NUMBER(6),
    
    -- New values (after change)
    new_start_time      TIMESTAMP,
    new_end_time        TIMESTAMP,
    new_screen_id       NUMBER(12),
    new_price           NUMBER(10,2),
    new_status_id       NUMBER(12),
    new_available_seats NUMBER(6),
    
    -- Reason
    change_reason       VARCHAR2(255)   NOT NULL,
    change_description  CLOB,
    
    -- Notification
    customer_notified   CHAR(1)         DEFAULT 'N' CHECK (customer_notified IN ('Y', 'N')),
    notification_date   DATE,
    notification_method VARCHAR2(50),   -- 'EMAIL', 'SMS', 'PUSH', 'ALL'
    customers_affected  NUMBER(8),      -- Count of affected customers
    
    -- Approval
    approved_by_user    NUMBER(12)      REFERENCES staff(staff_id),
    approval_date       DATE,
    approval_notes      CLOB,
    
    -- Compensation
    compensation_offered CHAR(1)        DEFAULT 'N' CHECK (compensation_offered IN ('Y', 'N')),
    compensation_details CLOB,          -- JSON array of compensation offers
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_exceptions_showtime ON showtime_exceptions(showtime_id);
CREATE INDEX idx_exceptions_type ON showtime_exceptions(exception_type);
CREATE INDEX idx_exceptions_date ON showtime_exceptions(created_date DESC);
CREATE INDEX idx_exceptions_status ON showtime_exceptions(approved_by_user) WHERE approved_by_user IS NOT NULL;

-- ============================================================
-- SHOWTIME_SEAT_HOLDS (Temporary seat reservations)
-- ============================================================
CREATE TABLE showtime_seat_holds (
    hold_id             NUMBER(12)      PRIMARY KEY,
    showtime_id         NUMBER(12)      NOT NULL REFERENCES showtimes(showtime_id),
    seat_id             NUMBER(12)      NOT NULL REFERENCES seats(seat_id),
    
    -- Hold details
    hold_reference      VARCHAR2(50)    UNIQUE NOT NULL,  -- System-generated
    hold_type           VARCHAR2(20)    NOT NULL CHECK (hold_type IN ('BOOKING', 'RESERVATION', 'VIP', 'STAFF', 'COMPLIMENTARY', 'SYSTEM')),
    
    -- Customer
    customer_id         NUMBER(12)      REFERENCES customer(customer_id),
    customer_session    VARCHAR2(100),                   -- Session ID for anonymous holds
    
    -- Timing
    hold_start_time     TIMESTAMP       NOT NULL,
    hold_expiry_time    TIMESTAMP       NOT NULL,        -- When hold expires
    actual_release_time TIMESTAMP,
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'CONVERTED_TO_BOOKING')),
    
    -- Metadata
    hold_reason         VARCHAR2(255),
    notes               VARCHAR2(500),
    booking_reference   VARCHAR2(50),                   -- Reference when converted
    
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_holds_showtime ON showtime_seat_holds(showtime_id);
CREATE INDEX idx_holds_seat ON showtime_seat_holds(seat_id);
CREATE INDEX idx_holds_customer ON showtime_seat_holds(customer_id);
CREATE INDEX idx_holds_expiry ON showtime_seat_holds(hold_expiry_time);
CREATE INDEX idx_holds_status ON showtime_seat_holds(status);
CREATE INDEX idx_holds_reference ON showtime_seat_holds(hold_reference);

-- ============================================================
-- SHOWTIME_AVAILABILITY_LOG (Track availability changes)
-- ============================================================
CREATE TABLE showtime_availability_log (
    log_id              NUMBER(12)      PRIMARY KEY,
    showtime_id         NUMBER(12)      NOT NULL REFERENCES showtimes(showtime_id),
    
    -- Snapshot
    snapshot_time       TIMESTAMP       NOT NULL,
    available_seats     NUMBER(6)       NOT NULL,
    sold_seats          NUMBER(6)       NOT NULL,
    reserved_seats      NUMBER(6)       NOT NULL,
    held_seats          NUMBER(6)       NOT NULL,
    
    -- Activity
    seats_changed       NUMBER(6)       NOT NULL,       -- Net change
    change_type         VARCHAR2(30)    NOT NULL CHECK (change_type IN ('SALE', 'RESERVATION', 'HOLD', 'RELEASE', 'REFUND', 'CANCELLATION', 'ADJUSTMENT')),
    transaction_id      VARCHAR2(50),                   -- Linked transaction
    
    created_date        DATE            DEFAULT SYSDATE
);

CREATE INDEX idx_avail_showtime ON showtime_availability_log(showtime_id);
CREATE INDEX idx_avail_time ON showtime_availability_log(snapshot_time DESC);
CREATE INDEX idx_avail_type ON showtime_availability_log(change_type);


-- ============================================================
-- BOOKINGS (Master booking/reservation record)
-- ============================================================
CREATE TABLE bookings (
    booking_id          NUMBER(12)      PRIMARY KEY,
    booking_reference   VARCHAR2(20)    UNIQUE NOT NULL,  -- User-friendly reference (e.g., BKG-2024-0001)
    booking_guid        VARCHAR2(36)    UNIQUE,
    
    -- Links
    customer_id         NUMBER(12)      NOT NULL REFERENCES customers(customer_id),
    showtime_id         NUMBER(12)      NOT NULL REFERENCES showtimes(showtime_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Booking details
    booking_date        TIMESTAMP       NOT NULL,
    booking_channel     VARCHAR2(30)    NOT NULL CHECK (booking_channel IN ('ONLINE', 'MOBILE_APP', 'BOX_OFFICE', 'KIOSK', 'CALL_CENTER', 'THIRD_PARTY', 'WALK_IN', 'OTHER')),
    booking_source      VARCHAR2(50),                    -- Specific source (e.g., 'WEBSITE', 'ANDROID', 'IOS')
    booking_device      VARCHAR2(50),                    -- Device fingerprint
    
    -- Customer session
    session_id          VARCHAR2(100),                   -- Web session ID
    ip_address          VARCHAR2(45),
    user_agent          VARCHAR2(255),
    
    -- Seat counts
    total_seats         NUMBER(3)       NOT NULL,
    total_tickets       NUMBER(3)       NOT NULL,
    
    -- Financials
    subtotal            NUMBER(10,2)    NOT NULL,
    discount_total      NUMBER(10,2)    DEFAULT 0,
    tax_total           NUMBER(10,2)    DEFAULT 0,
    service_fee         NUMBER(10,2)    DEFAULT 0,
    total_amount        NUMBER(10,2)    NOT NULL,
    amount_paid         NUMBER(10,2)    DEFAULT 0,
    amount_refunded     NUMBER(10,2)    DEFAULT 0,
    balance_due         NUMBER(10,2)    GENERATED ALWAYS AS (total_amount - amount_paid + amount_refunded) VIRTUAL,
    
    -- Promotions
    promotion_id        NUMBER(12)      REFERENCES promotions(promotion_id),
    promotion_code      VARCHAR2(30),
    discount_details    CLOB,           -- JSON of applied promotions
    
    -- Payment
    payment_status      VARCHAR2(20)    DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED', 'VOID')),
    payment_method      VARCHAR2(30)    CHECK (payment_method IN ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'GIFT_CARD', 'VOUCHER', 'LOYALTY_POINTS', 'BANK_TRANSFER', 'CRYPTO')),
    payment_gateway     VARCHAR2(50),                   -- e.g., 'PAYSTACK', 'FLUTTERWAVE'
    payment_transaction_id VARCHAR2(100),               -- Gateway reference
    payment_date        TIMESTAMP,
    
    -- Loyalty
    loyalty_points_used NUMBER(6)       DEFAULT 0,
    loyalty_points_earned NUMBER(6)     DEFAULT 0,
    
    -- Status
    booking_status      VARCHAR2(20)    NOT NULL CHECK (booking_status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED', 'NO_SHOW', 'EXCHANGED')),
    status_date         TIMESTAMP       DEFAULT SYSTIMESTAMP,
    status_changed_by   VARCHAR2(30),
    
    -- Timestamps
    confirmed_date      TIMESTAMP,
    check_in_date       TIMESTAMP,
    completed_date      TIMESTAMP,
    cancelled_date      TIMESTAMP,
    cancellation_reason VARCHAR2(255),
    
    -- Customer communication
    confirmation_sent   CHAR(1)         DEFAULT 'N' CHECK (confirmation_sent IN ('Y', 'N')),
    confirmation_date   TIMESTAMP,
    reminder_sent       CHAR(1)         DEFAULT 'N' CHECK (reminder_sent IN ('Y', 'N')),
    reminder_date       TIMESTAMP,
    
    -- Notes
    special_instructions CLOB,
    internal_notes      CLOB,
    
    -- Version control
    version_number      NUMBER(3)       DEFAULT 1,
    parent_booking_id   NUMBER(12)      REFERENCES bookings(booking_id),  -- For exchanges/modifications
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_bookings_reference ON bookings(booking_reference);
CREATE INDEX idx_bookings_customer ON bookings(customer_id);
CREATE INDEX idx_bookings_showtime ON bookings(showtime_id);
CREATE INDEX idx_bookings_branch ON bookings(branch_id);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_payment ON bookings(payment_status);
CREATE INDEX idx_bookings_channel ON bookings(booking_channel);

-- Composite indexes for common queries
CREATE INDEX idx_bookings_customer_status ON bookings(customer_id, booking_status);
CREATE INDEX idx_bookings_showtime_status ON bookings(showtime_id, booking_status);
CREATE INDEX idx_bookings_date_branch ON bookings(booking_date, branch_id);
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status, payment_method);

-- ============================================================
-- BOOKING_SEATS (Seats associated with a booking)
-- ============================================================
CREATE TABLE booking_seats (
    booking_seat_id     NUMBER(12)      PRIMARY KEY,
    booking_id          NUMBER(12)      NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    seat_id             NUMBER(12)      NOT NULL REFERENCES seats(seat_id),
    showtime_id         NUMBER(12)      NOT NULL REFERENCES showtimes(showtime_id),
    
    -- Ticket details
    ticket_id           NUMBER(12)      REFERENCES tickets(ticket_id),     -- Generated ticket
    ticket_type_id      NUMBER(12)      NOT NULL REFERENCES ticket_types(ticket_type_id),
    
    -- Seat pricing
    seat_price          NUMBER(10,2)    NOT NULL,
    discount_amount     NUMBER(10,2)    DEFAULT 0,
    tax_amount          NUMBER(10,2)    DEFAULT 0,
    total_price         NUMBER(10,2)    NOT NULL,   -- Price after discounts/tax
    
    -- Discount details
    promotion_id        NUMBER(12)      REFERENCES promotions(promotion_id),
    discount_reason     VARCHAR2(50),               -- 'EARLY_BIRD', 'STUDENT', 'LOYALTY', etc.
    
    -- Seat assignment
    row_letter          VARCHAR2(2)     NOT NULL,   -- Denormalized for quick display
    seat_number         VARCHAR2(10)    NOT NULL,
    
    -- Customer details
    attendee_name       VARCHAR2(100),               -- If ticket is assigned to a specific person
    attendee_email      VARCHAR2(100),
    attendee_phone      VARCHAR2(20),
    attendee_age_group  VARCHAR2(20),               -- ADULT, CHILD, SENIOR
    
    -- Special needs
    requires_accessibility CHAR(1)      DEFAULT 'N' CHECK (requires_accessibility IN ('Y', 'N')),
    special_requests    VARCHAR2(255),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN', 'USED', 'REFUNDED', 'CANCELLED', 'EXCHANGED')),
    status_date         TIMESTAMP       DEFAULT SYSTIMESTAMP,
    
    -- Check-in
    checked_in_at       TIMESTAMP,
    checked_in_by       VARCHAR2(30),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_booking_seats_booking ON booking_seats(booking_id);
CREATE INDEX idx_booking_seats_seat ON booking_seats(seat_id);
CREATE INDEX idx_booking_seats_showtime ON booking_seats(showtime_id);
CREATE INDEX idx_booking_seats_ticket ON booking_seats(ticket_id);
CREATE INDEX idx_booking_seats_status ON booking_seats(status);
CREATE INDEX idx_booking_seats_type ON booking_seats(ticket_type_id);

-- Unique constraint to prevent double-booking
CREATE UNIQUE INDEX uq_booking_seats_showtime_seat 
ON booking_seats(showtime_id, seat_id) 
WHERE status NOT IN ('CANCELLED', 'REFUNDED', 'EXCHANGED');


-- ============================================================
-- TICKETS (Individual tickets issued)
-- ============================================================
CREATE TABLE tickets (
    ticket_id           NUMBER(12)      PRIMARY KEY,
    ticket_number       VARCHAR2(30)    UNIQUE NOT NULL,  -- User-friendly ticket number
    booking_seat_id     NUMBER(12)      NOT NULL REFERENCES booking_seats(booking_seat_id) UNIQUE,
    booking_id          NUMBER(12)      NOT NULL REFERENCES bookings(booking_id),
    
    -- Ticket details
    ticket_type_id      NUMBER(12)      NOT NULL REFERENCES ticket_types(ticket_type_id),
    ticket_status_id    NUMBER(12)      NOT NULL REFERENCES ticket_status(ticket_status_id),
    
    -- Barcode/QR
    barcode_data        VARCHAR2(100)   UNIQUE,          -- Raw barcode data
    qr_code_id          NUMBER(12)      REFERENCES qr_codes(qr_code_id),
    
    -- Ticket content
    movie_title         VARCHAR2(200)   NOT NULL,        -- Denormalized for ticket printing
    screen_name         VARCHAR2(50)    NOT NULL,
    showtime_date       TIMESTAMP       NOT NULL,
    seat_label          VARCHAR2(20)    NOT NULL,        -- e.g., "A12"
    ticket_price        NUMBER(10,2)    NOT NULL,
    
    -- Customer
    customer_name       VARCHAR2(100),
    customer_email      VARCHAR2(100),
    customer_phone      VARCHAR2(20),
    
    -- Usage
    issued_date         TIMESTAMP       DEFAULT SYSTIMESTAMP,
    printed_date        TIMESTAMP,
    printed_by          VARCHAR2(30),
    used_date           TIMESTAMP,
    used_at             TIMESTAMP,                       -- Scan time
    used_by             VARCHAR2(30),                    -- Staff who scanned
    entry_gate          VARCHAR2(20),                    -- Gate/entry point
    
    -- Refund/Exchange
    refund_date         TIMESTAMP,
    refund_id           NUMBER(12)      REFERENCES refunds(refund_id),
    exchange_date       TIMESTAMP,
    exchange_id         NUMBER(12)      REFERENCES exchanges(exchange_id),
    
    -- Delivery
    delivery_method     VARCHAR2(30)    CHECK (delivery_method IN ('PRINT_AT_HOME', 'MOBILE', 'BOX_OFFICE', 'EMAIL', 'SMS')),
    delivery_address    VARCHAR2(255),
    
    -- Metadata
    is_comp              CHAR(1)        DEFAULT 'N' CHECK (is_comp IN ('Y', 'N')),
    is_online_purchase  CHAR(1)         DEFAULT 'Y' CHECK (is_online_purchase IN ('Y', 'N')),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_tickets_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_booking ON tickets(booking_id);
CREATE INDEX idx_tickets_booking_seat ON tickets(booking_seat_id);
CREATE INDEX idx_tickets_status ON tickets(ticket_status_id);
CREATE INDEX idx_tickets_qr ON tickets(qr_code_id);
CREATE INDEX idx_tickets_barcode ON tickets(barcode_data) WHERE barcode_data IS NOT NULL;
CREATE INDEX idx_tickets_used ON tickets(used_date) WHERE used_date IS NOT NULL;
CREATE INDEX idx_tickets_customer ON tickets(customer_email);

-- ============================================================
-- TICKET_TYPES (Adult, Child, Senior, Student, etc.)
-- ============================================================
CREATE TABLE ticket_types (
    ticket_type_id      NUMBER(12)      PRIMARY KEY,
    type_code           VARCHAR2(20)    UNIQUE NOT NULL,
    type_name           VARCHAR2(50)    NOT NULL,
    type_description    VARCHAR2(255),
    
    -- Categorization
    category            VARCHAR2(30)    NOT NULL CHECK (category IN ('ADULT', 'CHILD', 'SENIOR', 'STUDENT', 'FAMILY', 'MILITARY', 'VIP', 'COMP', 'STAFF', 'PREMIUM', 'OTHER')),
    age_range_min       NUMBER(3),
    age_range_max       NUMBER(3),
    
    -- Pricing
    default_price       NUMBER(10,2)    NOT NULL,
    discount_percentage NUMBER(5,2)     DEFAULT 0,
    is_discount_eligible CHAR(1)        DEFAULT 'N' CHECK (is_discount_eligible IN ('Y', 'N')),
    requires_id         CHAR(1)         DEFAULT 'N' CHECK (requires_id IN ('Y', 'N')),
    
    -- Availability
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    display_order       NUMBER(3),
    
    -- Metadata
    color_code          VARCHAR2(7),                    -- For UI
    icon_class          VARCHAR2(50),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE
);

-- Insert default ticket types
INSERT INTO ticket_types (ticket_type_id, type_code, type_name, category, default_price, display_order) VALUES(1, 'ADULT', 'Adult', 'ADULT', 15.00, 1);
INSERT INTO ticket_types (ticket_type_id, type_code, type_name, category, default_price, display_order) VALUES(2, 'CHILD', 'Child (Ages 3-12)', 'CHILD', 10.00, 2);
INSERT INTO ticket_types (ticket_type_id, type_code, type_name, category, default_price, display_order) VALUES(3, 'SENIOR', 'Senior (60+)', 'SENIOR', 12.00, 3);
INSERT INTO ticket_types (ticket_type_id, type_code, type_name, category, default_price, display_order) VALUES(4, 'STUDENT', 'Student', 'STUDENT', 12.00, 4);
INSERT INTO ticket_types (ticket_type_id, type_code, type_name, category, default_price, display_order) VALUES(5, 'VIP', 'VIP/Executive', 'VIP', 25.00, 5);
INSERT INTO ticket_types (ticket_type_id, type_code, type_name, category, default_price, display_order) VALUES(6, 'COMP', 'Complimentary', 'COMP', 0.00, 6);
INSERT INTO ticket_types (ticket_type_id, type_code, type_name, category, default_price, display_order) VALUES(7, 'STAFF', 'Staff', 'STAFF', 0.00, 7);
INSERT INTO ticket_types (ticket_type_id, type_code, type_name, category, default_price, display_order) VALUES(8, 'FAMILY', 'Family Pack (4+)', 'FAMILY', 12.00, 8);

-- ============================================================
-- TICKET_STATUS (Active, Used, Refunded, etc.)
-- ============================================================
CREATE TABLE ticket_status (
    ticket_status_id    NUMBER(12)      PRIMARY KEY,
    status_code         VARCHAR2(20)    UNIQUE NOT NULL,
    status_name         VARCHAR2(50)    NOT NULL,
    status_description  VARCHAR2(255),
    
    -- Categorization
    category            VARCHAR2(30)    NOT NULL CHECK (category IN ('ACTIVE', 'USED', 'INACTIVE', 'TERMINAL')),
    is_valid_for_entry  CHAR(1)         DEFAULT 'Y' CHECK (is_valid_for_entry IN ('Y', 'N')),
    is_redeemable       CHAR(1)         DEFAULT 'N' CHECK (is_redeemable IN ('Y', 'N')),
    
    -- Display
    color_code          VARCHAR2(7),
    display_order       NUMBER(3),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE
);

-- Insert default statuses
INSERT INTO ticket_status (ticket_status_id, status_code, status_name, category, is_valid_for_entry, display_order) VALUES(1, 'ISSUED', 'Issued', 'ACTIVE', 'Y', 1);
INSERT INTO ticket_status (ticket_status_id, status_code, status_name, category, is_valid_for_entry, display_order) VALUES(2, 'PRINTED', 'Printed', 'ACTIVE', 'Y', 2);
INSERT INTO ticket_status (ticket_status_id, status_code, status_name, category, is_valid_for_entry, display_order) VALUES(3, 'USED', 'Used/Entered', 'USED', 'N', 3);
INSERT INTO ticket_status (ticket_status_id, status_code, status_name, category, is_valid_for_entry, display_order) VALUES(4, 'REFUNDED', 'Refunded', 'TERMINAL', 'N', 4);
INSERT INTO ticket_status (ticket_status_id, status_code, status_name, category, is_valid_for_entry, display_order) VALUES(5, 'CANCELLED', 'Cancelled', 'TERMINAL', 'N', 5);
INSERT INTO ticket_status (ticket_status_id, status_code, status_name, category, is_valid_for_entry, display_order) VALUES(6, 'EXPIRED', 'Expired', 'TERMINAL', 'N', 6);
INSERT INTO ticket_status (ticket_status_id, status_code, status_name, category, is_valid_for_entry, display_order) VALUES(7, 'EXCHANGED', 'Exchanged', 'TERMINAL', 'N', 7);

-- ============================================================
-- QR_CODES (QR code generation and storage)
-- ============================================================
CREATE TABLE qr_codes (
    qr_code_id          NUMBER(12)      PRIMARY KEY,
    ticket_id           NUMBER(12)      REFERENCES tickets(ticket_id) UNIQUE,
    booking_seat_id     NUMBER(12)      REFERENCES booking_seats(booking_seat_id) UNIQUE,
    
    -- QR data
    qr_code_data        VARCHAR2(500)   NOT NULL,        -- Raw data encoded in QR
    qr_code_text        CLOB,                            -- Human-readable version
    qr_code_url         VARCHAR2(500),                   -- URL to QR image
    
    -- QR generation
    generated_at        TIMESTAMP       NOT NULL,
    generated_by        VARCHAR2(30)    DEFAULT USER,
    generation_method   VARCHAR2(30)    CHECK (generation_method IN ('API', 'BATCH', 'MANUAL', 'SYSTEM')),
    
    -- QR version
    qr_version          VARCHAR2(10),                    -- QR code version
    qr_error_correction VARCHAR2(10)    CHECK (qr_error_correction IN ('L', 'M', 'Q', 'H')),
    
    -- Metadata
    expires_at          TIMESTAMP,
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    usage_count         NUMBER(5)       DEFAULT 0,
    last_used_at        TIMESTAMP,
    
    -- Security
    security_hash       VARCHAR2(64),                    -- For validation
    is_validated        CHAR(1)         DEFAULT 'N' CHECK (is_validated IN ('Y', 'N')),
    validation_token    VARCHAR2(50),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE
);

CREATE INDEX idx_qr_ticket ON qr_codes(ticket_id);
CREATE INDEX idx_qr_booking_seat ON qr_codes(booking_seat_id);
CREATE INDEX idx_qr_data ON qr_codes(qr_code_data);
CREATE INDEX idx_qr_active ON qr_codes(is_active);

-- ============================================================
-- REFUNDS (Refund transactions)
-- ============================================================
CREATE TABLE refunds (
    refund_id           NUMBER(12)      PRIMARY KEY,
    refund_reference    VARCHAR2(30)    UNIQUE NOT NULL,
    booking_id          NUMBER(12)      NOT NULL REFERENCES bookings(booking_id),
    
    -- Refund details
    refund_type         VARCHAR2(30)    NOT NULL CHECK (refund_type IN ('FULL', 'PARTIAL', 'SEAT_SPECIFIC', 'TAX_ONLY', 'SERVICE_FEE_ONLY')),
    refund_reason       VARCHAR2(50)    NOT NULL CHECK (refund_reason IN ('CUSTOMER_REQUEST', 'CANCELLATION', 'RESCHEDULE', 'DUPLICATE', 'FRAUD', 'TECHNICAL_ISSUE', 'MISCHARGE', 'OTHER')),
    refund_description  CLOB,
    
    -- Financials
    refund_amount       NUMBER(10,2)    NOT NULL,
    refund_tax          NUMBER(10,2)    DEFAULT 0,
    refund_fee          NUMBER(10,2)    DEFAULT 0,        -- Processing fee
    net_refund          NUMBER(10,2)    GENERATED ALWAYS AS (refund_amount - refund_fee) VIRTUAL,
    
    -- Payment reversal
    original_payment_method VARCHAR2(30),
    original_transaction_id VARCHAR2(100),
    refund_payment_method VARCHAR2(30),
    refund_transaction_id VARCHAR2(100),
    refund_gateway      VARCHAR2(50),
    refund_status       VARCHAR2(20)    DEFAULT 'PENDING' CHECK (refund_status IN ('PENDING', 'PROCESSED', 'FAILED', 'COMPLETED', 'CANCELLED')),
    
    -- Affected tickets
    ticket_ids          CLOB,            -- JSON array of ticket IDs refunded
    seat_ids            CLOB,            -- JSON array of seat IDs refunded
    ticket_count        NUMBER(3),
    
    -- Processing
    requested_date      TIMESTAMP       NOT NULL,
    requested_by        VARCHAR2(30)    DEFAULT USER,
    processed_date      TIMESTAMP,
    processed_by        VARCHAR2(30),
    approved_by         VARCHAR2(30),
    approval_date       TIMESTAMP,
    
    -- Customer communication
    notified_customer   CHAR(1)         DEFAULT 'N' CHECK (notified_customer IN ('Y', 'N')),
    notification_date   TIMESTAMP,
    
    -- Notes
    internal_notes      CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_refunds_booking ON refunds(booking_id);
CREATE INDEX idx_refunds_reference ON refunds(refund_reference);
CREATE INDEX idx_refunds_status ON refunds(refund_status);
CREATE INDEX idx_refunds_date ON refunds(requested_date);

-- ============================================================
-- EXCHANGES (Ticket exchanges/upgrades/downgrades)
-- ============================================================
CREATE TABLE exchanges (
    exchange_id         NUMBER(12)      PRIMARY KEY,
    exchange_reference  VARCHAR2(30)    UNIQUE NOT NULL,
    
    -- Source booking
    original_booking_id NUMBER(12)      NOT NULL REFERENCES bookings(booking_id),
    original_ticket_ids CLOB,            -- JSON array of original ticket IDs
    
    -- New booking
    new_booking_id      NUMBER(12)      NOT NULL REFERENCES bookings(booking_id),
    new_ticket_ids      CLOB,            -- JSON array of new ticket IDs
    
    -- Exchange details
    exchange_type       VARCHAR2(30)    NOT NULL CHECK (exchange_type IN ('UPGRADE', 'DOWNGRADE', 'SEAT_CHANGE', 'MOVIE_CHANGE', 'DATE_CHANGE', 'TIME_CHANGE', 'THEATER_CHANGE', 'MULTI_CHANGE')),
    exchange_reason     VARCHAR2(50)    NOT NULL CHECK (exchange_reason IN ('CUSTOMER_REQUEST', 'TECHNICAL_ISSUE', 'CINEMA_CHANGE', 'MOVIE_CANCELLATION', 'RESCHEDULE', 'UPGRADE_OFFER', 'COMPLAINT_RESOLUTION', 'OTHER')),
    exchange_description CLOB,
    
    -- Financials
    original_value      NUMBER(10,2)    NOT NULL,
    new_value           NUMBER(10,2)    NOT NULL,
    price_difference    NUMBER(10,2)    GENERATED ALWAYS AS (new_value - original_value) VIRTUAL,
    additional_charge   NUMBER(10,2)    DEFAULT 0,
    refund_amount       NUMBER(10,2)    DEFAULT 0,
    exchange_fee        NUMBER(10,2)    DEFAULT 0,
    
    -- Processing
    requested_date      TIMESTAMP       NOT NULL,
    requested_by        VARCHAR2(30)    DEFAULT USER,
    processed_date      TIMESTAMP,
    processed_by        VARCHAR2(30),
    approved_by         VARCHAR2(30),
    approval_date       TIMESTAMP,
    
    -- Customer communication
    notified_customer   CHAR(1)         DEFAULT 'N' CHECK (notified_customer IN ('Y', 'N')),
    notification_date   TIMESTAMP,
    
    -- Notes
    internal_notes      CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_exchanges_original ON exchanges(original_booking_id);
CREATE INDEX idx_exchanges_new ON exchanges(new_booking_id);
CREATE INDEX idx_exchanges_reference ON exchanges(exchange_reference);
CREATE INDEX idx_exchanges_type ON exchanges(exchange_type);

-- ============================================================
-- TICKETING_SEQUENCES (Sequence management for ticket numbers)
-- ============================================================
CREATE TABLE ticketing_sequences (
    seq_id              NUMBER(12)      PRIMARY KEY,
    seq_name            VARCHAR2(50)    UNIQUE NOT NULL,
    seq_prefix          VARCHAR2(10),
    seq_suffix          VARCHAR2(10),
    seq_current_value   NUMBER(12)      DEFAULT 0,
    seq_format          VARCHAR2(50),                    -- e.g., 'BKG-YYYY-{seq}'
    last_reset_date     DATE,
    reset_interval      VARCHAR2(20)    CHECK (reset_interval IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'NEVER')),
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N'))
);

-- Insert default sequences
INSERT INTO ticketing_sequences (seq_id, seq_name, seq_prefix, seq_current_value, seq_format, reset_interval) VALUES(1, 'BOOKING_REFERENCE', 'BKG-', 1000, 'BKG-{YYYY}-{seq}', 'YEARLY'),
INSERT INTO ticketing_sequences (seq_id, seq_name, seq_prefix, seq_current_value, seq_format, reset_interval) VALUES(2, 'TICKET_NUMBER', 'TKT-', 10000, 'TKT-{seq}', 'NEVER');
INSERT INTO ticketing_sequences (seq_id, seq_name, seq_prefix, seq_current_value, seq_format, reset_interval) VALUES(3, 'REFUND_REFERENCE', 'REF-', 100, 'REF-{YYYY}-{seq}', 'YEARLY');
INSERT INTO ticketing_sequences (seq_id, seq_name, seq_prefix, seq_current_value, seq_format, reset_interval) VALUES(4, 'EXCHANGE_REFERENCE', 'EXC-', 100, 'EXC-{YYYY}-{seq}', 'YEARLY');


-- ============================================================
-- PAYMENTS (Core payment transactions)
-- ============================================================
CREATE TABLE payments (
    payment_id          NUMBER(12)      PRIMARY KEY,
    payment_reference   VARCHAR2(30)    UNIQUE NOT NULL,  -- User-friendly reference (e.g., PAY-2024-0001)
    payment_guid        VARCHAR2(36)    UNIQUE,
    
    -- Links
    booking_id          NUMBER(12)      REFERENCES bookings(booking_id),
    customer_id         NUMBER(12)      NOT NULL REFERENCES customers(customer_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Payment details
    payment_date        TIMESTAMP       NOT NULL,
    payment_method_id   NUMBER(12)      NOT NULL REFERENCES payment_methods(payment_method_id),
    payment_gateway_id  NUMBER(12)      REFERENCES payment_gateways(payment_gateway_id),
    payment_type        VARCHAR2(30)    NOT NULL CHECK (payment_type IN ('TICKET', 'CONCESSION', 'GIFT_CARD_PURCHASE', 'LOYALTY_TOPUP', 'DEPOSIT', 'REFUND', 'OTHER')),
    
    -- Financials
    gross_amount        NUMBER(10,2)    NOT NULL,
    discount_amount     NUMBER(10,2)    DEFAULT 0,
    tax_amount          NUMBER(10,2)    DEFAULT 0,
    fee_amount          NUMBER(10,2)    DEFAULT 0,        -- Gateway/processing fee
    net_amount          NUMBER(10,2)    NOT NULL,         -- Amount actually charged
    currency            VARCHAR2(3)     NOT NULL DEFAULT 'GHS',
    exchange_rate       NUMBER(10,4)    DEFAULT 1,
    local_amount        NUMBER(10,2),                     -- Amount in local currency if different
    
    -- Status tracking
    payment_status_id   NUMBER(12)      NOT NULL REFERENCES payment_status(payment_status_id),
    status_date         TIMESTAMP       DEFAULT SYSTIMESTAMP,
    
    -- Gateway reference
    gateway_reference   VARCHAR2(100),                    -- External reference from gateway
    gateway_response    CLOB,                             -- Full response from gateway
    gateway_error_code  VARCHAR2(50),
    gateway_error_msg   VARCHAR2(255),
    
    -- Authorization
    auth_code           VARCHAR2(50),
    auth_date           TIMESTAMP,
    auth_reference      VARCHAR2(100),
    
    -- Settlement
    settlement_date     DATE,
    settlement_reference VARCHAR2(100),
    settlement_status   VARCHAR2(20)    CHECK (settlement_status IN ('PENDING', 'SETTLED', 'FAILED', 'CANCELLED')),
    
    -- Split payments
    is_split_payment    CHAR(1)         DEFAULT 'N' CHECK (is_split_payment IN ('Y', 'N')),
    parent_payment_id   NUMBER(12)      REFERENCES payments(payment_id),
    
    -- Customer information (denormalized)
    customer_email      VARCHAR2(100),
    customer_phone      VARCHAR2(20),
    customer_name       VARCHAR2(100),
    
    -- Device and channel
    payment_channel     VARCHAR2(30)    NOT NULL CHECK (payment_channel IN ('ONLINE', 'MOBILE_APP', 'BOX_OFFICE', 'KIOSK', 'POS_TERMINAL', 'THIRD_PARTY')),
    device_info         VARCHAR2(255),
    ip_address          VARCHAR2(45),
    user_agent          VARCHAR2(255),
    
    -- Fraud detection
    fraud_score         NUMBER(3,2),                     -- 0-1 score
    fraud_checks_passed CHAR(1)         DEFAULT 'Y' CHECK (fraud_checks_passed IN ('Y', 'N')),
    fraud_notes         CLOB,
    
    -- Metadata
    invoice_id          NUMBER(12)      REFERENCES invoices(invoice_id),
    receipt_id          NUMBER(12)      REFERENCES receipts(receipt_id),
    receipt_sent        CHAR(1)         DEFAULT 'N' CHECK (receipt_sent IN ('Y', 'N')),
    receipt_sent_date   TIMESTAMP,
    
    -- Notes
    internal_notes      CLOB,
    customer_notes      CLOB,
    
    -- Version control
    version_number      NUMBER(3)       DEFAULT 1,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_payments_reference ON payments(payment_reference);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_customer ON payments(customer_id);
CREATE INDEX idx_payments_branch ON payments(branch_id);
CREATE INDEX idx_payments_method ON payments(payment_method_id);
CREATE INDEX idx_payments_status ON payments(payment_status_id);
CREATE INDEX idx_payments_gateway ON payments(payment_gateway_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_settlement ON payments(settlement_date) WHERE settlement_date IS NOT NULL;
CREATE INDEX idx_payments_gateway_ref ON payments(gateway_reference) WHERE gateway_reference IS NOT NULL;

-- Composite indexes
CREATE INDEX idx_payments_customer_status ON payments(customer_id, payment_status_id);
CREATE INDEX idx_payments_booking_status ON payments(booking_id, payment_status_id);
CREATE INDEX idx_payments_date_branch ON payments(payment_date, branch_id);
CREATE INDEX idx_payments_settlement_status ON payments(settlement_status, settlement_date);

-- ============================================================
-- PAYMENT_METHODS (Card, Cash, Mobile Money, etc.)
-- ============================================================
CREATE TABLE payment_methods (
    payment_method_id   NUMBER(12)      PRIMARY KEY,
    method_code         VARCHAR2(20)    UNIQUE NOT NULL,
    method_name         VARCHAR2(50)    NOT NULL,
    method_description  VARCHAR2(255),
    
    -- Categorization
    category            VARCHAR2(30)    NOT NULL CHECK (category IN ('CASH', 'CARD', 'MOBILE_MONEY', 'GIFT_CARD', 'VOUCHER', 'BANK_TRANSFER', 'CRYPTO', 'LOYALTY_POINTS', 'OTHER')),
    subcategory         VARCHAR2(30),                   -- e.g., 'VISA', 'MASTERCARD', 'MTN_MOMO', 'VODAFONE_CASH'
    
    -- Operational
    is_digital          CHAR(1)         DEFAULT 'N' CHECK (is_digital IN ('Y', 'N')),
    is_prepaid          CHAR(1)         DEFAULT 'N' CHECK (is_prepaid IN ('Y', 'N')),
    requires_pin        CHAR(1)         DEFAULT 'N' CHECK (requires_pin IN ('Y', 'N')),
    requires_cvv        CHAR(1)         DEFAULT 'N' CHECK (requires_cvv IN ('Y', 'N')),
    requires_otp        CHAR(1)         DEFAULT 'N' CHECK (requires_otp IN ('Y', 'N')),
    
    -- Financial
    processing_fee_rate NUMBER(5,2)     DEFAULT 0,      -- Percentage
    processing_fee_fixed NUMBER(5,2)    DEFAULT 0,      -- Fixed fee
    settlement_days     NUMBER(3)       DEFAULT 1,      -- Days to settle
    
    -- Availability
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    display_order       NUMBER(3),
    supported_branches  CLOB,                            -- JSON array of branch IDs
    
    -- Display
    icon_class          VARCHAR2(50),
    color_code          VARCHAR2(7),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE
);

-- Insert default payment methods
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(1, 'CASH', 'Cash', 'CASH', NULL, 'N', 0, 0, 1);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(2, 'VISA', 'Visa Card', 'CARD', 'VISA', 'Y', 2.5, 2, 2);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(3, 'MC', 'Mastercard', 'CARD', 'MASTERCARD', 'Y', 2.5, 2, 3);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(4, 'AMEX', 'American Express', 'CARD', 'AMEX', 'Y', 3.0, 3, 4);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(5, 'MOMO_MTN', 'MTN Mobile Money', 'MOBILE_MONEY', 'MTN_MOMO', 'Y', 1.5, 1, 5);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(6, 'MOMO_VOD', 'Vodafone Cash', 'MOBILE_MONEY', 'VODAFONE_CASH', 'Y', 1.5, 1, 6);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(7, 'MOMO_AT', 'AirtelTigo Money', 'MOBILE_MONEY', 'AIRTEL_TIGO', 'Y', 1.5, 1, 7);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(8, 'GIFT', 'Gift Card', 'GIFT_CARD', NULL, 'Y', 0, 0, 8);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(9, 'VOUCHER', 'Voucher', 'VOUCHER', NULL, 'Y', 0, 0, 9);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(10, 'LOYALTY', 'Loyalty Points', 'LOYALTY_POINTS', NULL, 'Y', 0, 0, 10);
INSERT INTO payment_methods (payment_method_id, method_code, method_name, category, subcategory, is_digital, processing_fee_rate, settlement_days, display_order) VALUES(11, 'BANK', 'Bank Transfer', 'BANK_TRANSFER', NULL, 'Y', 0, 2, 11);

-- ============================================================
-- PAYMENT_STATUS (Status codes)
-- ============================================================
CREATE TABLE payment_status (
    payment_status_id   NUMBER(12)      PRIMARY KEY,
    status_code         VARCHAR2(20)    UNIQUE NOT NULL,
    status_name         VARCHAR2(50)    NOT NULL,
    status_description  VARCHAR2(255),
    
    -- Categorization
    category            VARCHAR2(30)    NOT NULL CHECK (category IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED')),
    is_final_state      CHAR(1)         DEFAULT 'N' CHECK (is_final_state IN ('Y', 'N')),
    can_refund          CHAR(1)         DEFAULT 'N' CHECK (can_refund IN ('Y', 'N')),
    can_cancel          CHAR(1)         DEFAULT 'Y' CHECK (can_cancel IN ('Y', 'N')),
    
    -- Display
    color_code          VARCHAR2(7),
    icon_class          VARCHAR2(50),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE
);

-- Insert default statuses
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(1, 'PENDING', 'Pending', 'PENDING', 'N', 'N', '#FFC107');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(2, 'INITIATED', 'Initiated', 'PENDING', 'N', 'N', '#FF9800');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(3, 'PROCESSING', 'Processing', 'PROCESSING', 'N', 'N', '#2196F3');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(4, 'AUTHORIZED', 'Authorized', 'PROCESSING', 'N', 'Y', '#3F51B5');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(5, 'CAPTURED', 'Captured', 'PROCESSING', 'N', 'Y', '#009688');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(6, 'SUCCESS', 'Success', 'COMPLETED', 'Y', 'Y', '#4CAF50');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(7, 'FAILED', 'Failed', 'FAILED', 'Y', 'N', '#F44336');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(8, 'CANCELLED', 'Cancelled', 'FAILED', 'Y', 'N', '#9E9E9E');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(9, 'REFUNDED', 'Refunded', 'REVERSED', 'Y', 'N', '#FF5722');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(10, 'PARTIAL_REFUND', 'Partially Refunded', 'REVERSED', 'Y', 'N', '#FF9800');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(11, 'VOID', 'Void', 'FAILED', 'Y', 'N', '#795548');
INSERT INTO payment_status (payment_status_id, status_code, status_name, category, is_final_state, can_refund, color_code) VALUES(12, 'CHARGEBACK', 'Chargeback', 'FAILED', 'Y', 'N', '#D32F2F');

-- ============================================================
-- PAYMENT_GATEWAYS (Integration details)
-- ============================================================
CREATE TABLE payment_gateways (
    payment_gateway_id  NUMBER(12)      PRIMARY KEY,
    gateway_code        VARCHAR2(20)    UNIQUE NOT NULL,
    gateway_name        VARCHAR2(50)    NOT NULL,
    gateway_description VARCHAR2(255),
    
    -- Configuration
    base_url            VARCHAR2(255),
    api_endpoint        VARCHAR2(255),
    api_key             VARCHAR2(255),                   -- Encrypted
    api_secret          VARCHAR2(255),                   -- Encrypted
    webhook_secret      VARCHAR2(255),                   -- Encrypted
    
    -- Supported features
    supports_refunds    CHAR(1)         DEFAULT 'Y' CHECK (supports_refunds IN ('Y', 'N')),
    supports_recurring  CHAR(1)         DEFAULT 'N' CHECK (supports_recurring IN ('Y', 'N')),
    supports_3d_secure  CHAR(1)         DEFAULT 'Y' CHECK (supports_3d_secure IN ('Y', 'N')),
    supports_mobile     CHAR(1)         DEFAULT 'Y' CHECK (supports_mobile IN ('Y', 'N')),
    
    -- Supported countries
    supported_countries CLOB,                            -- JSON array of country codes
    
    -- Fees
    transaction_fee_rate NUMBER(5,2)    DEFAULT 0,
    transaction_fee_fixed NUMBER(5,2)   DEFAULT 0,
    refund_fee_rate     NUMBER(5,2)     DEFAULT 0,
    refund_fee_fixed    NUMBER(5,2)     DEFAULT 0,
    
    -- Credentials management
    last_rotation_date  DATE,
    rotation_interval   NUMBER(3)       DEFAULT 90,     -- Days between rotations
    
    -- Status
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    is_test_mode        CHAR(1)         DEFAULT 'Y' CHECK (is_test_mode IN ('Y', 'N')),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Insert default gateways
INSERT INTO payment_gateways (payment_gateway_id, gateway_code, gateway_name, supports_refunds, supports_3d_secure, is_test_mode) VALUES(1, 'PAYSTACK', 'Paystack', 'Y', 'Y', 'Y');
INSERT INTO payment_gateways (payment_gateway_id, gateway_code, gateway_name, supports_refunds, supports_3d_secure, is_test_mode) VALUES(2, 'HUBTEL', 'Hubtel', 'Y', 'N', 'Y');
INSERT INTO payment_gateways (payment_gateway_id, gateway_code, gateway_name, supports_refunds, supports_3d_secure, is_test_mode) VALUES(3, 'FLUTTERWAVE', 'Flutterwave', 'Y', 'Y', 'Y');
INSERT INTO payment_gateways (payment_gateway_id, gateway_code, gateway_name, supports_refunds, supports_3d_secure, is_test_mode) VALUES(4, 'STRIPE', 'Stripe', 'Y', 'Y', 'Y');
INSERT INTO payment_gateways (payment_gateway_id, gateway_code, gateway_name, supports_refunds, supports_3d_secure, is_test_mode) VALUES(5, 'MTN_MOMO', 'MTN Mobile Money API', 'Y', 'N', 'Y');
INSERT INTO payment_gateways (payment_gateway_id, gateway_code, gateway_name, supports_refunds, supports_3d_secure, is_test_mode) VALUES(6, 'VODAFONE', 'Vodafone Cash API', 'Y', 'N', 'Y');
INSERT INTO payment_gateways (payment_gateway_id, gateway_code, gateway_name, supports_refunds, supports_3d_secure, is_test_mode) VALUES(7, 'BANK', 'Bank Transfer (Manual)', 'Y', 'N', 'N');

-- ============================================================
-- PAYMENT_REFUNDS (Refund transactions)
-- ============================================================
CREATE TABLE payment_refunds (
    refund_id           NUMBER(12)      PRIMARY KEY,
    refund_reference    VARCHAR2(30)    UNIQUE NOT NULL,
    payment_id          NUMBER(12)      NOT NULL REFERENCES payments(payment_id),
    
    -- Links
    booking_id          NUMBER(12)      REFERENCES bookings(booking_id),
    customer_id         NUMBER(12)      NOT NULL REFERENCES customers(customer_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Refund details
    refund_date         TIMESTAMP       NOT NULL,
    refund_amount       NUMBER(10,2)    NOT NULL,
    refund_fee          NUMBER(10,2)    DEFAULT 0,      -- Refund processing fee
    net_refund          NUMBER(10,2)    GENERATED ALWAYS AS (refund_amount - refund_fee) VIRTUAL,
    refund_currency     VARCHAR2(3)     NOT NULL DEFAULT 'GHS',
    
    -- Refund reason
    refund_type         VARCHAR2(30)    NOT NULL CHECK (refund_type IN ('FULL', 'PARTIAL', 'ADJUSTMENT', 'CHARGEBACK')),
    refund_reason       VARCHAR2(50)    NOT NULL CHECK (refund_reason IN ('CUSTOMER_REQUEST', 'CANCELLATION', 'RESCHEDULE', 'DUPLICATE', 'FRAUD', 'TECHNICAL_ISSUE', 'MISCHARGE', 'QUALITY_ISSUE', 'CHARGEBACK', 'OTHER')),
    refund_description  CLOB,
    
    -- Gateway reference
    gateway_refund_id   VARCHAR2(100),                  -- External refund reference
    gateway_response    CLOB,
    gateway_error_code  VARCHAR2(50),
    gateway_error_msg   VARCHAR2(255),
    
    -- Status
    refund_status       VARCHAR2(20)    NOT NULL CHECK (refund_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    status_date         TIMESTAMP       DEFAULT SYSTIMESTAMP,
    
    -- Approval
    requested_by        VARCHAR2(30)    DEFAULT USER,
    requested_date      TIMESTAMP       DEFAULT SYSTIMESTAMP,
    approved_by         VARCHAR2(30),
    approval_date       TIMESTAMP,
    approval_notes      CLOB,
    
    -- Settlement
    settlement_date     DATE,
    settlement_reference VARCHAR2(100),
    
    -- Customer communication
    notified_customer   CHAR(1)         DEFAULT 'N' CHECK (notified_customer IN ('Y', 'N')),
    notification_date   TIMESTAMP,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_refunds_payment ON payment_refunds(payment_id);
CREATE INDEX idx_refunds_booking ON payment_refunds(booking_id);
CREATE INDEX idx_refunds_customer ON payment_refunds(customer_id);
CREATE INDEX idx_refunds_branch ON payment_refunds(branch_id);
CREATE INDEX idx_refunds_reference ON payment_refunds(refund_reference);
CREATE INDEX idx_refunds_status ON payment_refunds(refund_status);
CREATE INDEX idx_refunds_date ON payment_refunds(refund_date);
CREATE INDEX idx_refunds_gateway ON payment_refunds(gateway_refund_id) WHERE gateway_refund_id IS NOT NULL;

-- ============================================================
-- INVOICES (Customer invoices)
-- ============================================================
CREATE TABLE invoices (
    invoice_id          NUMBER(12)      PRIMARY KEY,
    invoice_reference   VARCHAR2(30)    UNIQUE NOT NULL,
    invoice_guid        VARCHAR2(36)    UNIQUE,
    
    -- Links
    booking_id          NUMBER(12)      REFERENCES bookings(booking_id),
    customer_id         NUMBER(12)      NOT NULL REFERENCES customers(customer_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Invoice details
    invoice_date        TIMESTAMP       NOT NULL,
    invoice_due_date    TIMESTAMP,
    invoice_type        VARCHAR2(30)    NOT NULL CHECK (invoice_type IN ('SALES', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PROFORMA', 'RECURRING')),
    invoice_status      VARCHAR2(20)    NOT NULL CHECK (invoice_status IN ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID', 'PARTIAL')),
    
    -- Financials
    subtotal            NUMBER(10,2)    NOT NULL,
    tax_total           NUMBER(10,2)    DEFAULT 0,
    discount_total      NUMBER(10,2)    DEFAULT 0,
    other_charges       NUMBER(10,2)    DEFAULT 0,
    grand_total         NUMBER(10,2)    NOT NULL,
    amount_paid         NUMBER(10,2)    DEFAULT 0,
    balance_due         NUMBER(10,2)    GENERATED ALWAYS AS (grand_total - amount_paid) VIRTUAL,
    currency            VARCHAR2(3)     NOT NULL DEFAULT 'GHS',
    
    -- Tax details
    tax_scheme          VARCHAR2(50),                   -- e.g., 'VAT', 'WITHHOLDING'
    tax_registration    VARCHAR2(50),
    tax_breakdown       CLOB,                           -- JSON of tax calculations
    
    -- Customer information
    customer_name       VARCHAR2(100)   NOT NULL,
    customer_address    VARCHAR2(200),
    customer_tax_id     VARCHAR2(50),
    customer_email      VARCHAR2(100),
    customer_phone      VARCHAR2(20),
    
    -- Bill to/Ship to
    bill_to_address     VARCHAR2(200),
    ship_to_address     VARCHAR2(200),
    
    -- Payment terms
    payment_terms       VARCHAR2(50)    DEFAULT 'DUE_ON_RECEIPT',
    discount_terms      VARCHAR2(50),                   -- e.g., '2/10 NET 30'
    early_payment_discount NUMBER(5,2)  DEFAULT 0,
    late_payment_penalty NUMBER(5,2)    DEFAULT 0,
    
    -- Line items
    line_items          CLOB,                           -- JSON array of invoice items
    
    -- Notes
    invoice_notes       CLOB,
    internal_notes      CLOB,
    
    -- PDF generation
    pdf_generated       CHAR(1)         DEFAULT 'N' CHECK (pdf_generated IN ('Y', 'N')),
    pdf_url             VARCHAR2(500),
    pdf_generated_date  TIMESTAMP,
    pdf_template_used   VARCHAR2(50),
    
    -- Communication
    email_sent          CHAR(1)         DEFAULT 'N' CHECK (email_sent IN ('Y', 'N')),
    email_sent_date     TIMESTAMP,
    reminder_sent       CHAR(1)         DEFAULT 'N' CHECK (reminder_sent IN ('Y', 'N')),
    reminder_count      NUMBER(3)       DEFAULT 0,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_invoices_reference ON invoices(invoice_reference);
CREATE INDEX idx_invoices_booking ON invoices(booking_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_branch ON invoices(branch_id);
CREATE INDEX idx_invoices_status ON invoices(invoice_status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_due ON invoices(invoice_due_date);
CREATE INDEX idx_invoices_customer_status ON invoices(customer_id, invoice_status);

-- ============================================================
-- RECEIPTS (Transaction receipts)
-- ============================================================
CREATE TABLE receipts (
    receipt_id          NUMBER(12)      PRIMARY KEY,
    receipt_reference   VARCHAR2(30)    UNIQUE NOT NULL,
    receipt_guid        VARCHAR2(36)    UNIQUE,
    
    -- Links
    payment_id          NUMBER(12)      NOT NULL REFERENCES payments(payment_id),
    booking_id          NUMBER(12)      REFERENCES bookings(booking_id),
    invoice_id          NUMBER(12)      REFERENCES invoices(invoice_id),
    customer_id         NUMBER(12)      NOT NULL REFERENCES customers(customer_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Receipt details
    receipt_date        TIMESTAMP       NOT NULL,
    receipt_type        VARCHAR2(30)    NOT NULL CHECK (receipt_type IN ('PAYMENT', 'REFUND', 'ADJUSTMENT', 'DUPLICATE', 'VOID')),
    
    -- Financials
    receipt_amount      NUMBER(10,2)    NOT NULL,
    receipt_currency    VARCHAR2(3)     NOT NULL DEFAULT 'GHS',
    
    -- Payment details
    payment_method      VARCHAR2(50)    NOT NULL,
    payment_reference   VARCHAR2(50),
    approval_code       VARCHAR2(50),
    
    -- Customer information
    customer_name       VARCHAR2(100)   NOT NULL,
    customer_email      VARCHAR2(100),
    customer_phone      VARCHAR2(20),
    
    -- Receipt content
    header_text         VARCHAR2(255),
    footer_text         VARCHAR2(255),
    transaction_details CLOB,                           -- JSON of transaction breakdown
    item_details        CLOB,                           -- JSON array of items purchased
    
    -- QR code
    qr_code_url         VARCHAR2(500),
    qr_code_data        VARCHAR2(500),
    
    -- PDF generation
    pdf_generated       CHAR(1)         DEFAULT 'N' CHECK (pdf_generated IN ('Y', 'N')),
    pdf_url             VARCHAR2(500),
    pdf_generated_date  TIMESTAMP,
    
    -- Delivery
    delivery_method     VARCHAR2(30)    CHECK (delivery_method IN ('EMAIL', 'SMS', 'WHATSAPP', 'PRINT', 'MOBILE_APP', 'BOX_OFFICE')),
    delivery_status     VARCHAR2(20)    DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ')),
    delivery_date       TIMESTAMP,
    delivery_notes      CLOB,
    
    -- Reprints
    reprint_count       NUMBER(3)       DEFAULT 0,
    last_reprint_date   TIMESTAMP,
    reprint_by          VARCHAR2(30),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_receipts_payment ON receipts(payment_id);
CREATE INDEX idx_receipts_booking ON receipts(booking_id);
CREATE INDEX idx_receipts_invoice ON receipts(invoice_id);
CREATE INDEX idx_receipts_customer ON receipts(customer_id);
CREATE INDEX idx_receipts_branch ON receipts(branch_id);
CREATE INDEX idx_receipts_reference ON receipts(receipt_reference);
CREATE INDEX idx_receipts_date ON receipts(receipt_date);
CREATE INDEX idx_receipts_type ON receipts(receipt_type);

-- ============================================================
-- PRODUCTS (All concession items)
-- ============================================================
CREATE TABLE products (
    product_id          NUMBER(12)      PRIMARY KEY,
    product_code        VARCHAR2(20)    UNIQUE NOT NULL,
    product_guid        VARCHAR2(36)    UNIQUE,
    
    -- Basic details
    product_name        VARCHAR2(100)   NOT NULL,
    product_description VARCHAR2(500),
    product_short_name  VARCHAR2(50),
    sku                 VARCHAR2(30)    UNIQUE,          -- Stock Keeping Unit
    
    -- Categorization
    category_id         NUMBER(12)      NOT NULL REFERENCES product_categories(category_id),
    subcategory         VARCHAR2(30),
    
    -- Branding
    brand               VARCHAR2(50),
    manufacturer        VARCHAR2(50),
    supplier_id         NUMBER(12)      REFERENCES suppliers(supplier_id),
    
    -- Pricing
    unit_cost           NUMBER(10,2)    NOT NULL,        -- Current cost
    selling_price       NUMBER(10,2)    NOT NULL,        -- Current selling price
    tax_rate            NUMBER(5,2)     DEFAULT 0,       -- Tax percentage
    discount_eligible   CHAR(1)         DEFAULT 'Y' CHECK (discount_eligible IN ('Y', 'N')),
    
    -- Inventory
    unit_of_measure     VARCHAR2(20)    NOT NULL CHECK (unit_of_measure IN ('EACH', 'KG', 'LITRE', 'GRAM', 'ML', 'OUNCE', 'POUND', 'CASE', 'BOX', 'BAG', 'CUP', 'BOTTLE', 'CAN', 'OTHER')),
    package_quantity    NUMBER(6)       DEFAULT 1,       -- Items per package
    reorder_level       NUMBER(6)       NOT NULL,        -- Minimum stock before reorder
    reorder_quantity    NUMBER(6)       NOT NULL,        -- Quantity to reorder
    par_level           NUMBER(6),                       -- Target stock level
    safety_stock        NUMBER(6)       DEFAULT 0,       -- Buffer stock
    
    -- Physical
    weight_grams        NUMBER(8,2),
    volume_ml           NUMBER(8,2),
    dimensions          VARCHAR2(50),
    
    -- Perishability
    is_perishable       CHAR(1)         DEFAULT 'N' CHECK (is_perishable IN ('Y', 'N')),
    shelf_life_days     NUMBER(5),                       -- Days before expiry
    storage_conditions  VARCHAR2(255),
    requires_refrigeration CHAR(1)      DEFAULT 'N' CHECK (requires_refrigeration IN ('Y', 'N')),
    
    -- Allergens
    contains_allergens  CLOB,                            -- JSON array of allergens
    nutritional_info    CLOB,                            -- JSON nutritional data
    
    -- Status
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK')),
    
    -- Marketing
    image_url           VARCHAR2(500),
    description_html    CLOB,
    promotional_text    VARCHAR2(255),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_products_code ON products(product_code);
CREATE INDEX idx_products_name ON products(product_name);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = 'Y';
CREATE INDEX idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- ============================================================
-- PRODUCT_CATEGORIES (Food, Drinks, Snacks, etc.)
-- ============================================================
CREATE TABLE product_categories (
    category_id         NUMBER(12)      PRIMARY KEY,
    category_code       VARCHAR2(20)    UNIQUE NOT NULL,
    category_name       VARCHAR2(50)    NOT NULL,
    category_description VARCHAR2(255),
    
    -- Hierarchy
    parent_category_id  NUMBER(12)      REFERENCES product_categories(category_id),
    category_level      NUMBER(2)       DEFAULT 1,
    
    -- Categorization
    category_type       VARCHAR2(30)    NOT NULL CHECK (category_type IN ('FOOD', 'BEVERAGE', 'SNACK', 'MERCHANDISE', 'COMBO', 'OTHER')),
    
    -- Operational
    profit_margin_target NUMBER(5,2),
    min_stock_level     NUMBER(6),
    max_stock_level     NUMBER(6),
    
    -- Display
    display_order       NUMBER(3),
    icon_class          VARCHAR2(50),
    color_code          VARCHAR2(7),
    
    -- Status
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE
);

-- Insert default categories
INSERT INTO product_categories (category_id, category_code, category_name, category_type, display_order) VALUES(1, 'POPCORN', 'Popcorn', 'FOOD', 1);
INSERT INTO product_categories (category_id, category_code, category_name, category_type, display_order) VALUES(2, 'BEVERAGE', 'Beverages', 'BEVERAGE', 2);
INSERT INTO product_categories (category_id, category_code, category_name, category_type, display_order) VALUES(3, 'SNACKS', 'Snacks', 'SNACK', 3);
INSERT INTO product_categories (category_id, category_code, category_name, category_type, display_order) VALUES(4, 'CANDY', 'Candy & Sweets', 'FOOD', 4);
INSERT INTO product_categories (category_id, category_code, category_name, category_type, display_order) VALUES(5, 'HOT_DOGS', 'Hot Dogs & Sandwiches', 'FOOD', 5);
INSERT INTO product_categories (category_id, category_code, category_name, category_type, display_order) VALUES(6, 'PIZZA', 'Pizza', 'FOOD', 6);
INSERT INTO product_categories (category_id, category_code, category_name, category_type, display_order) VALUES(7, 'COMBO', 'Combo Meals', 'COMBO', 7);
INSERT INTO product_categories (category_id, category_code, category_name, category_type, display_order) VALUES(8, 'MERCH', 'Merchandise', 'MERCHANDISE', 8);
INSERT INTO product_categories (category_id, category_code, category_name, category_type, display_order) VALUES(9, 'OTHER', 'Other', 'OTHER', 9);

-- ============================================================
-- PRODUCT_PRICES (Historical price tracking)
-- ============================================================
CREATE TABLE product_prices (
    price_id            NUMBER(12)      PRIMARY KEY,
    product_id          NUMBER(12)      NOT NULL REFERENCES products(product_id),
    
    -- Price details
    price_type          VARCHAR2(20)    NOT NULL CHECK (price_type IN ('COST', 'RETAIL', 'PROMOTIONAL', 'WHOLESALE', 'LOYALTY')),
    price_amount        NUMBER(10,2)    NOT NULL,
    tax_included        CHAR(1)         DEFAULT 'Y' CHECK (tax_included IN ('Y', 'N')),
    
    -- Validity period
    effective_from      DATE            NOT NULL,
    effective_to        DATE,                            -- NULL means current
    
    -- Promotions
    promotion_id        NUMBER(12)      REFERENCES promotions(promotion_id),
    is_promotional      CHAR(1)         DEFAULT 'N' CHECK (is_promotional IN ('Y', 'N')),
    
    -- Metadata
    reason              VARCHAR2(255),
    approved_by         VARCHAR2(30),
    approval_date       DATE,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_prices_product ON product_prices(product_id);
CREATE INDEX idx_prices_effective ON product_prices(effective_from, effective_to);
CREATE INDEX idx_prices_type ON product_prices(price_type);

-- ============================================================
-- INVENTORY (Current stock levels)
-- ============================================================
CREATE TABLE inventory (
    inventory_id        NUMBER(12)      PRIMARY KEY,
    product_id          NUMBER(12)      NOT NULL REFERENCES products(product_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Stock levels
    current_stock       NUMBER(12)      NOT NULL DEFAULT 0,
    reserved_stock      NUMBER(12)      DEFAULT 0,       -- Reserved for pending orders
    available_stock     NUMBER(12)      GENERATED ALWAYS AS (current_stock - reserved_stock) VIRTUAL,
    min_stock           NUMBER(12)      DEFAULT 0,
    max_stock           NUMBER(12),
    
    -- Value
    average_cost        NUMBER(10,2)    DEFAULT 0,
    total_value         NUMBER(12,2)    GENERATED ALWAYS AS (average_cost * current_stock) VIRTUAL,
    
    -- Batch management
    batch_controlled    CHAR(1)         DEFAULT 'N' CHECK (batch_controlled IN ('Y', 'N')),
    expiry_controlled   CHAR(1)         DEFAULT 'N' CHECK (expiry_controlled IN ('Y', 'N')),
    latest_batch_date   DATE,
    oldest_batch_date   DATE,
    
    -- Stock status
    stock_status        VARCHAR2(20)    CHECK (stock_status IN ('NORMAL', 'LOW', 'OUT_OF_STOCK', 'OVERSTOCKED')),
    
    -- Audit
    last_received_date  DATE,
    last_issued_date    DATE,
    created_date        DATE            DEFAULT SYSDATE,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER,
    
    -- Unique constraint per product per branch
    CONSTRAINT uq_inventory_product_branch UNIQUE (product_id, branch_id)
);

CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_branch ON inventory(branch_id);
CREATE INDEX idx_inventory_status ON inventory(stock_status);
CREATE INDEX idx_inventory_stock ON inventory(current_stock) WHERE current_stock > 0;

-- ============================================================
-- INVENTORY_TRANSACTIONS (All stock movements)
-- ============================================================
CREATE TABLE inventory_transactions (
    transaction_id      NUMBER(12)      PRIMARY KEY,
    transaction_reference VARCHAR2(30)  UNIQUE NOT NULL,
    
    -- Links
    product_id          NUMBER(12)      NOT NULL REFERENCES products(product_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    inventory_id        NUMBER(12)      NOT NULL REFERENCES inventory(inventory_id),
    
    -- Transaction details
    transaction_type    VARCHAR2(30)    NOT NULL CHECK (transaction_type IN (
        'PURCHASE_RECEIPT', 'SALE', 'RETURN', 'ADJUSTMENT', 'WASTE', 'SPOILAGE', 
        'TRANSFER_IN', 'TRANSFER_OUT', 'INITIAL_STOCK', 'COUNT_ADJUSTMENT',
        'COMPLIMENTARY', 'PROMOTIONAL', 'SAMPLE', 'RECALL'
    )),
    
    -- Quantity
    quantity            NUMBER(12)      NOT NULL,
    unit_cost           NUMBER(10,2)    NOT NULL,
    total_cost          NUMBER(12,2)    GENERATED ALWAYS AS (quantity * unit_cost) VIRTUAL,
    
    -- Batch details
    batch_number        VARCHAR2(50),
    expiry_date         DATE,
    
    -- References
    source_reference    VARCHAR2(50),                   -- PO number, sale number, etc.
    source_table        VARCHAR2(50),                   -- purchase_orders, sales, etc.
    source_id           NUMBER(12),
    
    -- Reason
    transaction_reason  VARCHAR2(255),
    notes               CLOB,
    
    -- Approval
    approved_by         VARCHAR2(30),
    approval_date       DATE,
    performed_by        VARCHAR2(30),
    performed_date      DATE,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_inv_trans_product ON inventory_transactions(product_id);
CREATE INDEX idx_inv_trans_branch ON inventory_transactions(branch_id);
CREATE INDEX idx_inv_trans_inventory ON inventory_transactions(inventory_id);
CREATE INDEX idx_inv_trans_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inv_trans_date ON inventory_transactions(created_date);
CREATE INDEX idx_inv_trans_reference ON inventory_transactions(source_reference);

-- ============================================================
-- SUPPLIERS (Vendor/supplier master)
-- ============================================================
CREATE TABLE suppliers (
    supplier_id         NUMBER(12)      PRIMARY KEY,
    supplier_code       VARCHAR2(20)    UNIQUE NOT NULL,
    supplier_guid       VARCHAR2(36)    UNIQUE,
    
    -- Basic details
    supplier_name       VARCHAR2(100)   NOT NULL,
    supplier_alias      VARCHAR2(50),
    supplier_type       VARCHAR2(30)    NOT NULL CHECK (supplier_type IN ('FOOD', 'BEVERAGE', 'EQUIPMENT', 'MERCHANDISE', 'SERVICE', 'MULTI')),
    
    -- Contact information
    contact_name        VARCHAR2(100),
    contact_phone       VARCHAR2(20),
    contact_email       VARCHAR2(100),
    contact_fax         VARCHAR2(20),
    website             VARCHAR2(200),
    
    -- Address
    address_line1       VARCHAR2(100),
    address_line2       VARCHAR2(100),
    city                VARCHAR2(50),
    region              VARCHAR2(50),
    country             VARCHAR2(50),
    postal_code         VARCHAR2(20),
    
    -- Financial
    account_number      VARCHAR2(50),
    bank_name           VARCHAR2(100),
    bank_branch         VARCHAR2(100),
    bank_account        VARCHAR2(50),
    tax_id              VARCHAR2(50),
    payment_terms       VARCHAR2(50)    NOT NULL DEFAULT 'NET 30',
    
    -- Performance
    quality_rating      NUMBER(2,1)     CHECK (quality_rating BETWEEN 1 AND 5),
    delivery_rating     NUMBER(2,1)     CHECK (delivery_rating BETWEEN 1 AND 5),
    price_rating        NUMBER(2,1)     CHECK (price_rating BETWEEN 1 AND 5),
    overall_rating      NUMBER(2,1)     GENERATED ALWAYS AS ((quality_rating + delivery_rating + price_rating) / 3) VIRTUAL,
    
    -- Ordering
    lead_time_days      NUMBER(3)       DEFAULT 3,
    min_order_value     NUMBER(10,2)    DEFAULT 0,
    preferred_delivery_day VARCHAR2(10),
    
    -- Status
    is_preferred        CHAR(1)         DEFAULT 'N' CHECK (is_preferred IN ('Y', 'N')),
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')),
    contract_start      DATE,
    contract_end        DATE,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_suppliers_code ON suppliers(supplier_code);
CREATE INDEX idx_suppliers_name ON suppliers(supplier_name);
CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_suppliers_rating ON suppliers(overall_rating);

-- ============================================================
-- PURCHASE_ORDERS (Supplier orders)
-- ============================================================
CREATE TABLE purchase_orders (
    po_id               NUMBER(12)      PRIMARY KEY,
    po_reference        VARCHAR2(30)    UNIQUE NOT NULL,
    po_guid             VARCHAR2(36)    UNIQUE,
    
    -- Links
    supplier_id         NUMBER(12)      NOT NULL REFERENCES suppliers(supplier_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    created_by_user     NUMBER(12)      REFERENCES staff(staff_id),
    approved_by_user    NUMBER(12)      REFERENCES staff(staff_id),
    
    -- Order details
    order_date          DATE            NOT NULL,
    expected_delivery   DATE,
    actual_delivery     DATE,
    delivery_time_slot  VARCHAR2(50),
    
    -- Financials
    subtotal            NUMBER(12,2)    NOT NULL,
    tax_amount          NUMBER(12,2)    DEFAULT 0,
    shipping_cost       NUMBER(12,2)    DEFAULT 0,
    discount_amount     NUMBER(12,2)    DEFAULT 0,
    total_amount        NUMBER(12,2)    NOT NULL,
    currency            VARCHAR2(3)     DEFAULT 'GHS',
    exchange_rate       NUMBER(10,4)    DEFAULT 1,
    local_amount        NUMBER(12,2),
    
    -- Status
    po_status           VARCHAR2(20)    NOT NULL CHECK (po_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'CLOSED')),
    status_date         DATE            DEFAULT SYSDATE,
    
    -- Delivery
    delivery_notes      CLOB,
    shipping_address    VARCHAR2(200),
    shipping_method     VARCHAR2(50),
    tracking_number     VARCHAR2(100),
    
    -- Payment
    payment_terms       VARCHAR2(50),
    payment_status      VARCHAR2(20)    DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE')),
    
    -- Notes
    internal_notes      CLOB,
    supplier_notes      CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_po_reference ON purchase_orders(po_reference);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_branch ON purchase_orders(branch_id);
CREATE INDEX idx_po_status ON purchase_orders(po_status);
CREATE INDEX idx_po_order_date ON purchase_orders(order_date);
CREATE INDEX idx_po_delivery ON purchase_orders(expected_delivery);

-- ============================================================
-- PURCHASE_ITEMS (Purchase order line items)
-- ============================================================
CREATE TABLE purchase_items (
    purchase_item_id    NUMBER(12)      PRIMARY KEY,
    po_id               NUMBER(12)      NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    product_id          NUMBER(12)      NOT NULL REFERENCES products(product_id),
    
    -- Order details
    quantity_ordered    NUMBER(12)      NOT NULL,
    quantity_received   NUMBER(12)      DEFAULT 0,
    quantity_remaining  NUMBER(12)      GENERATED ALWAYS AS (quantity_ordered - quantity_received) VIRTUAL,
    unit_cost           NUMBER(10,2)    NOT NULL,
    line_total          NUMBER(12,2)    GENERATED ALWAYS AS (quantity_ordered * unit_cost) VIRTUAL,
    
    -- Tax
    tax_rate            NUMBER(5,2)     DEFAULT 0,
    tax_amount          NUMBER(12,2)    DEFAULT 0,
    
    -- Discount
    discount_percent    NUMBER(5,2)     DEFAULT 0,
    discount_amount     NUMBER(12,2)    DEFAULT 0,
    net_line_total      NUMBER(12,2)    GENERATED ALWAYS AS (line_total + tax_amount - discount_amount) VIRTUAL,
    
    -- Batch details
    batch_number        VARCHAR2(50),
    expiry_date         DATE,
    manufacturing_date  DATE,
    
    -- Delivery details
    delivery_date       DATE,
    received_by         VARCHAR2(30),
    received_quantity   NUMBER(12)      DEFAULT 0,
    rejected_quantity   NUMBER(12)      DEFAULT 0,
    rejection_reason    VARCHAR2(255),
    
    -- Notes
    notes               CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_pi_po ON purchase_items(po_id);
CREATE INDEX idx_pi_product ON purchase_items(product_id);
CREATE INDEX idx_pi_batch ON purchase_items(batch_number) WHERE batch_number IS NOT NULL;

-- ============================================================
-- SALES (Concession POS sales header)
-- ============================================================
CREATE TABLE sales (
    sale_id             NUMBER(12)      PRIMARY KEY,
    sale_reference      VARCHAR2(30)    UNIQUE NOT NULL,
    sale_guid           VARCHAR2(36)    UNIQUE,
    
    -- Links
    booking_id          NUMBER(12)      REFERENCES bookings(booking_id),    -- Link to movie booking
    customer_id         NUMBER(12)      REFERENCES customers(customer_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    cashier_id          NUMBER(12)      NOT NULL REFERENCES staff(staff_id),
    
    -- Sale details
    sale_date           TIMESTAMP       NOT NULL,
    sale_channel        VARCHAR2(30)    NOT NULL CHECK (sale_channel IN ('POS_TERMINAL', 'KIOSK', 'MOBILE_ORDER', 'ONLINE_ORDER', 'BOX_OFFICE')),
    sale_type           VARCHAR2(30)    NOT NULL CHECK (sale_type IN ('WALK_IN', 'PRE_ORDER', 'DELIVERY', 'TAKE_AWAY')),
    
    -- Financials
    subtotal            NUMBER(10,2)    NOT NULL,
    tax_total           NUMBER(10,2)    DEFAULT 0,
    discount_total      NUMBER(10,2)    DEFAULT 0,
    grand_total         NUMBER(10,2)    NOT NULL,
    round_off           NUMBER(5,2)     DEFAULT 0,
    net_total           NUMBER(10,2)    NOT NULL,    -- Grand total + round off
    
    -- Payment
    payment_method      VARCHAR2(30)    NOT NULL REFERENCES payment_methods(method_code),
    payment_reference   VARCHAR2(50),
    amount_tendered     NUMBER(10,2),
    amount_change       NUMBER(10,2),
    transaction_id      VARCHAR2(50),                 -- Gateway transaction ID
    
    -- Status
    sale_status         VARCHAR2(20)    NOT NULL CHECK (sale_status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'VOID')),
    status_date         TIMESTAMP       DEFAULT SYSTIMESTAMP,
    
    -- Customer tracking
    customer_name       VARCHAR2(100),
    customer_email      VARCHAR2(100),
    customer_phone      VARCHAR2(20),
    
    -- Loyalty
    loyalty_points_earned NUMBER(6)     DEFAULT 0,
    loyalty_points_used NUMBER(6)       DEFAULT 0,
    
    -- Notes
    internal_notes      CLOB,
    customer_notes      CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_sales_reference ON sales(sale_reference);
CREATE INDEX idx_sales_booking ON sales(booking_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_branch ON sales(branch_id);
CREATE INDEX idx_sales_cashier ON sales(cashier_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_status ON sales(sale_status);
CREATE INDEX idx_sales_channel ON sales(sale_channel);

-- ============================================================
-- SALES_ITEMS (Concession sale line items)
-- ============================================================
CREATE TABLE sales_items (
    sale_item_id        NUMBER(12)      PRIMARY KEY,
    sale_id             NUMBER(12)      NOT NULL REFERENCES sales(sale_id) ON DELETE CASCADE,
    product_id          NUMBER(12)      NOT NULL REFERENCES products(product_id),
    
    -- Sale details
    quantity_sold       NUMBER(6)       NOT NULL,
    unit_price          NUMBER(10,2)    NOT NULL,        -- Price at time of sale
    discount_amount     NUMBER(10,2)    DEFAULT 0,
    tax_amount          NUMBER(10,2)    DEFAULT 0,
    line_total          NUMBER(10,2)    GENERATED ALWAYS AS (quantity_sold * unit_price - discount_amount + tax_amount) VIRTUAL,
    
    -- Promotion
    promotion_id        NUMBER(12)      REFERENCES promotions(promotion_id),
    is_combo_item       CHAR(1)         DEFAULT 'N' CHECK (is_combo_item IN ('Y', 'N')),
    combo_group_id      VARCHAR2(50),                    -- Group items in a combo
    
    -- Cost
    unit_cost           NUMBER(10,2)    NOT NULL,        -- Cost at time of sale
    total_cost          NUMBER(12,2)    GENERATED ALWAYS AS (quantity_sold * unit_cost) VIRTUAL,
    
    -- Inventory tracking
    inventory_txn_id    NUMBER(12)      REFERENCES inventory_transactions(transaction_id),
    batch_number        VARCHAR2(50),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'REFUNDED')),
    
    -- Notes
    notes               VARCHAR2(255),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_si_sale ON sales_items(sale_id);
CREATE INDEX idx_si_product ON sales_items(product_id);
CREATE INDEX idx_si_promotion ON sales_items(promotion_id);
CREATE INDEX idx_si_combo ON sales_items(combo_group_id) WHERE combo_group_id IS NOT NULL;

-- ============================================================
-- EMPLOYEES (Core employee master)
-- ============================================================
CREATE TABLE employees (
    employee_id         NUMBER(12)      PRIMARY KEY,
    employee_code       VARCHAR2(20)    UNIQUE NOT NULL,
    employee_guid       VARCHAR2(36)    UNIQUE,
    
    -- Personal information
    first_name          VARCHAR2(50)    NOT NULL,
    last_name           VARCHAR2(50)    NOT NULL,
    middle_name         VARCHAR2(50),
    preferred_name      VARCHAR2(50),
    display_name        VARCHAR2(200)   GENERATED ALWAYS AS (first_name || ' ' || last_name) VIRTUAL,
    
    -- Gender and DOB
    gender              VARCHAR2(1)     CHECK (gender IN ('M', 'F', 'O', 'U')),
    date_of_birth       DATE,
    
    -- Identification
    national_id         VARCHAR2(20)    UNIQUE,
    passport_number     VARCHAR2(20)    UNIQUE,
    tax_id              VARCHAR2(20)    UNIQUE,
    social_security_no  VARCHAR2(20)    UNIQUE,
    
    -- Contact details
    email               VARCHAR2(100)   UNIQUE NOT NULL,
    phone               VARCHAR2(20)    NOT NULL,
    alternate_phone     VARCHAR2(20),
    emergency_contact   VARCHAR2(100),
    emergency_phone     VARCHAR2(20),
    emergency_relationship VARCHAR2(50),
    
    -- Address
    address_line1       VARCHAR2(100),
    address_line2       VARCHAR2(100),
    city                VARCHAR2(50),
    region              VARCHAR2(50),
    country             VARCHAR2(50)    DEFAULT 'Ghana',
    postal_code         VARCHAR2(20),
    
    -- Employment details
    employee_status     VARCHAR2(20)    NOT NULL DEFAULT 'ACTIVE' CHECK (employee_status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED', 'RETIRED')),
    hire_date           DATE            NOT NULL,
    confirmation_date   DATE,
    termination_date    DATE,
    termination_reason  VARCHAR2(255),
    
    -- Position
    current_position_id NUMBER(12)      REFERENCES employee_positions(position_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    department          VARCHAR2(50),
    supervisor_id       NUMBER(12)      REFERENCES employees(employee_id),
    
    -- Employment type
    employment_type     VARCHAR2(30)    NOT NULL CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'TEMPORARY', 'CONTRACT', 'INTERN', 'VOLUNTEER', 'SEASONAL')),
    contract_start      DATE,
    contract_end        DATE,
    probation_end       DATE,
    work_hours_per_week NUMBER(3)       DEFAULT 40,
    
    -- Compensation
    salary_grade        VARCHAR2(20),
    base_salary         NUMBER(10,2),
    hourly_rate         NUMBER(10,2),
    overtime_rate       NUMBER(10,2),
    bonus_eligible      CHAR(1)         DEFAULT 'Y' CHECK (bonus_eligible IN ('Y', 'N')),
    commission_rate     NUMBER(5,2)     DEFAULT 0,
    
    -- Banking
    bank_name           VARCHAR2(100),
    bank_account_number VARCHAR2(50),
    bank_branch         VARCHAR2(100),
    
    -- Qualifications
    education_level     VARCHAR2(50),
    major               VARCHAR2(50),
    university          VARCHAR2(100),
    graduation_year     NUMBER(4),
    
    -- Skills
    skills              CLOB,                            -- JSON array of skills
    languages           VARCHAR2(200),                   -- Comma-separated languages
    
    -- Emergency
    emergency_contact_2 VARCHAR2(100),
    emergency_phone_2   VARCHAR2(20),
    
    -- System access
    username            VARCHAR2(50)    UNIQUE,
    password_hash       VARCHAR2(255),
    email_verified      CHAR(1)         DEFAULT 'N' CHECK (email_verified IN ('Y', 'N')),
    phone_verified      CHAR(1)         DEFAULT 'N' CHECK (phone_verified IN ('Y', 'N')),
    last_login_date     TIMESTAMP,
    last_login_ip       VARCHAR2(45),
    login_count         NUMBER(6)       DEFAULT 0,
    
    -- Security
    two_factor_enabled  CHAR(1)         DEFAULT 'N' CHECK (two_factor_enabled IN ('Y', 'N')),
    security_question_1 VARCHAR2(255),
    security_answer_1   VARCHAR2(255),
    security_question_2 VARCHAR2(255),
    security_answer_2   VARCHAR2(255),
    
    -- Notes
    notes               CLOB,
    internal_notes      CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_employees_code ON employees(employee_code);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_phone ON employees(phone);
CREATE INDEX idx_employees_branch ON employees(branch_id);
CREATE INDEX idx_employees_status ON employees(employee_status);
CREATE INDEX idx_employees_supervisor ON employees(supervisor_id);
CREATE INDEX idx_employees_position ON employees(current_position_id);
CREATE INDEX idx_employees_hire ON employees(hire_date);
CREATE INDEX idx_employees_name ON employees(last_name, first_name);

-- Composite indexes
CREATE INDEX idx_employees_branch_status ON employees(branch_id, employee_status);
CREATE INDEX idx_employees_supervisor_status ON employees(supervisor_id, employee_status);

-- ============================================================
-- EMPLOYEE_POSITIONS (Job roles and positions)
-- ============================================================
CREATE TABLE employee_positions (
    position_id         NUMBER(12)      PRIMARY KEY,
    position_code       VARCHAR2(20)    UNIQUE NOT NULL,
    position_name       VARCHAR2(50)    NOT NULL,
    position_description VARCHAR2(255),
    
    -- Categorization
    position_category   VARCHAR2(30)    NOT NULL CHECK (position_category IN ('MANAGEMENT', 'SUPERVISOR', 'CASHIER', 'TICKETING', 'CONCESSIONS', 'PROJECTIONIST', 'USHER', 'CLEANER', 'SECURITY', 'MAINTENANCE', 'IT', 'MARKETING', 'HR', 'ACCOUNTING', 'OTHER')),
    position_level      NUMBER(2)       NOT NULL,        -- 1=Entry, 2=Junior, 3=Senior, 4=Supervisor, 5=Manager, 6=Director
    position_grade      VARCHAR2(20),
    
    -- Compensation defaults
    min_salary          NUMBER(10,2),
    max_salary          NUMBER(10,2),
    default_hourly_rate NUMBER(10,2),
    overtime_eligible   CHAR(1)         DEFAULT 'Y' CHECK (overtime_eligible IN ('Y', 'N')),
    bonus_eligible      CHAR(1)         DEFAULT 'N' CHECK (bonus_eligible IN ('Y', 'N')),
    
    -- Requirements
    min_education       VARCHAR2(50),
    min_experience_years NUMBER(2)      DEFAULT 0,
    required_certifications CLOB,                      -- JSON array of required certs
    required_skills     CLOB,                          -- JSON array of required skills
    
    -- Responsibilities
    responsibilities    CLOB,
    key_performance_indicators CLOB,
    
    -- Status
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Insert default positions
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(1, 'GEN_MGR', 'General Manager', 'MANAGEMENT', 5, 50.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(2, 'ASST_MGR', 'Assistant Manager', 'MANAGEMENT', 4, 35.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(3, 'SUPERVISOR', 'Shift Supervisor', 'SUPERVISOR', 4, 25.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(4, 'SR_CASHIER', 'Senior Cashier', 'CASHIER', 3, 18.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(5, 'CASHIER', 'Cashier', 'CASHIER', 2, 15.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(6, 'TICKET_AGENT', 'Ticket Agent', 'TICKETING', 2, 14.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(7, 'CONCESSION', 'Concession Staff', 'CONCESSIONS', 2, 14.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(8, 'PROJECTIONIST', 'Projectionist', 'PROJECTIONIST', 3, 20.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(9, 'USHER', 'Usher', 'USHER', 1, 12.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(10, 'CLEANER', 'Cleaner', 'CLEANER', 1, 11.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(11, 'SECURITY', 'Security Guard', 'SECURITY', 2, 13.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(12, 'MAINTENANCE', 'Maintenance Technician', 'MAINTENANCE', 3, 18.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(13, 'IT_SUPPORT', 'IT Support', 'IT', 3, 22.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(14, 'MARKETING', 'Marketing Coordinator', 'MARKETING', 3, 25.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(15, 'HR', 'HR Assistant', 'HR', 3, 22.00, 'Y');
INSERT INTO employee_positions (position_id, position_code, position_name, position_category, position_level, default_hourly_rate, is_active) VALUES(16, 'ACCOUNTANT', 'Accountant', 'ACCOUNTING', 3, 25.00, 'Y');

CREATE INDEX idx_positions_category ON employee_positions(position_category);
CREATE INDEX idx_positions_level ON employee_positions(position_level);
CREATE INDEX idx_positions_active ON employee_positions(is_active);

-- ============================================================
-- EMPLOYEE_SHIFTS (Work schedule)
-- ============================================================
CREATE TABLE employee_shifts (
    shift_id            NUMBER(12)      PRIMARY KEY,
    shift_reference     VARCHAR2(30)    UNIQUE NOT NULL,
    employee_id         NUMBER(12)      NOT NULL REFERENCES employees(employee_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Shift details
    shift_date          DATE            NOT NULL,
    shift_type          VARCHAR2(20)    NOT NULL CHECK (shift_type IN ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT', 'SPLIT', 'FLEXIBLE')),
    shift_start_time    TIMESTAMP       NOT NULL,
    shift_end_time      TIMESTAMP       NOT NULL,
    break_start_time    TIMESTAMP,
    break_end_time      TIMESTAMP,
    break_duration_minutes NUMBER(4)    DEFAULT 0,
    total_hours         NUMBER(5,2)     GENERATED ALWAYS AS (
        EXTRACT(DAY FROM (shift_end_time - shift_start_time)) * 24 +
        EXTRACT(HOUR FROM (shift_end_time - shift_start_time)) +
        EXTRACT(MINUTE FROM (shift_end_time - shift_start_time)) / 60
    ) VIRTUAL,
    
    -- Position
    position_id         NUMBER(12)      REFERENCES employee_positions(position_id),
    
    -- Status
    shift_status        VARCHAR2(20)    DEFAULT 'SCHEDULED' CHECK (shift_status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SWAPPED', 'COVERED')),
    status_notes        VARCHAR2(255),
    
    -- Scheduling
    scheduled_by        VARCHAR2(30),
    scheduled_date      DATE            DEFAULT SYSDATE,
    confirmed_by        VARCHAR2(30),
    confirmed_date      DATE,
    
    -- Swap/Cover
    original_employee_id NUMBER(12)     REFERENCES employees(employee_id),
    swapped_employee_id NUMBER(12)      REFERENCES employees(employee_id),
    swap_reason         VARCHAR2(255),
    swap_approved_by    VARCHAR2(30),
    swap_approved_date  DATE,
    
    -- Notes
    shift_notes         CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_shifts_employee ON employee_shifts(employee_id);
CREATE INDEX idx_shifts_branch ON employee_shifts(branch_id);
CREATE INDEX idx_shifts_date ON employee_shifts(shift_date);
CREATE INDEX idx_shifts_status ON employee_shifts(shift_status);
CREATE INDEX idx_shifts_date_employee ON employee_shifts(shift_date, employee_id);
CREATE INDEX idx_shifts_date_branch ON employee_shifts(shift_date, branch_id);

-- ============================================================
-- ATTENDANCE (Time and attendance tracking)
-- ============================================================
CREATE TABLE attendance (
    attendance_id       NUMBER(12)      PRIMARY KEY,
    attendance_reference VARCHAR2(30)   UNIQUE NOT NULL,
    employee_id         NUMBER(12)      NOT NULL REFERENCES employees(employee_id),
    shift_id            NUMBER(12)      REFERENCES employee_shifts(shift_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Clock events
    clock_in_time       TIMESTAMP       NOT NULL,
    clock_out_time      TIMESTAMP,
    break_start_time    TIMESTAMP,
    break_end_time      TIMESTAMP,
    
    -- Calculated durations
    total_hours         NUMBER(5,2)     GENERATED ALWAYS AS (
        CASE 
            WHEN clock_out_time IS NOT NULL THEN
                EXTRACT(DAY FROM (clock_out_time - clock_in_time)) * 24 +
                EXTRACT(HOUR FROM (clock_out_time - clock_in_time)) +
                EXTRACT(MINUTE FROM (clock_out_time - clock_in_time)) / 60
            ELSE NULL
        END
    ) VIRTUAL,
    break_hours         NUMBER(5,2)     GENERATED ALWAYS AS (
        CASE 
            WHEN break_start_time IS NOT NULL AND break_end_time IS NOT NULL THEN
                EXTRACT(DAY FROM (break_end_time - break_start_time)) * 24 +
                EXTRACT(HOUR FROM (break_end_time - break_start_time)) +
                EXTRACT(MINUTE FROM (break_end_time - break_start_time)) / 60
            ELSE 0
        END
    ) VIRTUAL,
    net_hours           NUMBER(5,2)     GENERATED ALWAYS AS (total_hours - break_hours) VIRTUAL,
    
    -- Clock method
    clock_in_method     VARCHAR2(30)    CHECK (clock_in_method IN ('BIOMETRIC', 'CARD_SWIPE', 'MOBILE_APP', 'MANUAL', 'FACE_RECOGNITION', 'FINGERPRINT')),
    clock_out_method    VARCHAR2(30)    CHECK (clock_out_method IN ('BIOMETRIC', 'CARD_SWIPE', 'MOBILE_APP', 'MANUAL', 'FACE_RECOGNITION', 'FINGERPRINT')),
    
    -- Device info
    clock_in_device     VARCHAR2(50),
    clock_out_device    VARCHAR2(50),
    clock_in_ip         VARCHAR2(45),
    clock_out_ip        VARCHAR2(45),
    
    -- Status
    attendance_status   VARCHAR2(20)    NOT NULL DEFAULT 'PRESENT' CHECK (attendance_status IN ('PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE', 'LEFT_EARLY', 'OVERTIME', 'HOLIDAY', 'SICK_LEAVE', 'VACATION', 'TRAINING', 'OTHER')),
    status_notes        VARCHAR2(255),
    
    -- Overtime
    overtime_hours      NUMBER(5,2)     GENERATED ALWAYS AS (
        CASE 
            WHEN net_hours > 8 THEN net_hours - 8
            ELSE 0
        END
    ) VIRTUAL,
    overtime_approved   CHAR(1)         DEFAULT 'N' CHECK (overtime_approved IN ('Y', 'N')),
    overtime_approved_by VARCHAR2(30),
    overtime_approved_date DATE,
    
    -- Approval
    approved_by         VARCHAR2(30),
    approval_date       DATE,
    
    -- Notes
    attendance_notes    CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_attendance_employee ON attendance(employee_id);
CREATE INDEX idx_attendance_shift ON attendance(shift_id);
CREATE INDEX idx_attendance_branch ON attendance(branch_id);
CREATE INDEX idx_attendance_clock_in ON attendance(clock_in_time);
CREATE INDEX idx_attendance_clock_out ON attendance(clock_out_time) WHERE clock_out_time IS NOT NULL;
CREATE INDEX idx_attendance_status ON attendance(attendance_status);
CREATE INDEX idx_attendance_date ON attendance(clock_in_time DESC);

-- ============================================================
-- PAYROLL_REFERENCE (Payroll tracking and reference)
-- ============================================================
CREATE TABLE payroll_reference (
    payroll_id          NUMBER(12)      PRIMARY KEY,
    payroll_reference   VARCHAR2(30)    UNIQUE NOT NULL,
    employee_id         NUMBER(12)      NOT NULL REFERENCES employees(employee_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Period
    pay_period_start    DATE            NOT NULL,
    pay_period_end      DATE            NOT NULL,
    pay_date            DATE            NOT NULL,
    
    -- Hours
    regular_hours       NUMBER(5,2)     DEFAULT 0,
    overtime_hours      NUMBER(5,2)     DEFAULT 0,
    holiday_hours       NUMBER(5,2)     DEFAULT 0,
    sick_hours          NUMBER(5,2)     DEFAULT 0,
    vacation_hours      NUMBER(5,2)     DEFAULT 0,
    training_hours      NUMBER(5,2)     DEFAULT 0,
    total_hours         NUMBER(5,2)     GENERATED ALWAYS AS (regular_hours + overtime_hours + holiday_hours) VIRTUAL,
    
    -- Earnings
    regular_pay         NUMBER(10,2)    DEFAULT 0,
    overtime_pay        NUMBER(10,2)    DEFAULT 0,
    holiday_pay         NUMBER(10,2)    DEFAULT 0,
    bonus_amount        NUMBER(10,2)    DEFAULT 0,
    commission_amount   NUMBER(10,2)    DEFAULT 0,
    allowance_amount    NUMBER(10,2)    DEFAULT 0,
    gross_pay           NUMBER(12,2)    GENERATED ALWAYS AS (regular_pay + overtime_pay + holiday_pay + bonus_amount + commission_amount + allowance_amount) VIRTUAL,
    
    -- Deductions
    tax_deduction       NUMBER(10,2)    DEFAULT 0,
    social_security     NUMBER(10,2)    DEFAULT 0,
    pension_contribution NUMBER(10,2)   DEFAULT 0,
    health_insurance    NUMBER(10,2)    DEFAULT 0,
    other_deductions    NUMBER(10,2)    DEFAULT 0,
    total_deductions    NUMBER(12,2)    GENERATED ALWAYS AS (tax_deduction + social_security + pension_contribution + health_insurance + other_deductions) VIRTUAL,
    
    -- Net pay
    net_pay             NUMBER(12,2)    GENERATED ALWAYS AS (gross_pay - total_deductions) VIRTUAL,
    
    -- Bank details
    bank_name           VARCHAR2(100),
    bank_account_number VARCHAR2(50),
    bank_branch         VARCHAR2(100),
    
    -- Status
    payroll_status      VARCHAR2(20)    DEFAULT 'DRAFT' CHECK (payroll_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSED', 'PAID', 'CANCELLED')),
    status_date         DATE            DEFAULT SYSDATE,
    
    -- Approval
    approved_by         VARCHAR2(30),
    approval_date       DATE,
    processed_by        VARCHAR2(30),
    processed_date      DATE,
    paid_by             VARCHAR2(30),
    paid_date           DATE,
    
    -- Notes
    payroll_notes       CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_payroll_employee ON payroll_reference(employee_id);
CREATE INDEX idx_payroll_branch ON payroll_reference(branch_id);
CREATE INDEX idx_payroll_period ON payroll_reference(pay_period_start, pay_period_end);
CREATE INDEX idx_payroll_status ON payroll_reference(payroll_status);
CREATE INDEX idx_payroll_pay_date ON payroll_reference(pay_date);

-- ============================================================
-- TRAINING (Training programs and certifications)
-- ============================================================
CREATE TABLE training (
    training_id         NUMBER(12)      PRIMARY KEY,
    training_code       VARCHAR2(20)    UNIQUE NOT NULL,
    training_name       VARCHAR2(100)   NOT NULL,
    training_description VARCHAR2(500),
    
    -- Categorization
    training_category   VARCHAR2(30)    NOT NULL CHECK (training_category IN ('ORIENTATION', 'TECHNICAL', 'SAFETY', 'CUSTOMER_SERVICE', 'SOFT_SKILLS', 'MANAGEMENT', 'COMPLIANCE', 'CERTIFICATION', 'OTHER')),
    training_level      VARCHAR2(20)    CHECK (training_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),
    
    -- Details
    duration_hours      NUMBER(5,2),
    provider            VARCHAR2(100),
    external_provider   CHAR(1)         DEFAULT 'N' CHECK (external_provider IN ('Y', 'N')),
    provider_name       VARCHAR2(100),
    provider_contact    VARCHAR2(100),
    training_material   CLOB,
    training_url        VARCHAR2(500),
    video_url           VARCHAR2(500),
    
    -- Certification
    is_certified        CHAR(1)         DEFAULT 'N' CHECK (is_certified IN ('Y', 'N')),
    certification_name  VARCHAR2(100),
    certification_body  VARCHAR2(100),
    validity_period_months NUMBER(3),
    renewal_required    CHAR(1)         DEFAULT 'N' CHECK (renewal_required IN ('Y', 'N')),
    
    -- Prerequisites
    prerequisite_training_ids CLOB,    -- JSON array of training IDs
    
    -- Status
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    is_mandatory        CHAR(1)         DEFAULT 'N' CHECK (is_mandatory IN ('Y', 'N')),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_training_code ON training(training_code);
CREATE INDEX idx_training_category ON training(training_category);
CREATE INDEX idx_training_active ON training(is_active);
CREATE INDEX idx_training_mandatory ON training(is_mandatory) WHERE is_mandatory = 'Y';

-- ============================================================
-- EMPLOYEE_TRAINING (Training completion records)
-- ============================================================
CREATE TABLE employee_training (
    employee_training_id NUMBER(12)     PRIMARY KEY,
    employee_id         NUMBER(12)      NOT NULL REFERENCES employees(employee_id),
    training_id         NUMBER(12)      NOT NULL REFERENCES training(training_id),
    
    -- Completion
    completed_date      DATE,
    completion_status   VARCHAR2(20)    NOT NULL CHECK (completion_status IN ('ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'PASSED', 'FAILED', 'CERTIFIED', 'EXPIRED', 'CANCELLED')),
    completion_score    NUMBER(5,2),                    -- Percentage or score
    completion_grade    VARCHAR2(10),                   -- A, B, C, etc.
    
    -- Certification
    certification_number VARCHAR2(50),
    cert_issue_date     DATE,
    cert_expiry_date    DATE,
    cert_authority      VARCHAR2(100),
    cert_notes          CLOB,
    
    -- Training details
    trainer             VARCHAR2(100),
    training_location   VARCHAR2(100),
    training_date_start DATE,
    training_date_end   DATE,
    total_hours         NUMBER(5,2),
    
    -- Cost
    training_cost       NUMBER(10,2),
    paid_by_employer    CHAR(1)         DEFAULT 'Y' CHECK (paid_by_employer IN ('Y', 'N')),
    
    -- Evaluation
    supervisor_rating   NUMBER(2,1)     CHECK (supervisor_rating BETWEEN 1 AND 5),
    supervisor_comments CLOB,
    self_evaluation     CLOB,
    
    -- Renewal
    renewal_reminder_sent CHAR(1)       DEFAULT 'N' CHECK (renewal_reminder_sent IN ('Y', 'N')),
    renewal_reminder_date DATE,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_emp_training_employee ON employee_training(employee_id);
CREATE INDEX idx_emp_training_training ON employee_training(training_id);
CREATE INDEX idx_emp_training_status ON employee_training(completion_status);
CREATE INDEX idx_emp_training_cert ON employee_training(certification_number) WHERE certification_number IS NOT NULL;
CREATE INDEX idx_emp_training_expiry ON employee_training(cert_expiry_date) WHERE cert_expiry_date IS NOT NULL;

-- ============================================================
-- EMPLOYEE_DOCUMENTS (HR documents storage)
-- ============================================================
CREATE TABLE employee_documents (
    document_id         NUMBER(12)      PRIMARY KEY,
    document_reference  VARCHAR2(30)    UNIQUE NOT NULL,
    employee_id         NUMBER(12)      NOT NULL REFERENCES employees(employee_id),
    
    -- Document details
    document_type       VARCHAR2(30)    NOT NULL CHECK (document_type IN ('RESUME', 'CV', 'COVER_LETTER', 'ID_COPY', 'PASSPORT_COPY', 'DRIVERS_LICENSE', 'CONTRACT', 'CERTIFICATE', 'CERTIFICATION', 'PERFORMANCE_REVIEW', 'DISCIPLINARY', 'TERMINATION', 'OTHER')),
    document_category   VARCHAR2(30)    NOT NULL CHECK (document_category IN ('PERSONAL', 'EMPLOYMENT', 'EDUCATION', 'CERTIFICATION', 'PERFORMANCE', 'LEGAL', 'OTHER')),
    document_name       VARCHAR2(100)   NOT NULL,
    document_description VARCHAR2(255),
    
    -- File details
    file_name           VARCHAR2(255)   NOT NULL,
    file_type           VARCHAR2(20)    NOT NULL,        -- PDF, DOC, DOCX, JPG, PNG, etc.
    file_size_bytes     NUMBER(10),
    file_content        BLOB,                            -- File content
    file_path           VARCHAR2(500),                   -- Alternative: stored path
    file_hash           VARCHAR2(64),                    -- For integrity check
    
    -- Upload details
    uploaded_date       TIMESTAMP       NOT NULL,
    uploaded_by         VARCHAR2(30)    NOT NULL,
    version_number      NUMBER(3)       DEFAULT 1,
    
    -- Expiry
    expires_date        DATE,
    is_current          CHAR(1)         DEFAULT 'Y' CHECK (is_current IN ('Y', 'N')),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED', 'DELETED')),
    
    -- Notes
    document_notes      CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_docs_employee ON employee_documents(employee_id);
CREATE INDEX idx_docs_type ON employee_documents(document_type);
CREATE INDEX idx_docs_category ON employee_documents(document_category);
CREATE INDEX idx_docs_status ON employee_documents(status);

-- ============================================================
-- PROMOTIONS (Marketing campaigns and offers)
-- ============================================================
CREATE TABLE promotions (
    promotion_id        NUMBER(12)      PRIMARY KEY,
    promotion_code      VARCHAR2(30)    UNIQUE NOT NULL,
    promotion_guid      VARCHAR2(36)    UNIQUE,
    
    -- Basic details
    promotion_name      VARCHAR2(100)   NOT NULL,
    promotion_description VARCHAR2(500),
    promotion_type      VARCHAR2(30)    NOT NULL CHECK (promotion_type IN ('PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'BUY_ONE_GET_ONE', 'FREE_ITEM', 'FREE_TICKET', 'LOYALTY_BONUS', 'REFERRAL', 'FLASH_SALE', 'HOLIDAY_SPECIAL', 'PREMIERE_OFFER', 'MEMBERSHIP_DISCOUNT', 'OTHER')),
    
    -- Categorization
    promotion_category  VARCHAR2(30)    NOT NULL CHECK (promotion_category IN ('TICKET', 'CONCESSION', 'COMBINED', 'MEMBERSHIP', 'GENERAL', 'MERCHANDISE')),
    promotion_subcategory VARCHAR2(30),
    
    -- Timing
    start_date          DATE            NOT NULL,
    end_date            DATE            NOT NULL,
    active_days_of_week VARCHAR2(14),                   -- e.g., 'MON,TUE,WED'
    start_time          VARCHAR2(8),                     -- e.g., '09:00:00'
    end_time            VARCHAR2(8),                     -- e.g., '23:00:00'
    
    -- Discount details
    discount_value      NUMBER(10,2)    NOT NULL,
    discount_type       VARCHAR2(20)    NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    max_discount_amount NUMBER(10,2),                    -- Cap on discount
    min_purchase_amount NUMBER(10,2)    DEFAULT 0,
    
    -- Eligibility
    target_customer_segments CLOB,                      -- JSON array of segments
    target_membership_tiers CLOB,                       -- JSON array of tiers
    target_movie_genres  CLOB,                          -- JSON array of genres
    target_branches      CLOB,                          -- JSON array of branch IDs
    
    -- Conditions
    min_ticket_quantity NUMBER(3)       DEFAULT 1,
    max_ticket_quantity NUMBER(3)       DEFAULT 10,
    requires_coupon     CHAR(1)         DEFAULT 'N' CHECK (requires_coupon IN ('Y', 'N')),
    requires_voucher    CHAR(1)         DEFAULT 'N' CHECK (requires_voucher IN ('Y', 'N')),
    is_stackable        CHAR(1)         DEFAULT 'N' CHECK (is_stackable IN ('Y', 'N')),
    stack_priority      NUMBER(2)       DEFAULT 1,
    
    -- Usage limits
    usage_limit_per_customer NUMBER(6)  DEFAULT 1,
    usage_limit_total    NUMBER(10)     DEFAULT 0,       -- 0 = unlimited
    usage_count_current  NUMBER(10)     DEFAULT 0,
    
    -- Budget
    budget_amount       NUMBER(12,2),
    budget_used         NUMBER(12,2)    DEFAULT 0,
    
    -- Targeting
    target_channels     VARCHAR2(100)   DEFAULT 'ALL',  -- 'ONLINE,APP,BOX_OFFICE,KIOSK'
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED', 'COMPLETED')),
    
    -- Marketing
    promo_image_url     VARCHAR2(500),
    promo_banner_url    VARCHAR2(500),
    promo_text          CLOB,
    email_template      CLOB,
    
    -- Tracking
    utm_source          VARCHAR2(50),
    utm_medium          VARCHAR2(50),
    utm_campaign        VARCHAR2(50),
    utm_content         VARCHAR2(50),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    approved_by         VARCHAR2(30),
    approved_date       DATE,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_promotions_code ON promotions(promotion_code);
CREATE INDEX idx_promotions_type ON promotions(promotion_type);
CREATE INDEX idx_promotions_category ON promotions(promotion_category);
CREATE INDEX idx_promotions_status ON promotions(status);
CREATE INDEX idx_promotions_dates ON promotions(start_date, end_date);
CREATE INDEX idx_promotions_active ON promotions(status) WHERE status = 'ACTIVE';

-- ============================================================
-- COUPONS (Individual discount codes)
-- ============================================================
CREATE TABLE coupons (
    coupon_id           NUMBER(12)      PRIMARY KEY,
    coupon_code         VARCHAR2(50)    UNIQUE NOT NULL,
    coupon_guid         VARCHAR2(36)    UNIQUE,
    
    -- Links
    promotion_id        NUMBER(12)      REFERENCES promotions(promotion_id),
    customer_id         NUMBER(12)      REFERENCES customers(customer_id),  -- Assigned to customer
    booking_id          NUMBER(12)      REFERENCES bookings(booking_id),    -- Applied to booking
    
    -- Coupon details
    discount_value      NUMBER(10,2)    NOT NULL,
    discount_type       VARCHAR2(20)    NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    min_purchase_amount NUMBER(10,2)    DEFAULT 0,
    max_discount_amount NUMBER(10,2),
    
    -- Validity
    issue_date          DATE            NOT NULL,
    valid_from          DATE            NOT NULL,
    valid_until         DATE            NOT NULL,
    
    -- Usage
    is_used             CHAR(1)         DEFAULT 'N' CHECK (is_used IN ('Y', 'N')),
    used_date           TIMESTAMP,
    used_by_customer_id NUMBER(12)      REFERENCES customers(customer_id),
    
    -- Assignment
    assigned_to_customer_id NUMBER(12)  REFERENCES customers(customer_id),
    assigned_date       DATE,
    assigned_by         VARCHAR2(30),
    
    -- Eligibility
    applicable_channels VARCHAR2(100)   DEFAULT 'ALL',
    applicable_products CLOB,                          -- JSON array of product IDs
    
    -- Source
    generation_method   VARCHAR2(30)    CHECK (generation_method IN ('SYSTEM', 'BATCH', 'MANUAL', 'CAMPAIGN')),
    batch_id            VARCHAR2(50),                   -- For bulk generation
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
    
    -- Notes
    coupon_notes        CLOB,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_coupons_code ON coupons(coupon_code);
CREATE INDEX idx_coupons_promotion ON coupons(promotion_id);
CREATE INDEX idx_coupons_customer ON coupons(customer_id);
CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupons_valid ON coupons(valid_from, valid_until);
CREATE INDEX idx_coupons_used ON coupons(is_used) WHERE is_used = 'N';

-- ============================================================
-- VOUCHERS (Gift vouchers)
-- ============================================================
CREATE TABLE vouchers (
    voucher_id          NUMBER(12)      PRIMARY KEY,
    voucher_code        VARCHAR2(50)    UNIQUE NOT NULL,
    voucher_pin         VARCHAR2(20)    UNIQUE,                            -- PIN for security
    voucher_guid        VARCHAR2(36)    UNIQUE,
    
    -- Voucher details
    voucher_type        VARCHAR2(30)    NOT NULL CHECK (voucher_type IN ('GIFT_CARD', 'VOUCHER', 'COMPLIMENTARY', 'BIRTHDAY', 'LOYALTY_REWARD', 'REFERRAL_BONUS', 'CONTEST_WIN')),
    voucher_name        VARCHAR2(100)   NOT NULL,
    voucher_description VARCHAR2(255),
    
    -- Financials
    original_value      NUMBER(10,2)    NOT NULL,
    current_balance     NUMBER(10,2)    NOT NULL,
    currency            VARCHAR2(3)     DEFAULT 'GHS',
    tax_included        CHAR(1)         DEFAULT 'Y' CHECK (tax_included IN ('Y', 'N')),
    
    -- Issuance
    issue_date          DATE            NOT NULL,
    issued_by           VARCHAR2(30),
    issued_to_customer_id NUMBER(12)    REFERENCES customers(customer_id),
    issued_to_email     VARCHAR2(100),
    issued_to_phone     VARCHAR2(20),
    
    -- Validity
    valid_from          DATE            NOT NULL,
    valid_until         DATE            NOT NULL,
    is_expired          CHAR(1)         DEFAULT 'N' CHECK (is_expired IN ('Y', 'N')),
    
    -- Purchase
    purchased_by_customer_id NUMBER(12) REFERENCES customers(customer_id),
    purchase_date       DATE,
    purchase_amount     NUMBER(10,2),
    purchase_reference  VARCHAR2(50),
    
    -- Usage
    is_used             CHAR(1)         DEFAULT 'N' CHECK (is_used IN ('Y', 'N')),
    used_date           TIMESTAMP,
    used_by_customer_id NUMBER(12)      REFERENCES customers(customer_id),
    
    -- Activation
    activation_date     DATE,
    activation_status   VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (activation_status IN ('ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED', 'USED')),
    
    -- Restrictions
    applicable_branches CLOB,                           -- JSON array of branch IDs
    applicable_products CLOB,                           -- JSON array of product IDs
    applicable_services CLOB,                           -- JSON array of service types
    
    -- Gift recipient
    recipient_name      VARCHAR2(100),
    recipient_email     VARCHAR2(100),
    recipient_phone     VARCHAR2(20),
    personalized_message CLOB,
    
    -- Notification
    notification_sent   CHAR(1)         DEFAULT 'N' CHECK (notification_sent IN ('Y', 'N')),
    notification_date   DATE,
    notification_method VARCHAR2(30),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_vouchers_code ON vouchers(voucher_code);
CREATE INDEX idx_vouchers_customer ON vouchers(issued_to_customer_id);
CREATE INDEX idx_vouchers_valid ON vouchers(valid_from, valid_until);
CREATE INDEX idx_vouchers_balance ON vouchers(current_balance) WHERE current_balance > 0;
CREATE INDEX idx_vouchers_status ON vouchers(activation_status);

-- ============================================================
-- VOUCHER_TRANSACTIONS (Voucher usage and reload history)
-- ============================================================
CREATE TABLE voucher_transactions (
    transaction_id      NUMBER(12)      PRIMARY KEY,
    voucher_id          NUMBER(12)      NOT NULL REFERENCES vouchers(voucher_id),
    
    -- Transaction details
    transaction_type    VARCHAR2(30)    NOT NULL CHECK (transaction_type IN ('PURCHASE', 'LOAD', 'USE', 'REFUND', 'ADJUSTMENT', 'EXPIRE')),
    transaction_date    TIMESTAMP       NOT NULL,
    
    -- Amounts
    amount              NUMBER(10,2)    NOT NULL,
    balance_before      NUMBER(10,2)    NOT NULL,
    balance_after       NUMBER(10,2)    NOT NULL,
    
    -- Reference
    reference           VARCHAR2(100),                     -- Booking ID, Sale ID, etc.
    reference_type      VARCHAR2(50),                     -- 'BOOKING', 'SALE', 'REFUND', etc.
    
    -- Customer
    customer_id         NUMBER(12)      REFERENCES customers(customer_id),
    
    -- Notes
    transaction_notes   VARCHAR2(255),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_voucher_trans_voucher ON voucher_transactions(voucher_id);
CREATE INDEX idx_voucher_trans_date ON voucher_transactions(transaction_date);
CREATE INDEX idx_voucher_trans_type ON voucher_transactions(transaction_type);

-- ============================================================
-- MEMBERSHIP_TIERS (Bronze, Silver, Gold, Platinum)
-- ============================================================
CREATE TABLE membership_tiers (
    tier_id             NUMBER(12)      PRIMARY KEY,
    tier_code           VARCHAR2(20)    UNIQUE NOT NULL,
    tier_name           VARCHAR2(50)    NOT NULL,
    tier_description    VARCHAR2(255),
    
    -- Thresholds
    points_required     NUMBER(10)      NOT NULL,        -- Points needed to reach this tier
    annual_spend_required NUMBER(12,2)  NOT NULL,
    visit_required      NUMBER(6)       NOT NULL,
    
    -- Benefits
    discount_percentage NUMBER(5,2)     DEFAULT 0,
    early_access_hours  NUMBER(3)       DEFAULT 0,
    priority_booking    CHAR(1)         DEFAULT 'N' CHECK (priority_booking IN ('Y', 'N')),
    free_upgrades       CHAR(1)         DEFAULT 'N' CHECK (free_upgrades IN ('Y', 'N')),
    free_concession     CHAR(1)         DEFAULT 'N' CHECK (free_concession IN ('Y', 'N')),
    birthday_bonus      NUMBER(6)       DEFAULT 0,       -- Bonus points on birthday
    referral_bonus      NUMBER(6)       DEFAULT 0,       -- Bonus points per referral
    points_earn_rate    NUMBER(5,2)     DEFAULT 1,       -- Points per GHS spent
    
    -- Rewards
    free_tickets_per_year NUMBER(2)     DEFAULT 0,
    concession_vouchers_per_year NUMBER(2) DEFAULT 0,
    companion_tickets    NUMBER(2)      DEFAULT 0,
    
    -- Exclusive
    exclusive_events    CHAR(1)         DEFAULT 'N' CHECK (exclusive_events IN ('Y', 'N')),
    exclusive_screenings CHAR(1)        DEFAULT 'N' CHECK (exclusive_screenings IN ('Y', 'N')),
    
    -- Display
    tier_color          VARCHAR2(7),
    tier_icon           VARCHAR2(50),
    display_order       NUMBER(3),
    
    -- Status
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Insert default tiers
INSERT INTO membership_tiers (tier_id, tier_code, tier_name, points_required, annual_spend_required, visit_required, discount_percentage, points_earn_rate, display_order) VALUES(1, 'BRONZE', 'Bronze', 0, 0, 0, 0, 1.00, 1);
INSERT INTO membership_tiers (tier_id, tier_code, tier_name, points_required, annual_spend_required, visit_required, discount_percentage, points_earn_rate, display_order) VALUES(2, 'SILVER', 'Silver', 500, 500.00, 10, 5, 1.25, 2);
INSERT INTO membership_tiers (tier_id, tier_code, tier_name, points_required, annual_spend_required, visit_required, discount_percentage, points_earn_rate, display_order) VALUES(3, 'GOLD', 'Gold', 1500, 1500.00, 25, 10, 1.50, 3);
INSERT INTO membership_tiers (tier_id, tier_code, tier_name, points_required, annual_spend_required, visit_required, discount_percentage, points_earn_rate, display_order) VALUES(4, 'PLATINUM', 'Platinum', 3000, 3000.00, 50, 15, 2.00, 4);
INSERT INTO membership_tiers (tier_id, tier_code, tier_name, points_required, annual_spend_required, visit_required, discount_percentage, points_earn_rate, display_order) VALUES(5, 'DIAMOND', 'Diamond', 6000, 6000.00, 100, 20, 2.50, 5);

CREATE INDEX idx_tiers_points ON membership_tiers(points_required);

-- ============================================================
-- REWARD_RULES (Loyalty program rules)
-- ============================================================
CREATE TABLE reward_rules (
    rule_id             NUMBER(12)      PRIMARY KEY,
    rule_code           VARCHAR2(30)    UNIQUE NOT NULL,
    rule_name           VARCHAR2(100)   NOT NULL,
    rule_description    VARCHAR2(255),
    
    -- Rule type
    rule_type           VARCHAR2(30)    NOT NULL CHECK (rule_type IN ('POINTS_EARNING', 'POINTS_REDEMPTION', 'BONUS', 'TIER_CALCULATION', 'EXPIRATION', 'TRANSFER', 'OTHER')),
    
    -- Earning rates
    earn_rate_ticket    NUMBER(5,2)     DEFAULT 1,       -- Points per GHS on tickets
    earn_rate_concession NUMBER(5,2)    DEFAULT 1,       -- Points per GHS on concessions
    earn_rate_promotion NUMBER(5,2)     DEFAULT 1.5,     -- Points per GHS during promotions
    
    -- Redemption
    redemption_points_per_ghs NUMBER(5,2) DEFAULT 10,   -- Points needed for 1 GHS discount
    min_redemption_points NUMBER(6)      DEFAULT 100,
    max_redemption_per_booking NUMBER(6) DEFAULT 500,
    redemption_apply_to VARCHAR2(30)     CHECK (redemption_apply_to IN ('TICKET_ONLY', 'CONCESSION_ONLY', 'BOTH', 'ANY')),
    
    -- Bonus rules
    birthday_bonus_points NUMBER(6)      DEFAULT 50,
    birthday_bonus_days  NUMBER(3)      DEFAULT 7,       -- Days before/after birthday
    new_member_bonus    NUMBER(6)       DEFAULT 100,
    referral_bonus_points NUMBER(6)     DEFAULT 50,
    referral_required_visits NUMBER(3)  DEFAULT 1,
    
    -- Expiration
    points_expire_days  NUMBER(6)       DEFAULT 365,
    points_expire_end_of_month CHAR(1)  DEFAULT 'Y' CHECK (points_expire_end_of_month IN ('Y', 'N')),
    min_points_to_expire NUMBER(6)      DEFAULT 0,
    
    -- Tier calculation
    tier_calculation_period VARCHAR2(20) DEFAULT 'ANNUAL' CHECK (tier_calculation_period IN ('ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY', 'LIFETIME')),
    tier_review_date    DATE,
    tier_grace_period   NUMBER(3)       DEFAULT 30,      -- Days to maintain tier after qualification
    
    -- Transfer rules
    allow_point_transfer CHAR(1)        DEFAULT 'N' CHECK (allow_point_transfer IN ('Y', 'N')),
    transfer_fee_percent NUMBER(5,2)    DEFAULT 10,
    min_transfer_points NUMBER(6)       DEFAULT 100,
    max_transfer_points NUMBER(6)       DEFAULT 1000,
    
    -- Status
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    effective_from      DATE,
    effective_to        DATE,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Insert default rules
INSERT INTO reward_rules (rule_id, rule_code, rule_name, rule_type, earn_rate_ticket, earn_rate_concession, redemption_points_per_ghs, min_redemption_points, points_expire_days, tier_calculation_period) VALUES(1, 'STANDARD', 'Standard Loyalty Rules', 'POINTS_EARNING', 1.00, 1.00, 10, 100, 365, 'ANNUAL');

CREATE INDEX idx_rules_type ON reward_rules(rule_type);
CREATE INDEX idx_rules_active ON reward_rules(is_active) WHERE is_active = 'Y';

-- ============================================================
-- LOYALTY_TRANSACTIONS (Point earning and redemption)
-- ============================================================
CREATE TABLE loyalty_transactions (
    transaction_id      NUMBER(12)      PRIMARY KEY,
    transaction_guid    VARCHAR2(36)    UNIQUE,
    customer_id         NUMBER(12)      NOT NULL REFERENCES customers(customer_id),
    
    -- Transaction type
    transaction_type    VARCHAR2(30)    NOT NULL CHECK (transaction_type IN ('EARN_TICKET', 'EARN_CONCESSION', 'EARN_BONUS', 'EARN_PROMOTION', 'EARN_BIRTHDAY', 'EARN_REFERRAL', 'EARN_SURVEY', 'REDEEM_TICKET', 'REDEEM_CONCESSION', 'REDEEM_PROMOTION', 'REDEEM_MERCHANDISE', 'EXPIRATION', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT')),
    
    -- Points
    points_amount       NUMBER(10)      NOT NULL,
    points_balance_before NUMBER(10)    NOT NULL,
    points_balance_after NUMBER(10)     NOT NULL,
    
    -- Source
    source_type         VARCHAR2(50),                   -- 'BOOKING', 'SALE', 'PROMOTION', etc.
    source_id           NUMBER(12),                     -- FK to source table
    source_reference    VARCHAR2(50),
    
    -- Conversion
    transaction_value   NUMBER(10,2),                   -- Monetary value
    earn_rate_applied   NUMBER(5,2),
    
    -- Promotion
    promotion_id        NUMBER(12)      REFERENCES promotions(promotion_id),
    
    -- Expiration
    expiry_date         DATE,
    expired_at          DATE,
    expiration_reason   VARCHAR2(255),
    
    -- Status
    status              VARCHAR2(20)    DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PENDING', 'CANCELLED', 'EXPIRED', 'REVERSED')),
    
    -- Notes
    transaction_notes   VARCHAR2(255),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

CREATE INDEX idx_loyalty_customer ON loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_type ON loyalty_transactions(transaction_type);
CREATE INDEX idx_loyalty_date ON loyalty_transactions(created_date);
CREATE INDEX idx_loyalty_source ON loyalty_transactions(source_type, source_id);

-- ============================================================
-- EVENT_TYPES (Event categories and subcategories)
-- ============================================================
CREATE TABLE event_types (
    event_type_id       NUMBER(12)      PRIMARY KEY,
    type_code           VARCHAR2(20)    UNIQUE NOT NULL,
    type_name           VARCHAR2(50)    NOT NULL,
    type_description    VARCHAR2(255),
    
    -- Categorization
    category            VARCHAR2(30)    NOT NULL CHECK (category IN ('SPORTS', 'CONCERT', 'THEATRE', 'COMEDY', 'GAMING', 'LIVE_BROADCAST', 'CORPORATE', 'PRIVATE', 'FESTIVAL', 'OTHER')),
    subcategory         VARCHAR2(30),                   -- e.g., 'FOOTBALL', 'BASKETBALL', 'ROCK', 'JAZZ', 'STAND_UP', 'ESPORT'
    
    -- Default settings
    default_duration_minutes NUMBER(4)  DEFAULT 120,
    default_price        NUMBER(10,2)   DEFAULT 20.00,
    requires_screen      CHAR(1)        DEFAULT 'Y' CHECK (requires_screen IN ('Y', 'N')),
    requires_seating     CHAR(1)        DEFAULT 'Y' CHECK (requires_seating IN ('Y', 'N')),
    requires_booking     CHAR(1)        DEFAULT 'Y' CHECK (requires_booking IN ('Y', 'N')),
    allows_standby       CHAR(1)        DEFAULT 'N' CHECK (allows_standby IN ('Y', 'N')),
    
    -- Capacity
    max_capacity         NUMBER(6),
    min_capacity         NUMBER(6),
    
    -- Display
    icon_class          VARCHAR2(50),
    color_code          VARCHAR2(7),
    display_order       NUMBER(3),
    
    -- Status
    is_active           CHAR(1)         DEFAULT 'Y' CHECK (is_active IN ('Y', 'N')),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Insert default event types
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(1, 'FOOTBALL', 'Football Screening', 'SPORTS', 'FOOTBALL', 120, 25.00, 1, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(2, 'BASKETBALL', 'Basketball Screening', 'SPORTS', 'BASKETBALL', 150, 20.00, 2, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(3, 'BOXING', 'Boxing/MMA', 'SPORTS', 'BOXING', 180, 30.00, 3, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(4, 'CONCERT_ROCK', 'Rock Concert', 'CONCERT', 'ROCK', 180, 40.00, 4, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(5, 'CONCERT_JAZZ', 'Jazz Concert', 'CONCERT', 'JAZZ', 150, 35.00, 5, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(6, 'THEATRE', 'Theatre Performance', 'THEATRE', 'DRAMA', 120, 25.00, 6, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(7, 'COMEDY', 'Comedy Show', 'COMEDY', 'STAND_UP', 90, 20.00, 7, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(8, 'GAMING', 'Gaming Tournament', 'GAMING', 'ESPORT', 240, 15.00, 8, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(9, 'CORPORATE', 'Corporate Event', 'CORPORATE', NULL, 120, 0.00, 9, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(10, 'PRIVATE', 'Private Screening', 'PRIVATE', NULL, 120, 0.00, 10, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(11, 'COMEDY_IMPROV', 'Improv Comedy', 'COMEDY', 'IMPROV', 90, 18.00, 11, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(12, 'FESTIVAL', 'Film Festival', 'FESTIVAL', NULL, 180, 30.00, 12, 'Y');
INSERT INTO event_types (event_type_id, type_code, type_name, category, subcategory, default_duration_minutes, default_price, display_order, is_active) VALUES(13, 'LIVE_BROADCAST', 'Live Broadcast', 'LIVE_BROADCAST', NULL, 120, 20.00, 13, 'Y');

CREATE INDEX idx_event_types_category ON event_types(category);
CREATE INDEX idx_event_types_active ON event_types(is_active) WHERE is_active = 'Y';

-- ============================================================
-- EVENTS (Master event record)
-- ============================================================
CREATE TABLE events (
    event_id            NUMBER(12)      PRIMARY KEY,
    event_code          VARCHAR2(30)    UNIQUE NOT NULL,
    event_guid          VARCHAR2(36)    UNIQUE,
    
    -- Event details
    event_name          VARCHAR2(200)   NOT NULL,
    event_description   CLOB,
    event_type_id       NUMBER(12)      NOT NULL REFERENCES event_types(event_type_id),
    event_subtype       VARCHAR2(50),                   -- Free-form subtype
    
    -- Provider/Organizer
    organizer_name      VARCHAR2(100),
    organizer_contact   VARCHAR2(100),
    organizer_phone     VARCHAR2(20),
    organizer_email     VARCHAR2(100),
    
    -- Timing
    event_date          DATE            NOT NULL,
    start_time          TIMESTAMP       NOT NULL,
    end_time            TIMESTAMP       NOT NULL,
    duration_minutes    NUMBER(4)       GENERATED ALWAYS AS (
        EXTRACT(DAY FROM (end_time - start_time)) * 1440 +
        EXTRACT(HOUR FROM (end_time - start_time)) * 60 +
        EXTRACT(MINUTE FROM (end_time - start_time))
    ) VIRTUAL,
    
    -- Venue
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    screen_id           NUMBER(12)      REFERENCES screens(screen_id),  -- NULL if multiple screens or no screen
    capacity            NUMBER(6)       NOT NULL,       -- Total capacity
    available_seats     NUMBER(6)       NOT NULL,       -- Current availability
    reserved_seats      NUMBER(6)       DEFAULT 0,
    sold_seats          NUMBER(6)       DEFAULT 0,
    
    -- Pricing
    base_price          NUMBER(10,2)    NOT NULL,
    vip_price           NUMBER(10,2),
    discount_price      NUMBER(10,2),                   -- Group/early bird
    
    -- Content
    event_content       CLOB,                           -- Detailed content description
    event_poster_url    VARCHAR2(500),
    event_banner_url    VARCHAR2(500),
    event_video_url     VARCHAR2(500),
    content_warning     VARCHAR2(255),
    age_restriction     VARCHAR2(20),                   -- e.g., '18+', 'PG-13', 'ALL'
    
    -- Sports specific
    sport_league        VARCHAR2(50),                   -- e.g., 'PREMIER_LEAGUE', 'NBA', 'UFC'
    sport_team_home     VARCHAR2(50),
    sport_team_away     VARCHAR2(50),
    sport_competition   VARCHAR2(100),                  -- e.g., 'Champions League Final'
    is_live_broadcast   CHAR(1)         DEFAULT 'Y' CHECK (is_live_broadcast IN ('Y', 'N')),
    broadcast_source    VARCHAR2(100),                  -- e.g., 'DSTV', 'Canal+', 'Netflix'
    
    -- Concert specific
    artist_name         VARCHAR2(100),
    artist_genre        VARCHAR2(50),
    opening_act         VARCHAR2(100),
    tour_name           VARCHAR2(100),
    
    -- Theatre specific
    playwright          VARCHAR2(100),
    director_name       VARCHAR2(100),
    cast_members        CLOB,                           -- JSON array of cast
    
    -- Comedy specific
    comedian_names      CLOB,                           -- JSON array of comedians
    show_style          VARCHAR2(50),                   -- e.g., 'STAND_UP', 'IMPROV', 'SKETCH'
    
    -- Gaming specific
    game_title          VARCHAR2(100),
    game_platform       VARCHAR2(50),
    gamers              CLOB,                           -- JSON array of gamers
    
    -- Corporate specific
    corporate_client    VARCHAR2(100),
    corporate_event_type VARCHAR2(50),                  -- e.g., 'TEAM_BUILDING', 'ANNUAL_MEETING', 'PRODUCT_LAUNCH'
    
    -- Booking controls
    advance_booking_days NUMBER(3)      DEFAULT 14,
    booking_cutoff_minutes NUMBER(4)    DEFAULT 30,
    max_seats_per_booking NUMBER(3)     DEFAULT 10,
    allow_online_booking CHAR(1)        DEFAULT 'Y' CHECK (allow_online_booking IN ('Y', 'N')),
    allow_walkin        CHAR(1)         DEFAULT 'Y' CHECK (allow_walkin IN ('Y', 'N')),
    
    -- Marketing
    is_featured         CHAR(1)         DEFAULT 'N' CHECK (is_featured IN ('Y', 'N')),
    featured_order      NUMBER(3),
    marketing_notes     CLOB,
    
    -- Status
    event_status        VARCHAR2(20)    NOT NULL DEFAULT 'SCHEDULED' CHECK (event_status IN ('DRAFT', 'SCHEDULED', 'OPEN', 'SOLD_OUT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED')),
    cancellation_reason VARCHAR2(255),
    cancellation_date   DATE,
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    approved_by         VARCHAR2(30),
    approved_date       DATE,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_events_code ON events(event_code);
CREATE INDEX idx_events_type ON events(event_type_id);
CREATE INDEX idx_events_branch ON events(branch_id);
CREATE INDEX idx_events_screen ON events(screen_id) WHERE screen_id IS NOT NULL;
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_status ON events(event_status);
CREATE INDEX idx_events_featured ON events(is_featured) WHERE is_featured = 'Y';
CREATE INDEX idx_events_organizer ON events(organizer_name);
CREATE INDEX idx_events_league ON events(sport_league) WHERE sport_league IS NOT NULL;

-- Composite indexes
CREATE INDEX idx_events_branch_date ON events(branch_id, event_date);
CREATE INDEX idx_events_status_date ON events(event_status, event_date);
CREATE INDEX idx_events_type_date ON events(event_type_id, event_date);

-- ============================================================
-- EVENT_BOOKINGS (Reservations for events)
-- ============================================================
CREATE TABLE event_bookings (
    event_booking_id    NUMBER(12)      PRIMARY KEY,
    booking_reference   VARCHAR2(30)    UNIQUE NOT NULL,
    booking_guid        VARCHAR2(36)    UNIQUE,
    
    -- Links
    event_id            NUMBER(12)      NOT NULL REFERENCES events(event_id),
    customer_id         NUMBER(12)      NOT NULL REFERENCES customers(customer_id),
    branch_id           NUMBER(12)      NOT NULL REFERENCES branches(branch_id),
    
    -- Booking details
    booking_date        TIMESTAMP       NOT NULL,
    booking_channel     VARCHAR2(30)    NOT NULL CHECK (booking_channel IN ('ONLINE', 'MOBILE_APP', 'BOX_OFFICE', 'KIOSK', 'CALL_CENTER', 'THIRD_PARTY', 'WALK_IN')),
    booking_source      VARCHAR2(50),
    session_id          VARCHAR2(100),
    ip_address          VARCHAR2(45),
    user_agent          VARCHAR2(255),
    
    -- Seat counts
    total_seats         NUMBER(3)       NOT NULL,
    total_tickets       NUMBER(3)       NOT NULL,
    
    -- Financials
    subtotal            NUMBER(10,2)    NOT NULL,
    discount_total      NUMBER(10,2)    DEFAULT 0,
    tax_total           NUMBER(10,2)    DEFAULT 0,
    service_fee         NUMBER(10,2)    DEFAULT 0,
    total_amount        NUMBER(10,2)    NOT NULL,
    amount_paid         NUMBER(10,2)    DEFAULT 0,
    amount_refunded     NUMBER(10,2)    DEFAULT 0,
    balance_due         NUMBER(10,2)    GENERATED ALWAYS AS (total_amount - amount_paid + amount_refunded) VIRTUAL,
    
    -- Promotions
    promotion_id        NUMBER(12)      REFERENCES promotions(promotion_id),
    promotion_code      VARCHAR2(30),
    discount_details    CLOB,
    
    -- Payment
    payment_status      VARCHAR2(20)    DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED', 'VOID')),
    payment_method      VARCHAR2(30)    CHECK (payment_method IN ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'GIFT_CARD', 'VOUCHER', 'LOYALTY_POINTS', 'BANK_TRANSFER')),
    payment_transaction_id VARCHAR2(100),
    payment_date        TIMESTAMP,
    
    -- Loyalty
    loyalty_points_used NUMBER(6)       DEFAULT 0,
    loyalty_points_earned NUMBER(6)     DEFAULT 0,
    
    -- Customer details
    customer_name       VARCHAR2(100),
    customer_email      VARCHAR2(100),
    customer_phone      VARCHAR2(20),
    
    -- Status
    booking_status      VARCHAR2(20)    NOT NULL CHECK (booking_status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'NO_SHOW')),
    status_date         TIMESTAMP       DEFAULT SYSTIMESTAMP,
    status_changed_by   VARCHAR2(30),
    
    -- Timestamps
    confirmed_date      TIMESTAMP,
    check_in_date       TIMESTAMP,
    completed_date      TIMESTAMP,
    cancelled_date      TIMESTAMP,
    cancellation_reason VARCHAR2(255),
    
    -- Communication
    confirmation_sent   CHAR(1)         DEFAULT 'N' CHECK (confirmation_sent IN ('Y', 'N')),
    confirmation_date   TIMESTAMP,
    reminder_sent       CHAR(1)         DEFAULT 'N' CHECK (reminder_sent IN ('Y', 'N')),
    reminder_date       TIMESTAMP,
    
    -- Notes
    special_instructions CLOB,
    internal_notes      CLOB,
    
    -- Version
    version_number      NUMBER(3)       DEFAULT 1,
    parent_booking_id   NUMBER(12)      REFERENCES event_bookings(event_booking_id),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_event_booking_reference ON event_bookings(booking_reference);
CREATE INDEX idx_event_booking_event ON event_bookings(event_id);
CREATE INDEX idx_event_booking_customer ON event_bookings(customer_id);
CREATE INDEX idx_event_booking_branch ON event_bookings(branch_id);
CREATE INDEX idx_event_booking_status ON event_bookings(booking_status);
CREATE INDEX idx_event_booking_date ON event_bookings(booking_date);
CREATE INDEX idx_event_booking_payment ON event_bookings(payment_status);

-- ============================================================
-- EVENT_TICKETS (Individual tickets for event bookings)
-- ============================================================
CREATE TABLE event_tickets (
    event_ticket_id     NUMBER(12)      PRIMARY KEY,
    ticket_number       VARCHAR2(30)    UNIQUE NOT NULL,
    event_booking_id    NUMBER(12)      NOT NULL REFERENCES event_bookings(event_booking_id),
    event_id            NUMBER(12)      NOT NULL REFERENCES events(event_id),
    
    -- Seat details
    seat_id             NUMBER(12)      REFERENCES seats(seat_id),
    seat_label          VARCHAR2(20),                   -- e.g., 'A12'
    row_letter          VARCHAR2(2),
    seat_number         VARCHAR2(10),
    seat_type           VARCHAR2(20)    CHECK (seat_type IN ('STANDARD', 'PREMIUM', 'VIP', 'ACCESSIBLE')),
    
    -- Ticket details
    ticket_type         VARCHAR2(30)    NOT NULL CHECK (ticket_type IN ('STANDARD', 'VIP', 'STUDENT', 'SENIOR', 'CHILD', 'COMP', 'STAFF', 'EARLY_BIRD')),
    ticket_price        NUMBER(10,2)    NOT NULL,
    discount_amount     NUMBER(10,2)    DEFAULT 0,
    tax_amount          NUMBER(10,2)    DEFAULT 0,
    total_price         NUMBER(10,2)    GENERATED ALWAYS AS (ticket_price - discount_amount + tax_amount) VIRTUAL,
    
    -- Attendee
    attendee_name       VARCHAR2(100),
    attendee_email      VARCHAR2(100),
    attendee_phone      VARCHAR2(20),
    attendee_age_group  VARCHAR2(20),
    special_requests    VARCHAR2(255),
    
    -- QR/Barcode
    barcode_data        VARCHAR2(100)   UNIQUE,
    qr_code_data        VARCHAR2(500),
    qr_code_url         VARCHAR2(500),
    
    -- Usage
    issued_date         TIMESTAMP       DEFAULT SYSTIMESTAMP,
    used_date           TIMESTAMP,
    used_at             TIMESTAMP,
    used_by             VARCHAR2(30),
    entry_gate          VARCHAR2(20),
    is_used             CHAR(1)         DEFAULT 'N' CHECK (is_used IN ('Y', 'N')),
    
    -- Status
    ticket_status       VARCHAR2(20)    DEFAULT 'ISSUED' CHECK (ticket_status IN ('ISSUED', 'PRINTED', 'USED', 'REFUNDED', 'CANCELLED', 'EXPIRED', 'EXCHANGED')),
    status_date         TIMESTAMP       DEFAULT SYSTIMESTAMP,
    
    -- Delivery
    delivery_method     VARCHAR2(30)    CHECK (delivery_method IN ('PRINT_AT_HOME', 'MOBILE', 'BOX_OFFICE', 'EMAIL', 'SMS')),
    delivery_address    VARCHAR2(255),
    
    -- Notes
    ticket_notes        VARCHAR2(255),
    
    -- Audit
    created_date        DATE            DEFAULT SYSDATE,
    created_by          VARCHAR2(30)    DEFAULT USER,
    last_modified_date  DATE            DEFAULT SYSDATE,
    last_modified_by    VARCHAR2(30)    DEFAULT USER
);

-- Indexes
CREATE INDEX idx_event_ticket_number ON event_tickets(ticket_number);
CREATE INDEX idx_event_ticket_booking ON event_tickets(event_booking_id);
CREATE INDEX idx_event_ticket_event ON event_tickets(event_id);
CREATE INDEX idx_event_ticket_seat ON event_tickets(seat_id) WHERE seat_id IS NOT NULL;
CREATE INDEX idx_event_ticket_status ON event_tickets(ticket_status);
CREATE INDEX idx_event_ticket_used ON event_tickets(used_date) WHERE used_date IS NOT NULL;
CREATE INDEX idx_event_ticket_barcode ON event_tickets(barcode_data) WHERE barcode_data IS NOT NULL;