# Savannah Cinemas — mobile app

The iOS and Android app for Savannah Cinemas, built with Expo (SDK 58) and
Expo Router. It talks to the existing Express + PostgreSQL backend in
`../backend` — no separate server.

Design direction: **Harmattan Marquee**. Warm projection-room dark, bone
paper for anything you show at the door, and one earth-red light
(laterite) for the main action, your selection and "now". Big Shoulders
Display for titles, Hanken Grotesk for reading, JetBrains Mono for times,
seats, money and references.

## Run it

1. Bring the database up to date, then start the backend:

   ```sh
   cd ../backend
   npm run db:migrate     # applies anything new in ../Development/migrations
   npm start              # port 5000
   ```

   `db:migrate` remembers what it has applied (table
   `schema_migrations`), so run it whenever you pull new changes; it does
   nothing if you're up to date. `npm run db:status` lists applied and
   pending files. If something is missing, the server warns at start-up
   and names the files. Set `DB_AUTO_MIGRATE=true` in `backend/.env` to
   have the server apply them itself.
2. In this folder:

   ```sh
   npm install
   npx expo start
   ```

3. Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).
   Your phone and computer must be on the same Wi-Fi. The app finds the
   backend automatically at `http://<your computer's IP>:5000/api`.
   On Windows, allow Node through the firewall the first time.

Other targets: `npm run android` (emulator), `npm run web` (browser).

To point at a different server, copy `.env.example` to `.env` and set
`EXPO_PUBLIC_API_URL`.

## What's in it

Opening: a title card (SAVANNAH wipes in, laterite rule draws, then it
lifts away) plays once per launch. Tap to skip; reduce-motion makes it a
short still card. Bottom bar: **Tonight · Films · Concessions · Account**.

| Screen | Route | Backend |
| --- | --- | --- |
| Tonight: the programme by date, the next show first, every time one tap from seats | `src/app/(tabs)/index.tsx` | `GET /showtimes`, `GET /movies`, `GET /showtimes/:id/seats` |
| Films: now showing, coming soon, watchlist, search | `src/app/(tabs)/films.tsx` | `/movies/now-showing`, `/movies/upcoming`, `/movies/search`, `/watchlist` |
| Events: events (weekly and one-off), opening days, live offers with Use code | `src/app/(tabs)/events.tsx` | `GET /events`, `GET /movies/upcoming`, `GET /promotions` |
| Account: Tickets tab (coming up, history) and Settings tab (profile, password, notifications, help, delete) | `src/app/(tabs)/account.tsx`, `src/app/settings/*` | `/auth/me`, `GET /bookings`, `/users/me/*` |
| Film detail: backdrop, trailer (plays in an in-app modal), cast, showtimes by day and screen | `src/app/film/[id].tsx` | `/movies/:id/details`, `/movies/:id/showtimes`, `/watchlist` |
| Booking 1/3 Seats: the real hall plan, live availability, per-seat pricing, promo code | `src/app/seats/[showtimeId].tsx` | `/showtimes/:id/seats`, `/pricing/showtime/:id`, `POST /bookings` |
| Booking 2/3 Snacks (optional): added to the same payment; back releases the seats | `src/app/snacks/[bookingId].tsx` | `GET /concessions`, `PUT /concessions/bookings/:id` |
| Booking 3/3 Pay: tickets + snacks, 15-minute hold countdown, Mobile Money or card | `src/app/checkout/[bookingId].tsx` | `GET /bookings/:id`, `GET /concessions/bookings/:id`, `POST /payments` |
| Ticket: paper stub with QR, snacks and their codes, email again, directions to Accra Mall, cancel | `src/app/ticket/[bookingId].tsx` | `GET /bookings/:id`, `GET /concessions/bookings/:id`, `POST /bookings/:id/email`, `PATCH /bookings/:id/cancel` |
| Snack order: items and the collection code + QR for the kiosk | `src/app/order/[orderId].tsx` | `GET /concessions/orders` |
| Watchlist: saved films with each one's next show, book or remove | `src/app/watchlist.tsx` | `/watchlist`, `GET /showtimes`, `GET /movies` |
| Sign in / create account | `src/app/sign-in.tsx` | `/auth/login`, `/auth/register` |

Every data screen has loading, empty, error/offline and retry states.
Missing artwork falls back to a typeset title card, never a stock image.
Touch targets are at least 44 pt; screen-reader labels are on every
seat, time and control; the OS "reduce motion" setting is respected.

Code layout: `src/theme.ts` (tokens), `src/lib` (API client, auth,
formatting, data hooks), `src/components` (type, controls, artwork,
seat map, states).

## Backend changes made for the app (Nov 2026)

All are backwards-compatible with the website.

1. **Seat map ignored hold expiry** (`showtimeController.getShowtimeSeats`).
   Unpaid bookings blocked their seats forever on the seat map, even
   after the 15-minute hold expired. It now uses the same rule as
   `createBooking`.
2. **Ticket on booking detail** (`bookingController.getBookingById`).
   The response now includes `ticket: { ticketCode, qrCodeData, status }`
   (or `null` before payment), so the Tickets tab can show the QR code
   at any time, not only right after paying.
3. Migration `Development/migrations/2026-11-16_booking_expiry.sql`
   adds `bookings.expires_at` if your database doesn't have it yet
   (the update script never created it, but `createBooking` writes it).
4. **Released seats can be booked again.** The unique
   `(showtime_id, seat_id)` constraint on `booking_seats` meant a seat
   from a cancelled or expired booking could never be sold again (the
   insert failed with "just booked by another customer"). Migration
   `2026-11-17_concessions.sql` replaces it with a plain index, and
   `createBooking` now takes a per-showtime advisory lock so two people
   still can't book the same seat at once.
5. **Concessions.** New tables `concession_items` (seeded with the
   website's menu and prices), `concession_orders`,
   `concession_order_items`; new `controllers/concessionController.js`
   and `routes/concessionRoutes.js` at `/api/concessions`; website images
   served at `/images`. Snacks added during booking go into
   `bookings.total_amount`, so the existing payment charges them. Their
   status follows the booking. Pre-orders for paid tickets are separate
   orders. Cancelling a booking cancels its snack orders.

## Showtimes (generated)

The backend can programme the next two weeks for you
(`backend/services/showtimeScheduler.js`):

```sh
cd ../backend
npm run showtimes:preview      # print the plan, save nothing
npm run showtimes:generate     # create today + 13 days
npm run showtimes:generate -- --days 21
```

Or keep it rolling automatically: add `SHOWTIME_AUTOGEN=true` to
`backend/.env` and the server fills any empty days on start-up and every
6 hours. Admins/managers can also call `POST /api/showtimes/generate`
(`{ "days": 14, "dryRun": true }`).

How it programmes: 10:30 first show (10:00 at weekends), last start
22:30, runtime + 25 min between shows on a screen, screens staggered by
10 min. Each day has two headliners (strongest by rating and recency,
first call on prime time) and a rotation of the rest, picked by who's
gone longest without a screening, so the whole catalogue gets time
across the fortnight. **Each film plays on two or three screens a day**
(headliners three, the rest two or three, varying by film and day), at
times at least an hour apart and not twice on one screen while another
is free. All screens are filled together through the day, earliest free
slot first. R/18 films start after 17:00. Base prices come from
`ticket_prices`.

Existing showtimes are never changed: new shows are fitted into the free
time around them. To re-plan the fortnight (after adding screens or
films), `npm run showtimes:rebuild` deletes future showtimes **that have
no bookings** and programmes again; booked shows always stay.

`2026-11-19_screens_and_location.sql` adds Screens 3 and 4 (with seat
plans) and gives Screen 2 (VIP) the seats it was missing, so films have
four screens to spread across. Run `npm run db:migrate`, then
`npm run showtimes:rebuild`.
Each day only includes films whose run covers it (see below), so a
coming-soon film gets shows from its opening day, which puts it on sale
in advance, and a film stops being programmed after its last day.

## Film status (run length)

Status used to come from the release *year* (anything released this
calendar year was "now showing"). It now follows how long a film has
been out. Run `Development/migrations/2026-11-17_movie_run_status.sql`
once; fresh installs get it from the main SQL script.

- **UPCOMING** until its release date, **NOW_SHOWING** from the release
  date for the run length (12 weeks by default), then **ENDED**.
  **ARCHIVED** is only set by hand and is never changed automatically.
- The backend moves films along at start-up and every hour
  (`services/movieStatus.js`), and again before generating showtimes.
- Admins/managers can change the run length for every film, or set a
  last day for one film (to extend a hit or pull a flop):

```http
GET   /api/movies/run-length
PUT   /api/movies/run-length     { "weeks": 10 }
PATCH /api/movies/42/run         { "runEndsOn": "2027-01-31" }   # null = back to default
```

In SQL: `UPDATE app_settings SET setting_value = '10' WHERE setting_key =
'movie_run_weeks'; SELECT refresh_movie_statuses();` or
`UPDATE movies SET run_ends_on = '2027-01-31' WHERE movie_id = 42;`.

The app shows the opening date on Coming posters and on the film page
("OPENS FRI 20 NOV"). Its showtimes are listed as soon as any exist.

## Account and settings

Account has Edit profile (names, phone, date of birth), Password,
Notifications, Help & contact, Sign out and Delete account. On a phone
there's also a Haptics switch; that and the Films layout (Wall / Grid /
Index) are remembered on the device.

Backend changes for this (`controllers/userController.js`,
`routes/userRoutes.js`):

- `PATCH /api/users/me` also takes `dateOfBirth` (`YYYY-MM-DD` or `null`),
  stored on `customer_profiles`.
- New `DELETE /api/users/me { password }`. Apple and Google require
  in-app account deletion for apps with sign-up. It's refused (409) while
  the user has paid tickets for shows still to come. Otherwise it releases
  unpaid holds, deletes watchlist/preferences/favourites/reviews, and
  anonymises the user row (`deleted-<id>@deleted.invalid`, locked
  password, `is_active = 'N'`). Bookings and payments stay as anonymous
  sales records. The same email can register again.

Changing the sign-in email isn't supported by the backend yet, so the app
shows it read-only.

## Film catalogue (TMDB sync)

`backend/services/catalogSync.js` pulls TMDB's **now playing** and
**upcoming** lists and adds or updates each film: synopsis, release date,
runtime, poster, backdrop, trailer, rating, age rating (Ghana, then US,
then UK certificate), genres, and cast/crew/studio through the existing
enrichment. It uses the `TMDB_API_KEY` already in `backend/.env`.

```sh
cd backend
npm run movies:preview                 # what would change (saves nothing)
npm run movies:sync                    # 2 pages of each list (~40 + ~40 films)
npm run movies:sync -- --pages 3       # more
npm run movies:sync -- --region GH     # TMDB's Ghana lists and Ghana opening dates
npm run showtimes:generate             # then programme the new films
```

Or `POST /api/movies/tmdb/sync` (admin/manager), or add
`TMDB_AUTOSYNC=true` to `.env` for a daily sync on the server
(`TMDB_REGION=GH` to make Ghana the default region).

- Films are skipped if they're adult, or have no poster or release date.
- Status still follows the run-length rule. A film TMDB lists as now
  playing whose standard run would already be over (it reached Ghana
  late) gets `run_ends_on` pushed to four weeks from today, so it shows
  on Now Showing. Runs are only ever extended.
- Existing films are updated, never duplicated (matched on `tmdb_id`).
  Missing TMDB fields don't wipe what you have. **Archive** a film
  (`status = 'ARCHIVED'`) to stop the sync touching it.

## Booking flow and confirmation emails

Seats → snacks (optional) → pay (simulated) → ticket. At checkout the
customer confirms where to send their tickets (it starts as their
account email and can be changed). Once paid, the server emails a
confirmation with the QR ticket, seats, snacks with their collection
code, and a receipt. The ticket screen shows where it went and has
**Send again** (any address, at most once a minute).

Backend changes:

- `utils/emailService.js`: new template; the QR is an inline attachment
  (Gmail strips the `data:` images the old one used); plain-text
  version; snacks included. Still uses `GMAIL_USER` +
  `GMAIL_APP_PASSWORD`, or any SMTP server if `SMTP_HOST` is set
  (`SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`).
- `services/bookingEmail.js`: builds the email from the database, so
  payment and resend send the same thing.
- `paymentController.js`: takes `receiptEmail`, sends after the payment
  commits and returns `email: { to, sent }`. If mail is slow it answers
  after 12 seconds and the email still goes.
- `bookingController.js`: removed the email sent when a booking was
  *created*. It said "Booking Confirmed" before payment and never
  actually went anywhere (it passed `email:` where the function expects
  `to:`). Added `POST /api/bookings/:id/email { to? }`. `GET /bookings`
  now includes the payment (method, reference, date) and where/when the
  confirmation was sent.
- Run `Development/migrations/2026-11-18_booking_receipts.sql` so
  bookings remember the receipt address and send time (everything works
  without it, it just won't remember).

Account → Tickets has **Coming up** and **History** tabs. History lists
every past, cancelled and unpaid booking by month, with reference,
payment method, amount and status. Filter by Paid / Cancelled / Not paid.
It also shows totals for bookings, seats and amount spent. Tap any booking
to see its full receipt.

## Events tab

Concessions is no longer a tab; snacks are still offered while booking
(step 2) and shown on the ticket. The **Events** tab has:

- **Coming up**: rows from the new `cinema_events` table
  (`GET /api/events`). An event is one-off (`starts_at`) or weekly
  (`weekday` 1–7 + `start_time`), and can link to a film (`movie_id`).
  The migration adds two **sample** events ("Family Saturday Mornings",
  "Late Night Thrillers"); edit, deactivate or delete them.
- **Opening soon**: upcoming films with their opening day.
- **Offers**: your live `promotions`. **Use code** opens Films, and the
  code is already filled in when the customer picks seats. Offers
  without a code (e.g. Group Movie Night) show a note, because booking
  only applies promotions by code.

## Location

The Accra cinema's address is set to Accra Mall, Plot C11, Tetteh
Quarshie Interchange, Spintex Road (in the same migration).
**Directions** on a ticket and in Help opens Google Maps with a route
there (`src/lib/directions.ts`).

## Savannah Rewards and Trophies

Account now has five tabs (**Tickets · Watchlist · Trophies · Rewards ·
Settings**) and a strip under the name with trophies, points, films and
the current weekly streak. Run `npm run db:migrate` for
`2026-11-20_rewards.sql`.

**Points** (`backend/services/rewards.js`) are worked out from the
member's history each time, not kept as a running total, so they can't
drift: cancelling a booking removes the points it earned and gives back
any points spent on it.

| | Points |
|---|---|
| Create account | 100 |
| Join with a friend's code (welcome bonus) | 100 |
| Complete profile (names, phone, date of birth) | 50 |
| Each ticket / each snack | 10 / 5 |
| Each review (from `movie_reviews`) | 50 |
| First booking | 100 |
| A friend you referred makes their first booking | 250 |
| Birthday booking (show within 3 days of the birthday, once a year) | 300 |
| 3 / 5 films in a calendar month | 250 / 500 |

Spending: **100 points = GHS 2**, in steps of 100, up to half a booking
(`REWARDS_GHS_PER_100` in `.env` changes the rate). Checkout shows a
"Use N points" switch; the server spends them inside the payment
transaction with a per-member lock, so two payments can't spend the
same points. The discount is on the receipt email and the ticket.

**Referrals**: everyone gets a code (Rewards tab, with an Invite button).
A new member can enter a friend's code at sign-up, or in Rewards before
their first booking.

**Trophies**: 35 in seven groups. They're checked after every payment
and when Rewards is opened, and **kept once earned**. A screening counts
once the booking is paid.

- Milestones: 1, 5, 10, 25, 50, 100 films.
- Genres: 10 action / comedy / horror / romance / sci-fi /
  mystery-thriller films. Genre Collector means 5 in each of those plus
  drama and animation.
- Collections: Marvel and DC (5 different films; matched on studio,
  TMDB collection or title). Franchise Fan means 3 films from one TMDB
  collection; the TMDB sync now stores collections, production
  countries and language.
- Habits: Weekend Warrior (3 weekends in a row), Night Owl (10 from
  18:00), Early Bird (10 from 12:00 to 17:00), Cinema Streak (4 weeks in
  a row), Monthly Regular (6 months in a row).
- Social: Movie Buddy (5 screenings with a friend) and Dynamic Duo (3
  with the same friend). "Friend" means someone linked by a referral,
  and "with" means you both have a paid booking for the same showtime.
  Group Screening (4+ seats in one booking) and The Connector (5
  referred friends who booked).
- Challenges: Horror Hunter (3 horror films in October), Cinema Cupid
  (2 seats in 7 to 14 February), Santa's Little Helper (2 family films
  in 1 to 26 December), **Easter Egg Hunter** (a film from Good Friday
  to Easter Monday; your list didn't name it, so this is a
  placeholder), Made in Ghana (2 Ghanaian films in March, Ghana Month;
  Ghanaian means production country GH or Twi/Akan/Ewe/Ga).
- Hidden (shown as "?" until earned): After Hours (last screening of
  the day ×5), Last Man Standing (×10), Marathoner (3 films in a day),
  First in Line (first screening ×5), Explorer (every screen).

API: `GET /api/rewards/me`, `GET /api/rewards/quote?bookingId=`,
`POST /api/rewards/referral {code}`, `POST /api/rewards/seen`;
`POST /payments` takes `redeemPoints: true` and returns `rewards`.

## Notifications and reminders

**After pulling this update:** run `npm install` in `mobile` (adds
`expo-notifications`) and `npm run db:migrate` in `backend` (adds
`user_notifications` and `film_reminders`). The app only uses *local*
notifications (scheduled on the phone, no push server), and those work
in Expo Go on Android and iPhone, so no rebuild is needed to try them.
The web build skips device alerts but still shows the in-app inbox.

- **Inbox.** The bell at the top right of Account opens `/notifications`,
  with a badge for unread items. The server writes the inbox every
  5 minutes (`services/notifications.js`):
  - "Today at 12:40": 3 hours before a paid booking;
  - "Starting in 30 minutes";
  - "Tickets are on sale" for a reminded film once it has shows;
  - "Opens today" on release day for a reminded film;
  - "New trophy".
  The Settings › Notifications switches "Show reminders" and "Opening days" turn these
  off. The app checks every minute and when it comes back to the
  foreground, and shows new items as a banner at the top.
- **Phone alerts.** After a payment the app asks once for permission and
  schedules local notifications at −3 h and −30 min for every upcoming
  booking, plus 9:00 on opening day for reminded films. These work with
  the phone offline. They are rescheduled after sign-in, payment,
  cancellation and reminder changes.
- **Reminder bells** on coming-soon films: on the Films › Coming shelf in
  every layout, on Events › Opening soon, and on the film page (in the
  header, plus a "Remind me" button while nothing is on sale).

API: `GET /api/notifications`, `POST /api/notifications/read {ids?}`,
`GET /api/notifications/reminders`,
`PUT|DELETE /api/notifications/reminders/:movieId`.

## Film page cast, seat zoom, trophy icons

- **Cast photos.** The film page shows a scrollable row of portraits,
  names and roles, with the director. Films imported before enrichment
  get their cast from TMDB the first time someone opens them; if TMDB
  fails, it is retried at most every 6 hours per film. Missing photos
  show initials.
- **Seat zoom.** The seat map now fits the whole hall on screen. Pinch
  (or use − / +) to zoom up to 3×, drag to move around, and tap
  "2.0× · FIT" to zoom back out. Seat numbers appear once seats are big
  enough to read.
- **Trophy icons.** Each trophy has its own pictogram
  (`components/trophy-icons.tsx`): a Ghana flag for Made in Ghana, an
  owl for Night Owl, a pumpkin, heart and arrow, gift, egg, crown, film
  reel, flame, compass and so on. The Marvel and DC trophies use
  original icons (a comic "POW" burst and a hero mask) instead of the
  studios' logos, which are trademarks that need a licence to use.

## Two locations, welcome slides, profile looks

**After pulling this update:** run `npm run db:migrate` in `backend`
(adds West Hills Mall and the username/avatar/backdrop columns), then
`npm run showtimes:generate` so West Hills gets its own programme.
Everything works with a reload in Expo Go. The new app icon and splash
screen only appear in a build of the app itself (Expo Go shows its own);
see "Building on Windows" below.

- **Locations.** Tonight's masthead reads "Savannah Cinemas" with the
  location underneath ("📍 ACCRA MALL ▾"). Tap it to switch to West Hills
  Mall. The choice is remembered on the device and decides the shows on
  Tonight, the film page (which has the same picker by "Showtimes"), the
  Films › Index view and the Events list. If a film isn't on at your
  location, its page says where it is playing, with a button to switch.
  - The migration `2026-11-22_west_hills.sql` renames the Accra cinema
    "Savannah Cinemas - Accra Mall" and adds "Savannah Cinemas - West
    Hills Mall" (Dunkonah, Weija) with Screens 1-3 and seat plans, copies
    Accra Mall's ticket prices, and copies the sample weekly events.
    **The West Hills phone number and email are placeholders.** Edit
    them in the `cinemas` table.
  - The showtime generator now plans each cinema on its own, so every
    building gets its films on two or three of its own screens.
- **Logo and launch.** A new mark (a laterite sun setting behind an
  acacia on a bone horizon) is the app icon, Android adaptive and
  monochrome icons, favicon and splash screen. In the app, the sun
  rises, the tree appears and "SAVANNAH CINEMAS" settles in underneath.
  Tap to skip.
- **Welcome slides.** On first open, a signed-out user sees five slides:
  welcome, booking seats, snacks, rewards and trophies, then tickets and
  reminders. They end with Create account / Sign in, or "Look around
  first". Each device only sees them once (`savannah.welcomed`).
- **Username, avatar, backdrop.** Every account has a username (shown as
  @name). New accounts get a generated one, such as VelvetCritic27.
  Straight after sign-up, "Make it yours" lets the user:
  - keep the username, type their own (checked live: 3-20 letters,
    numbers, dots or underscores; not taken or reserved), or roll the
    dice for another;
  - pick one of 12 avatars (lion, elephant, giraffe, zebra, owl,
    cheetah, hippo, monkey, popcorn, clapperboard, 3D glasses, film reel);
  - pick a profile backdrop from stills of films now showing or coming
    soon.
  The Account header shows the backdrop, avatar and @username. Change
  them any time from Edit profile › Profile look. Existing accounts got
  a username from their first name and user id (e.g. `ama_12`).

API: `GET /api/profile/username/check?u=`,
`GET /api/profile/username/suggest?name=`, `GET /api/profile/backdrops`,
`GET|PATCH /api/profile/me {username?, avatar?, backdropMovieId?}`.
`/auth/login`, `/auth/register` and `/auth/me` now include `username`,
`avatar` and `backdrop`.

## Special nights, bigger snack menu, backdrops from the whole catalogue

**After pulling this update:** in `backend` run `npm run db:migrate`
(adds special nights and snack upgrades), then `npm run
showtimes:generate` to programme the first special nights.

- **Special nights: older films come back.** Two programmes to start
  (table `special_programmes`):
  - **Throwback Thursday**, Thursdays 19:30, 30% off every seat;
    prefers films at least 2 years old.
  - **Bargain Tuesday**, Tuesdays 13:00 and 18:00, half price.

  Films come from the catalogue: any film whose run has ENDED and that
  hasn't been a special in the last 8 weeks, higher-rated first. Both
  cinemas show the same film that night, on their biggest standard
  screen. The generator programmes specials first and fits the regular
  shows around them. Unbooked regular shows in the way are moved; a
  show with bookings is never touched.

  The discount is applied to every seat type at booking, and shown on
  the seat map ("THROWBACK THURSDAY · 30% OFF EVERY SEAT"), on Tonight,
  on the film page and on the Events tab's new **Special nights** cards
  (this week's film, times and prices, plus the next few).

  To change a night, edit its row (weekday 1 = Monday ... 7 = Sunday,
  `start_times` like `19:30` or `13:00,18:00`, `discount_percent`,
  `min_age_years`). Add a row for a new programme, or set
  `is_active = 'N'` to pause one. API: `GET /api/specials`.
- **Snacks.** 15 new items: Red Bull, bottled water, sobolo, pineapple
  juice, nachos, hot dog, kelewele, chicken wings, meat pie, chin chin,
  chocolate, ice cream, and three combos (Solo, Date Night, Family
  Feast). **All prices are placeholders: set the real ones.**
  - Upgrades (table `concession_options`): every popcorn has Regular /
    Large (+6) / Sharing bucket (+14), plus extra butter, caramel
    drizzle or cheese dust. Nachos, hot dogs, kelewele and wings have
    extras such as shito, cheese and groundnuts. Ice cream has a
    flavour. Combos choose their popcorn flavour and drink.
  - In the app, items with upgrades open a sheet (one choice per size /
    flavour / drink, any extras, quantity). Each combination is its own
    line in the basket, and receipts show it, e.g.
    "Butter Popcorn (Large · Extra butter)".
  - Photos: until a photo exists at an item's `image_path`, the app
    draws an illustration of the snack.
- **Profile backdrops** can be a still from any film in the catalogue,
  not only what's showing, with a search box.

## Not done yet

- **Writing reviews in the app.** Reviews earn 50 points, but only the
  website can post them for now.
- **Real payments.** `paymentController.js` simulates the charge
  (`mockTransactionReference`). Connect Paystack, Hubtel or similar, then
  set `EXPO_PUBLIC_PAYMENTS_LIVE=true` to remove the Test mode notice.
- **Ticket types.** Price follows seat type only (Standard → Adult rate,
  VIP → VIP rate). Child/Student prices exist in `ticket_prices`, but
  `POST /bookings` can't accept a ticket type per seat yet.
- **Snack pre-order payments** are simulated like ticket payments
  (`MOCK-SNK-` references), and kiosk staff need a way to mark orders
  collected (`concession_orders.collected_at` is ready for it).
- **Menu admin.** Items and prices live in `concession_items`; edit them
  in SQL for now (Red Bull has an image but no price, so it's left out).
- **Hosting.** For store builds the backend needs a public HTTPS address
  (`EXPO_PUBLIC_API_URL`). Plain `http://` to a LAN IP is only for
  development; Android release builds allow it via `expo-build-properties`,
  iOS only for local-network addresses.
- Store builds: see "Building on Windows" below.

## Building on Windows

`npx expo run:ios` needs a Mac (Xcode), so on Windows:

- **Day to day, both phones:** `npx expo start` and open the app in
  **Expo Go** (scan the QR code with Expo Go on Android, or the Camera
  app on iPhone). Everything in this app runs there, including the
  reminders. Only the app icon and splash screen are Expo Go's own.
- **Android build on your PC:** install Android Studio (with an emulator,
  or a phone with USB debugging on), then `npx expo run:android`.
- **iPhone build without a Mac:** EAS Build compiles it in the cloud.
  `npm i -g eas-cli`, `eas login`, `eas build:configure` once, then
  `eas build -p ios --profile development` (or `--profile preview`).
  Installing on a real iPhone needs a paid Apple Developer account
  ($99/year); register the phone first with `eas device:create`.
  `eas build -p android --profile preview` gives an installable APK the
  same way.
- **Store releases:** `eas build -p android` / `eas build -p ios`, then
  `eas submit`.
