import Constants from 'expo-constants';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Poster } from '@/components/artwork';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/controls';
import { ProfileBanner } from '@/components/profile-banner';
import { RewardsBody, StatsStrip, TrophiesBody } from '@/components/rewards';
import { Group, InfoRow, NavRow, ToggleRow } from '@/components/settings-ui';
import { WatchlistBody } from '@/components/watchlist';
import { BellIcon } from '@/components/icons';
import { useNotifications } from '@/lib/notify';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { GUESTS_ALLOWED, useHasGuest } from '@/lib/guest';
import { birthDate, useAuth } from '@/lib/auth';
import { API_BASE, PAYMENTS_LIVE } from '@/lib/config';
import { clock, dot, money, shortDate, toNumber } from '@/lib/format';
import { setSetting, useSetting } from '@/lib/settings';
import type { Booking } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useRequest } from '@/lib/use-request';
import { usePageWidth, useScreen } from '@/lib/layout';
import { SiteFooter } from '@/components/site-footer';
import { colors, radius, space, touch } from '@/theme';

const MAX_W = 560;

type Page = 'tickets' | 'watchlist' | 'trophies' | 'rewards' | 'settings';
const PAGES: { key: Page; label: string }[] = [
  { key: 'tickets', label: 'Tickets' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'trophies', label: 'Trophies' },
  { key: 'rewards', label: 'Rewards' },
  { key: 'settings', label: 'Settings' },
];

function statusOf(b: Booking, now: number) {
  const future = new Date(b.startTime).getTime() > now;
  if (b.status === 'CANCELLED') return { label: 'CANCELLED', live: false };
  if (b.status === 'PENDING') return future ? { label: 'AWAITING PAYMENT', live: true } : { label: 'NOT PAID', live: false };
  if (!future || b.status === 'COMPLETED') return { label: 'SEEN', live: false };
  return { label: 'CONFIRMED', live: true };
}

/** Account: who you are, your tickets, snack orders, and settings. */
export default function Account() {
  const insets = useSafeAreaInsets();
  // Wider on tablet web; laptops and desktops get a two-column layout (below)
  const width = usePageWidth(MAX_W, 820);
  const screen = useScreen();
  const { user, signOut } = useAuth();
  const now = useNow();
  // Page tab. A link can open a tab (/account?tab=trophies&at=…); a tap wins until the next link.
  const params = useLocalSearchParams<{ tab?: string; at?: string }>();
  const [picked, setPicked] = useState<{ page: Page; at?: string } | null>(null);
  const linked = PAGES.some((x) => x.key === params.tab) ? (params.tab as Page) : null;
  const page: Page = picked && picked.at === params.at ? picked.page : (linked ?? picked?.page ?? 'tickets');
  const setPage = (p: Page) => setPicked({ page: p, at: params.at });

  const rewards = useRequest(() => api.rewards(), [user?.userId], { enabled: !!user });
  // Coming back (e.g. after paying) refreshes points and trophies
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      rewards.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  // Opening Trophies clears the "new" dots (they stay visible this time)
  const hasNew = !!rewards.data?.trophies.some((t) => t.isNew);
  useEffect(() => {
    if (page === 'trophies' && hasNew) api.rewardsSeen().catch(() => {});
  }, [page, hasNew]);
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const { unread: inboxUnread } = useNotifications();
  const haptics = useSetting('haptics');

  // Website guests: tickets booked on this browser without an account
  const hasGuest = useHasGuest();
  const asGuest = !user && hasGuest;
  const bookings = useRequest(() => api.myBookings(), [user?.userId, asGuest], { enabled: !!user || asGuest });
  const orders = useRequest(() => api.myOrders().catch(() => []), [user?.userId, asGuest], { enabled: !!user || asGuest });

  const { live, past } = useMemo(() => {
    const all = (bookings.data ?? []).map((b) => ({ b, s: statusOf(b, now) }));
    return {
      live: all.filter((x) => x.s.live).sort((a, z) => +new Date(a.b.startTime) - +new Date(z.b.startTime)),
      past: all.filter((x) => !x.s.live).sort((a, z) => +new Date(z.b.startTime) - +new Date(a.b.startTime)),
    };
  }, [bookings.data, now]);

  // Paid snack codes per booking, to show on the ticket stubs
  const codes = useMemo(() => {
    const m = new Map<number, string[]>();
    (orders.data ?? [])
      .filter((o) => o.status === 'PAID' && o.collectionCode)
      .forEach((o) => m.set(o.bookingId, [...(m.get(o.bookingId) ?? []), o.collectionCode!]));
    return m;
  }, [orders.data]);

  const open = (b: Booking) => router.push({ pathname: '/ticket/[bookingId]', params: { bookingId: String(b.bookingId) } });
  const refresh = async () => {
    await Promise.all([bookings.reload(), orders.reload(), rewards.reload()]);
  };

  if (!user && screen.wide) {
    const { content, gutter, desktop } = screen;
    const perks = [
      ['TICKETS', 'Every ticket and QR code, on any device'],
      ['REWARDS', 'Points on every film: 100 points = GHS 2 off'],
      ['TROPHIES', 'Milestones like your first film and late nights'],
      ['WATCHLIST', 'Save films and get a nudge when they open'],
    ];
    return (
      <View style={{ flex: 1, backgroundColor: colors.night }}>
        <ScrollView contentContainerStyle={{ paddingTop: 36 }}>
          <View style={{ width: content, alignSelf: 'center', paddingHorizontal: gutter, gap: 36 }}>
            {asGuest && (live.length > 0 || past.length > 0) ? (
              <View style={{ gap: 14 }}>
                <View style={{ gap: 4 }}>
                  <Label color={colors.laterite}>BOOKED ON THIS BROWSER</Label>
                  <Display size={40} black>
                    Your tickets
                  </Display>
                  <Body size={14} color={colors.dust}>
                    They were also emailed to you. Show the QR code at the door.
                  </Body>
                </View>
                {live.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
                    {live.map(({ b, s }) => (
                      <View key={b.bookingId} style={{ width: desktop ? 420 : '100%' }}>
                        <LiveStub b={b} label={s.label} snacks={!!codes.get(b.bookingId)} onOpen={open} />
                      </View>
                    ))}
                  </View>
                ) : null}
                {past.length > 0 ? (
                  <View style={{ marginHorizontal: -space.gutter }}>
                    <History rows={past} codes={codes} onOpen={open} />
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.wideOut, { flexDirection: desktop ? 'row' : 'column' }]}>
              <View style={{ flex: desktop ? 1 : undefined, gap: 14 }}>
                <Label color={colors.laterite}>NOT SIGNED IN</Label>
                <Display size={desktop ? 60 : 48} black>
                  Your account
                </Display>
                <Body size={16} color={colors.boneSoft} style={{ maxWidth: 560 }}>
                  You don’t need one to book. A free account keeps everything in one place, here and in the app:
                </Body>
                <View style={{ gap: 12, marginTop: 4 }}>
                  {perks.map(([k, v]) => (
                    <View key={k} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                      <View style={{ width: 18, height: 3, backgroundColor: colors.laterite, marginTop: 9 }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Mono size={11} color={colors.dust}>
                          {k}
                        </Mono>
                        <Body size={15} color={colors.bone}>
                          {v}
                        </Body>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <View style={[styles.wideCard, { width: desktop ? 420 : '100%' }]}>
                <Display size={30} black>
                  Sign in or join
                </Display>
                <Body size={14} color={colors.dust}>
                  Same account as the Savannah Cinemas app.
                </Body>
                <Button label="Sign in" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'in' } })} />
                <Button label="Create a free account" variant="outline" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'up' } })} />
              </View>
            </View>
          </View>
          <SiteFooter />
        </ScrollView>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, width, alignSelf: 'center' }}>
          <View style={{ paddingHorizontal: space.gutter }}>
            <Display size={52} black>
              Account
            </Display>
          </View>
          {asGuest && (live.length > 0 || past.length > 0) ? (
            <View style={{ gap: 14, marginTop: 18 }}>
              <View style={{ paddingHorizontal: space.gutter, gap: 4 }}>
                <Label color={colors.laterite}>BOOKED ON THIS BROWSER</Label>
                <Body size={14} color={colors.dust}>
                  Your tickets were also emailed to you.
                </Body>
              </View>
              {live.length > 0 ? (
                <View style={{ gap: 14, paddingHorizontal: space.gutter }}>
                  {live.map(({ b, s }) => (
                    <LiveStub key={b.bookingId} b={b} label={s.label} snacks={!!codes.get(b.bookingId)} onOpen={open} />
                  ))}
                </View>
              ) : null}
              {past.length > 0 ? <History rows={past} codes={codes} onOpen={open} /> : null}
            </View>
          ) : null}
          <Message
            style={screen.wide ? { paddingTop: 36 } : undefined}
            kicker="NOT SIGNED IN"
            title={GUESTS_ALLOWED ? 'Keep your tickets with you' : 'Your tickets, in one place'}
            body={
              GUESTS_ALLOWED
                ? 'You can book without an account. Create one to keep every ticket on any device, collect Savannah Rewards points, save films to your watchlist and get reminders.'
                : 'Sign in to book seats, keep your tickets with their QR codes, pre-order snacks and save films to your watchlist.'
            }
            action={
              <View style={{ gap: 10 }}>
                <Button label="Sign in" onPress={() => router.push('/sign-in')} />
                <Button label="Create account" variant="outline" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'up' } })} />
              </View>
            }
          />
          <SiteFooter />
        </ScrollView>
      </View>
    );
  }

  const profileHead = (bw: number, top: number) => (
    <>
      {/* Who: the chosen film still, avatar, name and @username */}
      <ProfileBanner url={user.backdrop?.url} width={bw} height={128 + top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inboxUnread ? `Notifications, ${inboxUnread} new` : 'Notifications'}
          onPress={() => router.push('/notifications')}
          hitSlop={6}
          style={({ pressed }) => [styles.bell, { top: top + 8 }, pressed && { backgroundColor: colors.booth }]}>
          <BellIcon size={22} color={inboxUnread ? colors.bone : colors.boneSoft} />
          {inboxUnread ? (
            <View style={styles.badge}>
              <Mono size={10} color={colors.ink}>
                {inboxUnread > 9 ? '9+' : String(inboxUnread)}
              </Mono>
            </View>
          ) : null}
        </Pressable>
        {!user.backdrop ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/profile-setup')}
            hitSlop={6}
            style={({ pressed }) => [styles.addBackdrop, { top: top + 14 }, pressed && { opacity: 0.7 }]}>
            <Mono size={11} color={colors.dust}>
              + ADD A BACKDROP
            </Mono>
          </Pressable>
        ) : null}
      </ProfileBanner>
      <View style={styles.who}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change avatar" onPress={() => router.push('/profile-setup')} style={styles.avatarWrap}>
          <Avatar user={user} size={84} ring={colors.night} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, gap: 2, paddingTop: 46 }}>
          <Display size={30} black numberOfLines={2}>
            {`${user.forenames} ${user.surname}`}
          </Display>
          {user.username ? (
            <Mono size={13} color={colors.lateriteSoft} numberOfLines={1}>
              @{user.username}
            </Mono>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/profile')}
            hitSlop={8}
            style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}>
            <Mono size={11.5}>EDIT PROFILE</Mono>
          </Pressable>
        </View>
      </View>

      <StatsStrip stats={rewards.data?.stats ?? null} />
    </>
  );
  const pageBody = (bodyW: number) => (
    <>
      {page === 'tickets' ? (
        <>
          {/* Tickets: coming up / history */}
          <View style={styles.tabs} accessibilityRole="tablist">
            {(
              [
                ['upcoming', `COMING UP${live.length ? ` · ${live.length}` : ''}`],
                ['history', `HISTORY${past.length ? ` · ${past.length}` : ''}`],
              ] as const
            ).map(([k, label]) => (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === k }}
                onPress={() => setTab(k)}
                style={[styles.tab, tab === k && styles.tabOn]}>
                <Mono size={12} color={tab === k ? colors.bone : colors.dust}>
                  {label}
                </Mono>
              </Pressable>
            ))}
          </View>

          {bookings.loading ? (
            <View style={{ paddingHorizontal: space.gutter, gap: 14 }}>
              <Shimmer style={{ height: 150 }} />
            </View>
          ) : bookings.error && !bookings.data ? (
            <ErrorState error={bookings.error} onRetry={bookings.reload} />
          ) : (bookings.data?.length ?? 0) === 0 ? (
            <View style={{ paddingHorizontal: space.gutter, gap: 12 }}>
              <Body>No bookings yet. Your tickets will live here with a QR code for the door.</Body>
              <Button label="See what’s on" variant="outline" onPress={() => router.navigate('/')} />
            </View>
          ) : (
            <>
              {tab === 'upcoming' ? (
                live.length > 0 ? (
                  <View style={{ gap: 14, paddingHorizontal: space.gutter }}>
                    {live.map(({ b, s }) => (
                      <LiveStub key={b.bookingId} b={b} label={s.label} snacks={!!codes.get(b.bookingId)} onOpen={open} />
                    ))}
                  </View>
                ) : (
                  <View style={{ paddingHorizontal: space.gutter }}>
                    <Body>Nothing coming up.</Body>
                  </View>
                )
              ) : (
                <History rows={past} codes={codes} onOpen={open} />
              )}
            </>
          )}
        </>
      ) : page === 'watchlist' ? (
        <WatchlistBody embedded />
      ) : page === 'trophies' || page === 'rewards' ? (
        rewards.loading ? (
          <View style={{ paddingHorizontal: space.gutter, gap: 14 }}>
            <Shimmer style={{ height: 40, width: 220 }} />
            <Shimmer style={{ height: 160 }} />
          </View>
        ) : rewards.error && !rewards.data ? (
          <ErrorState error={rewards.error} onRetry={rewards.reload} />
        ) : rewards.data ? (
          page === 'trophies' ? (
            <TrophiesBody data={rewards.data} width={bodyW} />
          ) : (
            <RewardsBody data={rewards.data} onChanged={rewards.reload} />
          )
        ) : null
      ) : (
        /* Settings */
        <View style={{ paddingHorizontal: space.gutter, gap: 22 }}>
          <Group title="Account">
            <NavRow label="Sign-in email" detail={user.email} onPress={() => router.push('/settings/profile')} />
            <NavRow
              label="Personal details"
              detail={dot(user.phoneNumber || 'No phone added', birthDate(user) ? `Born ${birthDate(user)!.split('-').reverse().join('/')}` : null)}
              onPress={() => router.push('/settings/profile')}
            />
            <NavRow label="Password" onPress={() => router.push('/settings/password')} />
            <NavRow label="Notifications" detail="Booking reminders, new films, offers" onPress={() => router.push('/settings/notifications')} />
          </Group>

          {Platform.OS !== 'web' ? (
            <Group title="On this phone">
              <ToggleRow label="Haptics" detail="A light tap when you pick seats and snacks." value={haptics} onChange={(v) => setSetting('haptics', v)} />
            </Group>
          ) : null}

          <Group title="Support">
            <NavRow label="Help & contact" detail="Common questions, call or email the cinema" onPress={() => router.push('/settings/help')} />
          </Group>

          <Group title="About">
            <InfoRow label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
            <InfoRow label="Payments" value={PAYMENTS_LIVE ? 'Live' : 'Test mode'} />
            {__DEV__ ? <InfoRow label="Server" value={API_BASE} selectable /> : null}
          </Group>

          <Group>
            <NavRow
              label="Sign out"
              tone="danger"
              onPress={async () => {
                await signOut();
                router.navigate('/');
              }}
            />
            <NavRow label="Delete account" tone="danger" onPress={() => router.push('/settings/delete')} />
          </Group>
        </View>
      )}
    </>
  );

  // ---------------- Laptop and desktop (website): profile beside the page ----------------
  if (screen.desktop) {
    const { content, gutter, inner } = screen;
    const sideW = 340;
    const mainW = inner - sideW - 40;
    return (
      <View style={{ flex: 1, backgroundColor: colors.night }}>
        <ScrollView contentContainerStyle={{ paddingTop: 28 }}>
          <View style={{ width: content, alignSelf: 'center', paddingHorizontal: gutter, flexDirection: 'row', gap: 40, alignItems: 'flex-start' }}>
            <View style={styles.side}>
              {profileHead(sideW - 3, 0)}
              <View style={{ paddingVertical: 10 }} accessibilityRole="tablist">
                {PAGES.map(({ key: k, label }) => (
                  <Pressable
                    key={k}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: page === k }}
                    onPress={() => setPage(k)}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
                      styles.sideTab,
                      page === k && styles.sideTabOn,
                      hovered && page !== k && { backgroundColor: colors.booth },
                    ]}>
                    <Display size={22} color={page === k ? colors.bone : colors.dust}>
                      {label}
                    </Display>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ width: mainW, minWidth: 0 }}>
              <View style={{ paddingHorizontal: space.gutter, paddingBottom: 18 }}>
                <Display size={52} black accessibilityRole="header">
                  {PAGES.find((x) => x.key === page)?.label ?? 'Account'}
                </Display>
              </View>
              {pageBody(mainW)}
            </View>
          </View>
          <SiteFooter />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, width, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={bookings.refreshing || orders.refreshing} onRefresh={refresh} tintColor={colors.bone} />}>
        {profileHead(width, insets.top)}

        {/* Page tabs, on the rule under the name */}
        <View style={styles.pageTabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pageTabs} accessibilityRole="tablist">
            {PAGES.map(({ key: k, label }) => (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: page === k }}
                onPress={() => setPage(k)}
                style={[styles.pageTab, page === k && styles.pageTabOn]}>
                <Display size={22} color={page === k ? colors.bone : colors.dust}>
                  {label}
                </Display>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {pageBody(width)}
        <SiteFooter />
      </ScrollView>
    </View>
  );
}

const METHOD: Record<string, string> = { MOBILE_MONEY: 'Mobile Money', CARD: 'Card', BANK_TRANSFER: 'Bank transfer', CASH: 'Cash' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
type Row = { b: Booking; s: { label: string; live: boolean } };
type HistoryFilter = 'all' | 'paid' | 'cancelled' | 'unpaid';

/** An upcoming ticket: the cream stub that opens the QR ticket. */
function LiveStub({ b, label, snacks, onOpen }: { b: Booking; label: string; snacks: boolean; onOpen: (b: Booking) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${b.movie.title}, ${shortDate(new Date(b.startTime))} at ${clock(b.startTime)}, ${label.toLowerCase()}. Open ticket`}
      onPress={() => onOpen(b)}
      style={({ pressed }) => [styles.stub, pressed && { opacity: 0.9 }]}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Poster url={b.movie.posterUrl} title={b.movie.title} width={56} size="w185" />
        <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
          <Display size={26} black color={colors.ink} numberOfLines={2} accessibilityRole="text">
            {b.movie.title}
          </Display>
          <Mono size={12.5} color={colors.inkSoft}>
            {dot(shortDate(new Date(b.startTime)), clock(b.startTime), b.screen.name.toUpperCase())}
          </Mono>
        </View>
      </View>
      <View style={styles.perf} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <Mono size={13} color={colors.ink} style={{ flexShrink: 1 }} numberOfLines={1}>
          {b.seats.map((x) => x.seatLabel).join(' ')}
          {snacks ? '  ·  + SNACKS' : ''}
        </Mono>
        <Mono size={11.5} numberOfLines={1} style={{ flexShrink: 0 }} color={label === 'CONFIRMED' ? colors.ink : colors.laterite}>
          {label === 'CONFIRMED' ? 'SHOW QR →' : 'PAY NOW →'}
        </Mono>
      </View>
    </Pressable>
  );
}

const isPaid = (b: Booking) => b.status === 'CONFIRMED' || b.status === 'COMPLETED' || !!b.payment;

/** Every past, cancelled or unpaid booking: a record of what was bought, when and how. */
function History({ rows, codes, onOpen }: { rows: Row[]; codes: Map<number, string[]>; onOpen: (b: Booking) => void }) {
  const [filter, setFilter] = useState<HistoryFilter>('all');

  if (rows.length === 0) {
    return (
      <View style={{ paddingHorizontal: space.gutter }}>
        <Body>Films you’ve seen and bookings you’ve cancelled will be listed here.</Body>
      </View>
    );
  }

  const paidRows = rows.filter((r) => r.b.status !== 'CANCELLED' && isPaid(r.b));
  const spent = paidRows.reduce((a, r) => a + toNumber(r.b.payment?.amount ?? r.b.totalAmount), 0);
  const seats = paidRows.reduce((a, r) => a + r.b.seats.length, 0);
  const shown = rows.filter((r) =>
    filter === 'all'
      ? true
      : filter === 'paid'
        ? r.b.status !== 'CANCELLED' && isPaid(r.b)
        : filter === 'cancelled'
          ? r.b.status === 'CANCELLED'
          : r.b.status === 'PENDING',
  );

  // Group by the month of the show
  const groups: { key: string; label: string; rows: Row[] }[] = [];
  for (const r of shown) {
    const d = new Date(r.b.startTime);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`.toUpperCase(), rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }

  const FILTERS: [HistoryFilter, string][] = [
    ['all', 'ALL'],
    ['paid', 'PAID'],
    ['cancelled', 'CANCELLED'],
    ['unpaid', 'NOT PAID'],
  ];

  return (
    <View style={{ paddingHorizontal: space.gutter, gap: 14 }}>
      <View style={styles.summary} accessible accessibilityLabel={`${paidRows.length} paid bookings, ${seats} seats, ${money(spent)} spent`}>
        <View style={{ flex: 1 }}>
          <Label>BOOKINGS</Label>
          <Display size={30}>{String(paidRows.length)}</Display>
        </View>
        <View style={{ flex: 1 }}>
          <Label>SEATS</Label>
          <Display size={30}>{String(seats)}</Display>
        </View>
        <View style={{ flex: 1.4 }}>
          <Label>SPENT</Label>
          <Display size={30}>{money(spent)}</Display>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === k }}
            onPress={() => setFilter(k)}
            style={[styles.chip, filter === k && { backgroundColor: colors.bone, borderColor: colors.bone }]}>
            <Mono size={11} color={filter === k ? colors.ink : colors.dust}>
              {label}
            </Mono>
          </Pressable>
        ))}
      </ScrollView>

      {groups.length === 0 ? <Body color={colors.dust}>Nothing here.</Body> : null}

      {groups.map((g) => (
        <View key={g.key}>
          <Label style={{ paddingBottom: 6 }}>{g.label}</Label>
          {g.rows.map(({ b, s }) => {
            const d = new Date(b.startTime);
            const paid = b.status !== 'CANCELLED' && isPaid(b);
            const state = b.status === 'CANCELLED' ? 'CANCELLED' : b.status === 'PENDING' ? 'NOT PAID' : paid ? 'PAID' : s.label;
            const how = b.payment ? (METHOD[String(b.payment.method)] ?? String(b.payment.method)) : null;
            return (
              <Pressable
                key={b.bookingId}
                accessibilityRole="button"
                accessibilityLabel={`${b.movie.title}, ${shortDate(d)} ${clock(b.startTime)}, ${money(b.totalAmount)}, ${state.toLowerCase()}. Open`}
                onPress={() => onOpen(b)}
                style={({ pressed }) => [styles.histRow, pressed && { backgroundColor: colors.booth }]}>
                <View style={styles.dateBlock}>
                  <Display size={24}>{String(d.getDate())}</Display>
                  <Mono size={10} color={colors.dust}>
                    {shortDate(d).split(' ')[0]}
                  </Mono>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Body weight="semi" color={b.status === 'CANCELLED' ? colors.dust : colors.bone} numberOfLines={1}>
                    {b.movie.title}
                  </Body>
                  <Mono size={11} color={colors.dust} bold={false} numberOfLines={1}>
                    {dot(clock(b.startTime), b.seats.map((x) => x.seatLabel).join(' '), codes.get(b.bookingId) ? 'SNACKS' : null)}
                  </Mono>
                  <Mono size={10.5} color={colors.dust} bold={false} numberOfLines={1} selectable>
                    {dot(b.bookingRef, how, b.confirmationSentAt ? 'EMAILED' : null)}
                  </Mono>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Mono
                    size={13}
                    color={b.status === 'CANCELLED' ? colors.dust : colors.bone}
                    style={b.status === 'CANCELLED' ? { textDecorationLine: 'line-through' } : null}>
                    {money(b.totalAmount)}
                  </Mono>
                  <Mono size={10} color={state === 'PAID' ? colors.dust : colors.lateriteSoft}>
                    {state}
                  </Mono>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: space.gutter, marginTop: -46 },
  avatarWrap: { borderRadius: 42 },
  bell: {
    position: 'absolute',
    right: space.gutter,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: 3,
    backgroundColor: 'rgba(18,16,13,0.72)',
  },
  addBackdrop: { position: 'absolute', left: space.gutter, height: 32, justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: colors.laterite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.night,
  },
  pageTabsWrap: {
    marginHorizontal: space.gutter,
    marginTop: 18,
    marginBottom: 18,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  pageTabs: { flexDirection: 'row', gap: 24 },
  pageTab: { paddingTop: 12, paddingBottom: 10, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -1 },
  pageTabOn: { borderBottomColor: colors.laterite },
  // Website, laptop and desktop
  side: { width: 340, borderWidth: 1.5, borderColor: colors.bone, borderRadius: 4, overflow: 'hidden', paddingBottom: 6 },
  sideTab: { paddingHorizontal: space.gutter, paddingVertical: 10, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  sideTabOn: { borderLeftColor: colors.laterite, backgroundColor: colors.booth },
  wideOut: { gap: 40, alignItems: 'flex-start', borderTopWidth: 1.5, borderTopColor: colors.bone, paddingTop: 28 },
  wideCard: { borderWidth: 1.5, borderColor: colors.bone, borderRadius: 4, padding: 28, gap: 14 },
  tabs: { flexDirection: 'row', gap: 20, paddingHorizontal: space.gutter, marginTop: -6, marginBottom: 14 },
  tab: { paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.laterite },
  summary: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule },
  chip: { height: 32, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1.5, borderColor: colors.rule, borderRadius: 3 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rule },
  dateBlock: { width: 40, alignItems: 'center' },
  editBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    height: 32,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: 3,
  },
  secHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: space.gutter,
    marginTop: 26,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
  },
  stub: { backgroundColor: colors.bone, borderRadius: radius.paper, padding: 14, gap: 12 },
  perf: { borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#B9AE97' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: Math.max(touch, 56),
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
});
