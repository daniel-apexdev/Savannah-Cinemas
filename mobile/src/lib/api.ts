import { API_BASE } from './config';
import type {
  Basket,
  Booking,
  ConcessionItem,
  ConcessionOrder,
  Movie,
  MovieDetails,
  MovieShowtime,
  PaymentMethod,
  PaymentResult,
  ShowtimeListItem,
  ShowtimePricing,
  ShowtimeSeats,
  AppNotification,
  BackdropChoice,
  Cinema,
  CinemaEvent,
  Promotion,
  RewardsQuote,
  RewardsSummary,
  EmailResult,
  NotificationPrefs,
  ProfileLook,
  SpecialProgramme,
  SpecialScreening,
  User,
  WatchlistItem,
} from './types';

export class ApiError extends Error {
  status: number;
  /** true when the server could not be reached at all */
  offline: boolean;
  constructor(message: string, status: number, offline = false) {
    super(message);
    this.status = status;
    this.offline = offline;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/**
 * The backend's BIGINT ids come back from `pg` as strings ("328"). The
 * app compares ids across endpoints (watchlist vs movie, booking vs
 * snack order...), so turn every numeric-string `id` / `...Id` field
 * into a number once, here.
 */
const ID_KEY = /(^id$|Id$)/;
function normalizeIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeIds);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = ID_KEY.test(k) && typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : normalizeIds(v);
    }
    return out;
  }
  return value;
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
};

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, auth = false, timeoutMs = 15000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  opts.signal?.addEventListener('abort', () => controller.abort());

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth || authToken) {
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = (e as Error)?.name === 'AbortError';
    if (opts.signal?.aborted) throw new ApiError('Cancelled', 0, false);
    throw new ApiError(
      aborted
        ? 'The cinema server took too long to answer.'
        : "Can't reach the Savannah Cinemas server. Check your connection.",
      0,
      true,
    );
  }
  clearTimeout(timer);

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = normalizeIds(JSON.parse(text));
    } catch {
      data = null;
    }
  }

  if (!res.ok || (data && data.success === false)) {
    if (res.status === 401 && auth) onUnauthorized?.();
    const message =
      (data && (data.message || data.error)) ||
      (res.status === 401 ? 'Please sign in to continue.' : `Something went wrong (${res.status}).`);
    throw new ApiError(String(message), res.status);
  }
  return data as T;
}

const basketToItems = (b: Basket) =>
  Object.values(b)
    .filter((l) => l.quantity > 0)
    .map((l) => ({ itemId: l.itemId, quantity: l.quantity, options: l.options }));

// ------------------------------------------------------------------
// Movies
// ------------------------------------------------------------------
export const api = {
  movies: () => request<{ movies: Movie[] }>('/movies').then((r) => r.movies),
  nowShowing: () => request<{ movies: Movie[] }>('/movies/now-showing').then((r) => r.movies),
  upcoming: () => request<{ movies: Movie[] }>('/movies/upcoming').then((r) => r.movies),
  search: (q: string, signal?: AbortSignal) =>
    request<{ movies: Movie[] }>(`/movies/search?q=${encodeURIComponent(q)}`, { signal }).then((r) => r.movies),
  movieDetails: (movieId: number) =>
    request<{ movie: MovieDetails }>(`/movies/${movieId}/details`).then((r) => r.movie),
  movieShowtimes: (movieId: number) =>
    request<{ showtimes: MovieShowtime[] }>(`/movies/${movieId}/showtimes`).then((r) => r.showtimes),

  // ----------------------------------------------------------------
  // Showtimes, seats, pricing
  // ----------------------------------------------------------------
  showtimes: () => request<{ showtimes: ShowtimeListItem[] }>('/showtimes').then((r) => r.showtimes),
  showtimeSeats: (showtimeId: number) => request<ShowtimeSeats>(`/showtimes/${showtimeId}/seats`),
  showtimePricing: (showtimeId: number) => request<ShowtimePricing>(`/pricing/showtime/${showtimeId}`),

  // ----------------------------------------------------------------
  // Bookings & payments (auth)
  // ----------------------------------------------------------------
  createBooking: (showtimeId: number, seatIds: number[], promotionCode?: string) =>
    request<{ booking: Booking; message: string }>('/bookings', {
      method: 'POST',
      auth: true,
      body: { showtimeId, seatIds, promotionCode: promotionCode?.trim() || undefined },
    }).then((r) => r.booking),
  myBookings: () => request<{ bookings: Booking[] }>('/bookings', { auth: true }).then((r) => r.bookings),
  booking: (bookingId: number) =>
    request<{ booking: Booking }>(`/bookings/${bookingId}`, { auth: true }).then((r) => r.booking),
  /** Send the booking confirmation (again), optionally to another address. */
  emailBooking: (bookingId: number, to?: string) =>
    request<{ email: EmailResult }>(`/bookings/${bookingId}/email`, { method: 'POST', auth: true, body: to ? { to } : {}, timeoutMs: 30000 }).then(
      (r) => r.email,
    ),
  cancelBooking: (bookingId: number) =>
    request<{ message: string }>(`/bookings/${bookingId}/cancel`, { method: 'PATCH', auth: true }),
  pay: (bookingId: number, paymentMethod: PaymentMethod, receiptEmail?: string, redeemPoints?: boolean) =>
    request<PaymentResult>('/payments', {
      method: 'POST',
      auth: true,
      body: { bookingId, paymentMethod, ...(receiptEmail ? { receiptEmail } : {}), ...(redeemPoints ? { redeemPoints: true } : {}) },
      timeoutMs: 30000,
    }),

  // ----------------------------------------------------------------
  // Concessions
  // ----------------------------------------------------------------
  concessions: () => request<{ items: ConcessionItem[] }>('/concessions').then((r) => r.items),
  bookingConcessions: (bookingId: number) =>
    request<{ orders: ConcessionOrder[] }>(`/concessions/bookings/${bookingId}`, { auth: true }).then((r) => r.orders),
  setBookingConcessions: (bookingId: number, basket: Basket) =>
    request<{ booking: { bookingId: number; ticketsAmount: string; concessionsAmount: string; totalAmount: string } }>(
      `/concessions/bookings/${bookingId}`,
      { method: 'PUT', auth: true, body: { items: basketToItems(basket) } },
    ),
  preorder: (bookingId: number, basket: Basket, paymentMethod: PaymentMethod) =>
    request<{ order: ConcessionOrder }>('/concessions/orders', {
      method: 'POST',
      auth: true,
      body: { bookingId, items: basketToItems(basket), paymentMethod },
      timeoutMs: 30000,
    }).then((r) => r.order),
  myOrders: () => request<{ orders: ConcessionOrder[] }>('/concessions/orders', { auth: true }).then((r) => r.orders),

  // ----------------------------------------------------------------
  // Auth & account
  // ----------------------------------------------------------------
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (p: { forenames: string; surname: string; email: string; password: string; phoneNumber?: string }) =>
    request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: p }),
  me: () => request<{ user: User }>('/auth/me', { auth: true }).then((r) => r.user),
  updateProfile: (p: { forenames?: string; surname?: string; phoneNumber?: string | null; dateOfBirth?: string | null }) =>
    request<{ user: User }>('/users/me', { method: 'PATCH', auth: true, body: p }).then((r) => r.user),
  // A wrong password answers 401; these don't count as "signed out" (auth: false).
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/users/me/password', { method: 'PATCH', body: { currentPassword, newPassword } }),
  deleteAccount: (password: string) => request('/users/me', { method: 'DELETE', body: { password } }),
  cinemas: () => request<{ cinemas: Cinema[] }>('/cinemas').then((r) => r.cinemas),
  // Special nights (Throwback Thursday, Bargain Tuesday...)
  specials: () =>
    request<{ programmes: SpecialProgramme[]; screenings: SpecialScreening[] }>('/specials').then(({ programmes, screenings }) => ({
      programmes: programmes ?? [],
      screenings: screenings ?? [],
    })),
  // Username, avatar and profile backdrop
  checkUsername: (u: string) =>
    request<{ available: boolean; reason?: string | null }>(`/profile/username/check?u=${encodeURIComponent(u)}`),
  suggestUsernames: (name?: string) =>
    request<{ usernames: string[] }>(`/profile/username/suggest${name ? `?name=${encodeURIComponent(name)}` : ''}`).then((r) => r.usernames),
  backdrops: (q?: string) =>
    request<{ backdrops: BackdropChoice[] }>(`/profile/backdrops${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => r.backdrops),
  updateLook: (p: { username?: string; avatar?: string | null; backdropMovieId?: number | null }) =>
    request<ProfileLook>('/profile/me', { method: 'PATCH', auth: true, body: p }).then(({ username, avatar, backdrop }) => ({ username, avatar, backdrop })),
  // In-app notifications and film reminders
  notifications: () => request<{ unread: number; notifications: AppNotification[] }>('/notifications', { auth: true }),
  markNotificationsRead: (ids?: number[]) =>
    request('/notifications/read', { method: 'POST', auth: true, body: ids ? { ids } : {} }),
  filmReminders: () => request<{ movieIds: number[] }>('/notifications/reminders', { auth: true }).then((r) => r.movieIds),
  setFilmReminder: (movieId: number, on: boolean) =>
    request(`/notifications/reminders/${movieId}`, { method: on ? 'PUT' : 'DELETE', auth: true }),
  // Savannah Rewards & Trophies
  rewards: () => request<RewardsSummary & { success: boolean }>('/rewards/me', { auth: true }),
  rewardsQuote: (bookingId: number) => request<RewardsQuote>(`/rewards/quote?bookingId=${bookingId}`, { auth: true }),
  claimReferral: (code: string) =>
    request<{ referrer: string; bonus: number }>('/rewards/referral', { method: 'POST', auth: true, body: { code } }),
  rewardsSeen: () => request('/rewards/seen', { method: 'POST', auth: true }),
  events: () => request<{ events: CinemaEvent[] }>('/events').then((r) => r.events),
  promotions: () => request<{ promotions: Promotion[] }>('/promotions').then((r) => r.promotions),
  notificationPrefs: () =>
    request<{ notifications: NotificationPrefs | null }>('/users/me/preferences', { auth: true }).then((r) => r.notifications),
  setNotificationPrefs: (p: Partial<NotificationPrefs>) =>
    request('/users/me/preferences/notifications', { method: 'PATCH', auth: true, body: p }),

  // ----------------------------------------------------------------
  // Watchlist (auth). filmId = movies.movie_id
  // ----------------------------------------------------------------
  watchlist: () => request<{ watchlist: WatchlistItem[] }>('/watchlist', { auth: true }).then((r) => r.watchlist),
  addToWatchlist: (m: Movie) =>
    request('/watchlist', {
      method: 'POST',
      auth: true,
      body: {
        filmId: m.movieId,
        title: m.title,
        year: m.releaseDate ? new Date(m.releaseDate).getFullYear() : null,
        poster: m.posterUrl ?? null,
        rating: m.rating != null ? Number(m.rating) : null,
      },
    }),
  removeFromWatchlist: (movieId: number) =>
    request(`/watchlist/${movieId}`, { method: 'DELETE', auth: true }),
};
