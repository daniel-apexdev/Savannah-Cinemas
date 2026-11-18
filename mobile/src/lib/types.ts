/**
 * Shapes returned by the existing Savannah Cinemas Express API.
 * Numeric DB columns (NUMERIC) arrive as strings from `pg`, so money
 * and ratings are typed `number | string` and normalised in format.ts.
 */

export type Num = number | string;

export type MovieStatus = 'NOW_SHOWING' | 'UPCOMING' | 'COMING_SOON' | 'ENDED' | 'ARCHIVED' | string;

export interface Movie {
  movieId: number;
  tmdbId?: number | null;
  title: string;
  originalTitle?: string;
  description?: string | null;
  releaseDate?: string | null;
  runtimeMinutes?: number | null;
  ageRating?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  trailerUrl?: string | null;
  rating?: Num | null;
  status?: MovieStatus;
}

export interface Genre {
  genreId: number;
  name: string;
}
export interface CastMember {
  personId: number;
  name: string;
  characterName?: string | null;
  profileUrl?: string | null;
}
export interface CrewMember {
  personId: number;
  name: string;
  job?: string | null;
  department?: string | null;
}

export interface MovieDetails extends Movie {
  genres: Genre[];
  cast: CastMember[];
  crew: CrewMember[];
}

/** GET /api/showtimes (flat) */
export interface ShowtimeListItem {
  showtimeId: number;
  movieId: number;
  movieTitle: string;
  posterUrl?: string | null;
  cinemaId: number;
  cinemaName: string;
  screenId: number;
  screenName: string;
  screenNumber?: number;
  showDate: string;
  startTime: string;
  endTime?: string | null;
  ticketPrice: Num;
  status: string;
  isActive: boolean;
}

/** GET /api/movies/:id/showtimes (nested, future only) */
export interface MovieShowtime {
  showtimeId: number;
  cinema: { cinemaId: number; name: string; city?: string | null };
  screen: { screenId: number; name: string; type?: string | null };
  showDate: string;
  startTime: string;
  endTime?: string | null;
  ticketPrice: Num;
  status: string;
}

export type SeatStatus = 'AVAILABLE' | 'BOOKED' | 'INACTIVE';
export interface Seat {
  seatId: number;
  rowLabel: string;
  seatNumber: number;
  seatLabel: string;
  seatType: string | null;
  status: SeatStatus;
}

export interface ShowtimeSeats {
  showtime: {
    showtimeId: number;
    movie: { movieId: number; title: string };
    cinema: { cinemaId: number; name: string };
    screen: { screenId: number; name: string; capacity?: number };
    showDate: string;
    startTime: string;
    endTime?: string | null;
    ticketPrice: Num;
    status: string;
    isActive: boolean;
  };
  summary: {
    capacity: number;
    totalSeats: number;
    activeSeats: number;
    availableSeats: number;
    bookedSeats: number;
  };
  seats: Seat[];
}

export interface TicketPrice {
  priceId: number;
  priceName?: string;
  ticketType: string;
  amount: Num;
  currency: string;
  dayType?: string | null;
}

export interface ShowtimePricing {
  currency: string;
  prices: TicketPrice[];
  /** Set on special nights; prices are already discounted */
  special?: { code: string; name: string | null; discountPercent: number } | null;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | string;

export interface BookingSeat {
  seatId: number;
  rowLabel?: string;
  seatNumber?: number;
  seatLabel: string;
  seatType: string | null;
  ticketPrice?: Num;
}

export interface DigitalTicket {
  ticketId?: number;
  ticketCode: string;
  qrCodeData: string;
  status: string;
}

export interface Booking {
  bookingId: number;
  bookingRef: string;
  showtimeId: number;
  movie: { movieId: number; title: string; posterUrl?: string | null };
  cinema: { cinemaId: number; name: string; address?: string | null; city?: string | null };
  screen: { screenId: number; name: string };
  showDate: string;
  startTime: string;
  endTime?: string | null;
  ticketQuantity: number;
  ticketPrice: Num;
  totalAmount: Num;
  originalAmount?: Num;
  discountAmount?: Num;
  status: BookingStatus;
  bookingDate?: string;
  seats: BookingSeat[];
  /** Present on GET /bookings/:id once paid (added Nov 2026). */
  ticket?: DigitalTicket | null;
  /** On GET /bookings (history): the successful payment, if any */
  payment?: { reference: string; method: PaymentMethod | string; paidAt?: string | null; amount?: Num } | null;
  /** Where the confirmation email went, and when (Nov 2026) */
  receiptEmail?: string | null;
  confirmationSentAt?: string | null;
  /** Savannah Rewards spent on this booking */
  pointsRedeemed?: number;
  pointsDiscount?: Num;
}

export interface EmailResult {
  to: string | null;
  sent: boolean;
  pending?: boolean;
  reason?: string;
}

export type PaymentMethod = 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'CASH';

export interface PaymentResult {
  payment: {
    paymentId: number;
    paymentReference: string;
    bookingId: number;
    amount: Num;
    currency: string;
    paymentMethod: PaymentMethod;
    transactionReference: string;
    status: string;
  };
  booking: Booking & { ticket: DigitalTicket };
  email?: EmailResult;
  rewards?: {
    pointsEarned: number;
    pointsRedeemed: number;
    pointsDiscount: number;
    balance: number | null;
    newTrophies: { code: string; name: string }[];
  } | null;
}

export interface User {
  userId: number;
  email: string;
  forenames: string;
  surname: string;
  phoneNumber?: string | null;
  role?: string;
  /** From PATCH /users/me ('YYYY-MM-DD') */
  dateOfBirth?: string | null;
  /** From /auth/me */
  customerProfile?: {
    customerId?: number | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    currentLoyaltyPoints?: number | null;
  } | null;
  /** Shown as @username. Every account has one (generated at sign-up). */
  username?: string | null;
  /** Preset avatar key (lib/avatars.ts) */
  avatar?: string | null;
  /** Film still behind the profile header */
  backdrop?: { url: string; movieId?: number | null } | null;
}

/** GET /api/profile/backdrops */
export interface BackdropChoice {
  movieId: number;
  title: string;
  url: string;
}

export interface ProfileLook {
  username: string | null;
  avatar: string | null;
  backdrop: { url: string; movieId?: number | null } | null;
}

export interface Cinema {
  cinemaId: number;
  cinemaName: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  isActive?: boolean;
}

/** GET /api/events */
export interface CinemaEvent {
  eventId: number;
  cinemaId?: number | null;
  cinemaName?: string | null;
  title: string;
  summary?: string | null;
  details?: string | null;
  tag?: string | null;
  /** Next occurrence, local cinema time 'YYYY-MM-DDTHH:mm:ss' */
  nextAt: string;
  recurring?: string | null;
  time?: string | null;
  movie?: { movieId: number; title: string; posterUrl?: string | null; backdropUrl?: string | null } | null;
}

/** GET /api/promotions (live offers) */
export interface Promotion {
  promotionId: number;
  cinemaId?: number | null;
  promotionName: string;
  promotionCode?: string | null;
  description?: string | null;
  discountType: 'PERCENTAGE' | 'FIXED' | string;
  discountValue: Num;
  minTickets?: number | null;
  maxDiscount?: Num | null;
  startDate?: string | null;
  endDate?: string | null;
}

/** Savannah Rewards / Trophies (GET /api/rewards/me) */
export interface Trophy {
  code: string;
  name: string;
  group: 'Milestones' | 'Genres' | 'Collections' | 'Habits' | 'Social' | 'Challenges' | 'Hidden' | string;
  description: string;
  window?: string | null;
  hidden: boolean;
  earned: boolean;
  earnedAt?: string | null;
  isNew?: boolean;
  progress: { current: number; target: number } | null;
}

export interface PointEntry {
  points: number;
  reason: string;
  description: string;
  at: string | null;
  bookingId: number | null;
}

export interface RewardsSummary {
  stats: { trophies: number; points: number; movies: number; streak: number };
  points: {
    balance: number;
    value: { pointsPerStep: number; ghsPerStep: number; maxShare: number };
    entries: PointEntry[];
    rules: { label: string; points: number }[];
  };
  trophies: Trophy[];
  newTrophies: { code: string; name: string }[];
  referral: { code: string | null; invited: number; booked: number; referredBy: string | null; canClaim: boolean };
}

export interface RewardsQuote {
  balance: number;
  points: number;
  discount: number;
  value: { pointsPerStep: number; ghsPerStep: number; maxShare: number };
}

/** GET /api/notifications */
export interface AppNotification {
  id: number;
  kind: 'BOOKING_REMINDER' | 'STARTING_SOON' | 'FILM_ON_SALE' | 'FILM_OPENING' | 'TROPHY' | string;
  title: string;
  body?: string | null;
  data: { bookingId?: number; movieId?: number; trophy?: string; startTime?: string };
  /** local cinema time 'YYYY-MM-DDTHH:mm:ss' */
  at: string;
  read: boolean;
}

export interface NotificationPrefs {
  bookingReminders: boolean;
  bookingConfirmations: boolean;
  movieReleases: boolean;
  promotions: boolean;
  newMovies: boolean;
}

export interface WatchlistItem {
  watchlistId: number;
  filmId: number;
  title: string;
  year?: number | null;
  poster?: string | null;
  rating?: Num | null;
  watched: boolean;
  favorite: boolean;
}

// ------------------------------------------------------------------
// Concessions (GET /api/concessions, /api/concessions/orders ...)
// ------------------------------------------------------------------
export type ConcessionCategory = 'POPCORN' | 'DRINKS' | 'SNACKS' | 'COMBOS' | string;

export interface ConcessionItem {
  itemId: number;
  name: string;
  category: ConcessionCategory;
  description?: string | null;
  price: Num;
  currency: string;
  imageUrl?: string | null;
  isAvailable: boolean;
  /** Upgrades and choices (sizes, flavours, combo drinks, extras) */
  options?: ConcessionOption[];
}

/** SIZE / FLAVOUR / DRINK: pick one. EXTRA: any number. */
export type OptionGroup = 'SIZE' | 'FLAVOUR' | 'DRINK' | 'EXTRA';

export interface ConcessionOption {
  optionId: number;
  group: OptionGroup;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface ConcessionOrderItem {
  itemId: number;
  name: string;
  unitPrice: Num;
  quantity: number;
  lineTotal: Num;
  imageUrl?: string | null;
  /** Option ids chosen for this line */
  options?: number[];
}

export type ConcessionOrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'COLLECTED' | string;

export interface ConcessionOrder {
  orderId: number;
  bookingId: number;
  bookingRef: string;
  source: 'BOOKING' | 'PREORDER';
  status: ConcessionOrderStatus;
  totalAmount: Num;
  paymentMethod?: string | null;
  collectionCode: string | null;
  createdAt: string;
  paidAt?: string | null;
  movie: { movieId: number; title: string; posterUrl?: string | null };
  startTime: string;
  items: ConcessionOrderItem[];
}

/** One basket line: an item with a set of chosen options */
export interface BasketLine {
  itemId: number;
  options: number[];
  quantity: number;
}

/** Basket: line key ("itemId|optionIds") -> line */
export type Basket = Record<string, BasketLine>;

/** GET /api/specials: recurring nights for older catalogue films */
export interface SpecialProgramme {
  code: string;
  name: string;
  tagline?: string | null;
  /** ISO weekday, 1 = Monday ... 7 = Sunday */
  weekday: number;
  times: string[];
  discountPercent: number;
}

export interface SpecialScreening {
  showtimeId: number;
  programme: string;
  discountPercent: number;
  cinemaId: number;
  cinemaName: string;
  screenName: string;
  showDate: string;
  startTime: string;
  ticketPrice: number;
  movie: {
    movieId: number;
    title: string;
    posterUrl?: string | null;
    backdropUrl?: string | null;
    runtimeMinutes?: number | null;
    ageRating?: string | null;
    rating?: Num | null;
    releaseDate?: string | null;
  };
}
