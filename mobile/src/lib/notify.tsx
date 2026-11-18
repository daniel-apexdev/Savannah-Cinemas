import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BellIcon } from '@/components/icons';
import { Body, Mono } from '@/components/type';
import { colors, radius, space } from '@/theme';

import { api } from './api';
import { useAuth } from './auth';
import { releaseDay } from './format';
import { storage } from './storage';
import type { AppNotification, Booking, Movie } from './types';

/*
 * Notifications, three ways:
 *  1. The inbox (server): booking reminders, film alerts, trophies.
 *     Polled every minute while the app is open; the bell in Account
 *     shows the unread count and opens the list.
 *  2. A banner at the top of the app when something new arrives.
 *  3. Phone notifications scheduled on the device for the same moments
 *     (3 h and 30 min before a booked show, 09:00 on a reminded film's
 *     opening day), so they arrive with the app closed. Not on web.
 */

const POLL_MS = 60 * 1000;
const LAST_SEEN_KEY = 'savannah.notify.lastSeen';
const ID_PREFIX = 'sav:';
const native = Platform.OS !== 'web';

if (native) {
  // In the foreground our own banner shows it; the system list still gets it
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Where a notification leads */
export function openNotification(n: { data?: AppNotification['data'] | Record<string, unknown> }) {
  const d = (n.data ?? {}) as AppNotification['data'];
  if (d.bookingId) router.push({ pathname: '/ticket/[bookingId]', params: { bookingId: String(d.bookingId) } });
  else if (d.movieId) router.push({ pathname: '/film/[id]', params: { id: String(d.movieId) } });
  else if (d.trophy) router.navigate({ pathname: '/account', params: { tab: 'trophies', at: String(Date.now()) } });
}

// ------------------------------------------------------------
// Film reminders (bell on coming-soon films): a tiny shared store
// ------------------------------------------------------------

let reminderIds = new Set<number>();
const reminderListeners = new Set<() => void>();
const emitReminders = () => reminderListeners.forEach((l) => l());

function useReminderSet() {
  return useSyncExternalStore(
    (l) => {
      reminderListeners.add(l);
      return () => reminderListeners.delete(l);
    },
    () => reminderIds,
    () => reminderIds,
  );
}

// ------------------------------------------------------------
// Phone notifications
// ------------------------------------------------------------

async function ensurePermission(ask: boolean) {
  if (!native) return false;
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!ask || !now.canAskAgain) return false;
  const r = await Notifications.requestPermissionsAsync();
  return r.granted;
}

const at = (d: Date) => ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date: d, channelId: 'reminders' }) as const;

/** Replace our scheduled phone notifications with ones for the current bookings and reminders. */
async function scheduleOnDevice(bookings: Booking[], reminded: Movie[], prefs: { bookingReminders: boolean; movieReleases: boolean }) {
  if (!native) return;
  if (!(await ensurePermission(false))) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Film reminders',
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: colors.laterite,
    });
  }

  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing.filter((n) => n.identifier.startsWith(ID_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = Date.now();
  const jobs: Promise<string>[] = [];
  const hm = (d: Date) => d.toTimeString().slice(0, 5);

  if (prefs.bookingReminders) {
    for (const b of bookings) {
      if (b.status !== 'CONFIRMED') continue;
      const start = new Date(b.startTime);
      const seats = b.seats.map((s) => s.seatLabel).join(' ');
      const reminder = new Date(start.getTime() - 3 * 3600_000);
      const soon = new Date(start.getTime() - 30 * 60_000);
      if (reminder.getTime() > now) {
        jobs.push(
          Notifications.scheduleNotificationAsync({
            identifier: `${ID_PREFIX}b:${b.bookingId}:r`,
            content: {
              title: `${start.getHours() >= 17 ? 'Tonight' : 'Today'} at ${hm(start)}: ${b.movie.title}`,
              body: `${b.screen.name} · Seats ${seats}. Your QR ticket is in the app.`,
              data: { bookingId: b.bookingId },
            },
            trigger: at(reminder),
          }),
        );
      }
      if (soon.getTime() > now) {
        jobs.push(
          Notifications.scheduleNotificationAsync({
            identifier: `${ID_PREFIX}b:${b.bookingId}:s`,
            content: {
              title: `${b.movie.title} starts at ${hm(start)}`,
              body: `Head to ${b.screen.name}. Seats ${seats}. Enjoy the film!`,
              data: { bookingId: b.bookingId },
            },
            trigger: at(soon),
          }),
        );
      }
    }
  }

  if (prefs.movieReleases) {
    for (const m of reminded) {
      const day = releaseDay(m.releaseDate);
      if (!day) continue;
      day.setHours(9, 0, 0, 0);
      if (day.getTime() <= now) continue;
      jobs.push(
        Notifications.scheduleNotificationAsync({
          identifier: `${ID_PREFIX}f:${m.movieId}`,
          content: { title: `${m.title} opens today`, body: 'You asked us to remind you. Book your seats in the app.', data: { movieId: m.movieId } },
          trigger: at(day),
        }),
      );
    }
  }

  await Promise.allSettled(jobs);
}

// ------------------------------------------------------------
// Provider
// ------------------------------------------------------------

type Ctx = {
  unread: number;
  items: AppNotification[] | null;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Re-schedule phone reminders (after paying, cancelling, changing reminders) */
  resync: (askPermission?: boolean) => Promise<void>;
};

const NotifyContext = createContext<Ctx>({
  unread: 0,
  items: null,
  refresh: async () => {},
  markAllRead: async () => {},
  resync: async () => {},
});

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const lastSeen = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((n: AppNotification) => {
    setToast(n);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  }, []);

  // Takes a fresh inbox: stores it and shows a banner for anything new
  const apply = useCallback(
    async (r: { unread: number; notifications: AppNotification[] }) => {
      setItems(r.notifications);
      setUnread(r.unread);
      const newest = r.notifications[0]?.id ?? 0;
      if (lastSeen.current == null) {
        const stored = Number(await storage.get(LAST_SEEN_KEY)) || 0;
        lastSeen.current = stored;
      }
      // Banner for the newest unread one that arrived since we last looked
      const fresh = r.notifications.find((n) => !n.read && n.id > (lastSeen.current ?? 0));
      if (fresh) showToast(fresh);
      if (newest > (lastSeen.current ?? 0)) {
        lastSeen.current = newest;
        storage.set(LAST_SEEN_KEY, String(newest));
      }
    },
    [showToast],
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    // offline or signed out: keep what we have
    await api.notifications().then(apply).catch(() => {});
  }, [user, apply]);

  const resync = useCallback(
    async (askPermission = false) => {
      if (!user || !native) return;
      try {
        if (askPermission) await ensurePermission(true);
        const [bookings, ids, upcoming, prefs] = await Promise.all([
          api.myBookings().catch(() => [] as Booking[]),
          api.filmReminders().catch(() => [] as number[]),
          api.upcoming().catch(() => [] as Movie[]),
          api.notificationPrefs().catch(() => null),
        ]);
        reminderIds = new Set(ids);
        emitReminders();
        const reminded = upcoming.filter((m) => reminderIds.has(m.movieId));
        await scheduleOnDevice(bookings, reminded, {
          bookingReminders: prefs?.bookingReminders ?? true,
          movieReleases: prefs?.movieReleases ?? true,
        });
      } catch {
        // never block the app on reminders
      }
    },
    [user],
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setUnread(0);
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? list);
    await api.markNotificationsRead().catch(() => {});
  }, [user]);

  // Sign in / out
  const onSignedIn = useEffectEvent(() => {
    api
      .notifications()
      .then(apply)
      .catch(() => {});
    api
      .filmReminders()
      .then((ids) => {
        reminderIds = new Set(ids);
        emitReminders();
      })
      .catch(() => {});
    resync(false);
  });
  useEffect(() => {
    if (!user) {
      reminderIds = new Set();
      emitReminders();
      return;
    }
    onSignedIn();
  }, [user]);

  // Poll while open; refresh when the app comes back
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        refresh();
        resync(false);
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [user, refresh, resync]);

  // Phone notifications: arriving in the foreground → refresh the inbox;
  // tapped → go where it points
  useEffect(() => {
    if (!native) return;
    const received = Notifications.addNotificationReceivedListener(() => refresh());
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => {
      openNotification({ data: r.notification.request.content.data as AppNotification['data'] });
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [refresh]);

  const value = useMemo(() => ({ unread, items, refresh, markAllRead, resync }), [unread, items, refresh, markAllRead, resync]);

  return (
    <NotifyContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={[styles.toastWrap, { top: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${toast.title}. ${toast.body ?? ''}`}
            onPress={() => {
              setToast(null);
              openNotification(toast);
            }}
            style={({ pressed }) => [styles.toast, pressed && { opacity: 0.9 }]}>
            <BellIcon size={18} color={colors.ink} filled />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Body weight="bold" color={colors.ink} numberOfLines={2}>
                {toast.title}
              </Body>
              {toast.body ? (
                <Body size={13} color={colors.inkSoft} numberOfLines={2}>
                  {toast.body}
                </Body>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10} onPress={() => setToast(null)}>
              <Mono size={14} color={colors.inkSoft}>
                ✕
              </Mono>
            </Pressable>
          </Pressable>
        </View>
      ) : null}
    </NotifyContext.Provider>
  );
}

export const useNotifications = () => useContext(NotifyContext);

/** Reminder bell state for one film: [on, toggle]. */
export function useFilmReminder(movieId: number) {
  const ids = useReminderSet();
  const { user } = useAuth();
  const { resync, refresh } = useNotifications();
  const on = ids.has(movieId);
  const toggle = useCallback(async () => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    const next = !reminderIds.has(movieId);
    const set = new Set(reminderIds);
    if (next) set.add(movieId);
    else set.delete(movieId);
    reminderIds = set;
    emitReminders();
    try {
      await api.setFilmReminder(movieId, next);
      await resync(next);
      refresh();
    } catch {
      const back = new Set(reminderIds);
      if (next) back.delete(movieId);
      else back.add(movieId);
      reminderIds = back;
      emitReminders();
    }
  }, [movieId, user, resync, refresh]);
  return [on, toggle] as const;
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: space.gutter, right: space.gutter, alignItems: 'center', zIndex: 50 },
  toast: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.vip,
    borderRadius: radius.action,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
