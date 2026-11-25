import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Poster } from '@/components/artwork';
import { LocationButton } from '@/components/location-picker';
import { RemindBell } from '@/components/remind-bell';
import { SpecialNights } from '@/components/special-nights';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { dayFromKey, dot, money, opens, releaseDay, shortDate, toNumber } from '@/lib/format';
import { useLocation } from '@/lib/location';
import { setPendingPromo } from '@/lib/promo';
import { loadSpecials, useSpecials } from '@/lib/specials';
import type { CinemaEvent, Movie, Promotion } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { usePageWidth, useScreen } from '@/lib/layout';
import { SiteFooter } from '@/components/site-footer';
import { colors, radius, space } from '@/theme';

const MAX_W = 560;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** 'YYYY-MM-DDTHH:mm:ss' in cinema time -> local Date (no time-zone shift) */
function localDate(v: string) {
  const [d, t = '00:00'] = v.split('T');
  const base = dayFromKey(d);
  const [h, m] = t.split(':').map(Number);
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}

/** Events & offers: what's on at the cinema beyond the regular programme. */
export default function Events() {
  const insets = useSafeAreaInsets();
  const width = usePageWidth(MAX_W);
  // Website on tablet/desktop gets its own layout (below)
  const screen = useScreen();

  const events = useRequest(() => api.events(), []);
  const offers = useRequest(() => api.promotions(), []);
  const coming = useRequest(async () => {
    const list = await api.upcoming();
    return list
      .filter((m) => opens(m.releaseDate))
      .sort((a, b) => String(a.releaseDate).localeCompare(String(b.releaseDate)))
      .slice(0, 10);
  }, []);

  // Events for the chosen location (and any marked for every cinema)
  const { cinemaId: here } = useLocation();
  const specials = useSpecials();
  const localEvents = useMemo(() => (events.data ?? []).filter((e) => here == null || e.cinemaId == null || Number(e.cinemaId) === here), [events.data, here]);

  const refreshing = events.refreshing || offers.refreshing || coming.refreshing;
  const refresh = async () => {
    await Promise.all([events.reload(), offers.reload(), coming.reload(), loadSpecials(true)]);
  };

  // ---------------- Tablet, laptop and desktop (website) ----------------
  if (screen.wide) {
    const { content, gutter, inner, desktop } = screen;
    const openings = coming.data ?? [];
    const posterCols = desktop ? 6 : 4;
    const posterW = Math.floor((inner - 20 * (posterCols - 1)) / posterCols);
    const eventsBlock = events.loading ? (
      <View style={{ gap: 12 }}>
        <Shimmer style={{ height: 96 }} />
        <Shimmer style={{ height: 96 }} />
      </View>
    ) : events.error && !events.data ? (
      <ErrorState error={events.error} onRetry={events.reload} />
    ) : localEvents.length === 0 ? (
      <Body color={colors.dust}>No special events on the calendar right now. New films and offers are below.</Body>
    ) : (
      <View>
        {localEvents.map((e, i) => (
          <EventRow key={e.eventId} event={e} first={i === 0} />
        ))}
      </View>
    );
    const offersBlock = offers.loading ? (
      <Shimmer style={{ height: 150 }} />
    ) : offers.error && !offers.data ? (
      <ErrorState error={offers.error} onRetry={offers.reload} />
    ) : (offers.data ?? []).length === 0 ? (
      <Body color={colors.dust}>No offers right now. Check back soon.</Body>
    ) : (
      <View style={{ flexDirection: desktop ? 'column' : 'row', flexWrap: 'wrap', gap: 16 }}>
        {(offers.data ?? []).map((o) => (
          <View key={o.promotionId} style={desktop ? null : { width: (inner - 16) / 2 }}>
            <Offer offer={o} />
          </View>
        ))}
      </View>
    );
    return (
      <View style={{ flex: 1, backgroundColor: colors.night }}>
        <ScrollView contentContainerStyle={{ paddingTop: 28 }}>
          <View style={{ width: content, alignSelf: 'center', paddingHorizontal: gutter }}>
            <View style={styles.wideHead}>
              <View style={{ gap: 6 }}>
                <Label color={colors.laterite}>EVENTS, OPENINGS & OFFERS</Label>
                <Display size={desktop ? 64 : 52} black accessibilityRole="header">
                  Events
                </Display>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Label>CINEMA</Label>
                <LocationButton />
              </View>
            </View>

            <View style={{ flexDirection: desktop ? 'row' : 'column', gap: desktop ? 48 : 0, alignItems: 'flex-start' }}>
              <View style={{ flex: desktop ? 1.35 : undefined, width: desktop ? undefined : inner, minWidth: 0 }}>
                <Section title="Coming up" gutter={0} />
                {eventsBlock}
              </View>
              <View style={{ flex: desktop ? 1 : undefined, width: desktop ? undefined : inner, minWidth: 0 }}>
                {specials.programmes.length ? (
                  <>
                    <Section title="Special nights" gutter={0} />
                    <SpecialNights gutter={0} />
                  </>
                ) : null}
                <Section title="Offers" gutter={0} />
                {offersBlock}
              </View>
            </View>

            <Section title="Opening soon" gutter={0} />
            {coming.loading ? (
              <View style={{ flexDirection: 'row', gap: 20 }}>
                {Array.from({ length: posterCols }, (_, i) => (
                  <Shimmer key={i} style={{ width: posterW, height: posterW * 1.5 }} />
                ))}
              </View>
            ) : coming.error && !coming.data ? (
              <ErrorState error={coming.error} onRetry={coming.reload} />
            ) : openings.length === 0 ? (
              <Body color={colors.dust}>Nothing announced yet. New releases appear here as soon as they’re added.</Body>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 28 }}>
                {openings.map((m) => (
                  <Opening key={m.movieId} movie={m} width={posterW} />
                ))}
              </View>
            )}
          </View>
          <SiteFooter />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 40, width, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.bone} />}>
        <View style={{ paddingHorizontal: space.gutter, gap: 4 }}>
          <Display size={52} black>
            Events
          </Display>
          <Label>EVENTS, OPENINGS & OFFERS</Label>
          <LocationButton />
        </View>

        {/* Older films back on special nights */}
        {specials.programmes.length ? (
          <>
            <Section title="Special nights" />
            <SpecialNights />
          </>
        ) : null}

        {/* Events */}
        <Section title="Coming up" />
        {events.loading ? (
          <View style={{ paddingHorizontal: space.gutter, gap: 12 }}>
            <Shimmer style={{ height: 96 }} />
            <Shimmer style={{ height: 96 }} />
          </View>
        ) : events.error && !events.data ? (
          <ErrorState error={events.error} onRetry={events.reload} />
        ) : localEvents.length === 0 ? (
          <Body color={colors.dust} style={{ paddingHorizontal: space.gutter }}>
            No special events on the calendar right now. New films and offers are below.
          </Body>
        ) : (
          <View style={{ paddingHorizontal: space.gutter }}>
            {localEvents.map((e, i) => (
              <EventRow key={e.eventId} event={e} first={i === 0} />
            ))}
          </View>
        )}

        {/* Openings */}
        <Section title="Opening soon" />
        {coming.loading ? (
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: space.gutter }}>
            <Shimmer style={{ width: 120, height: 180 }} />
            <Shimmer style={{ width: 120, height: 180 }} />
          </View>
        ) : coming.error && !coming.data ? (
          <ErrorState error={coming.error} onRetry={coming.reload} />
        ) : (coming.data ?? []).length === 0 ? (
          <Body color={colors.dust} style={{ paddingHorizontal: space.gutter }}>
            Nothing announced yet. New releases appear here as soon as they’re added.
          </Body>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 12 }}>
            {(coming.data ?? []).map((m) => (
              <Opening key={m.movieId} movie={m} />
            ))}
          </ScrollView>
        )}

        {/* Offers */}
        <Section title="Offers" />
        {offers.loading ? (
          <View style={{ paddingHorizontal: space.gutter }}>
            <Shimmer style={{ height: 150 }} />
          </View>
        ) : offers.error && !offers.data ? (
          <ErrorState error={offers.error} onRetry={offers.reload} />
        ) : (offers.data ?? []).length === 0 ? (
          <Message title="No offers right now" body="Check back soon." />
        ) : (
          <View style={{ paddingHorizontal: space.gutter, gap: 14 }}>
            {(offers.data ?? []).map((o) => (
              <Offer key={o.promotionId} offer={o} />
            ))}
          </View>
        )}
        <SiteFooter />
      </ScrollView>
    </View>
  );
}

function Section({ title, gutter = space.gutter }: { title: string; gutter?: number }) {
  return (
    <View style={[styles.section, { marginHorizontal: gutter }]}>
      <Display size={24}>{title}</Display>
    </View>
  );
}

function EventRow({ event: e, first }: { event: CinemaEvent; first: boolean }) {
  const [open, setOpen] = useState(false);
  const d = localDate(e.nextAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={dot(e.title, e.recurring ? `${e.recurring} at ${e.time}` : `${shortDate(d)} ${e.time ?? ''}`, e.summary)}
      onPress={() => setOpen((v) => !v)}
      style={({ pressed }) => [styles.event, first && { borderTopWidth: 1, borderTopColor: colors.rule }, pressed && { backgroundColor: colors.booth }]}>
      <View style={styles.dateBlock}>
        <Mono size={10.5} color={colors.laterite}>
          {DAYS[d.getDay()]}
        </Mono>
        <Display size={32} black>
          {String(d.getDate())}
        </Display>
        <Mono size={10.5} color={colors.dust}>
          {MONTHS[d.getMonth()]}
        </Mono>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        {e.tag ? <Label color={colors.lateriteSoft}>{e.tag.toUpperCase()}</Label> : null}
        <Display size={24} numberOfLines={2}>
          {e.title}
        </Display>
        {e.summary ? (
          <Body size={14} numberOfLines={open ? undefined : 2}>
            {e.summary}
          </Body>
        ) : null}
        <Mono size={11.5} color={colors.dust}>
          {dot(e.recurring?.toUpperCase(), e.time)}
        </Mono>
        {open && e.details ? (
          <Body size={14} color={colors.boneSoft} style={{ marginTop: 4 }}>
            {e.details}
          </Body>
        ) : null}
        {open && e.movie ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/film/[id]', params: { id: String(e.movie!.movieId) } })}
            style={{ height: 40, justifyContent: 'center' }}>
            <Mono size={12} color={colors.lateriteSoft}>
              {`SEE ${e.movie.title.toUpperCase()} →`}
            </Mono>
          </Pressable>
        ) : null}
      </View>
      <Mono size={16} color={colors.dust}>
        {open ? '–' : '+'}
      </Mono>
    </Pressable>
  );
}

function Opening({ movie: m, width = 120 }: { movie: Movie; width?: number }) {
  const day = releaseDay(m.releaseDate);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dot(m.title, opens(m.releaseDate)?.toLowerCase(), m.ageRating)}
      onPress={() => router.push({ pathname: '/film/[id]', params: { id: String(m.movieId) } })}
      style={({ pressed }) => [{ width, gap: 6 }, pressed && { opacity: 0.85 }]}>
      <View>
        <Poster url={m.posterUrl} title={m.title} width={width} size="w342" meta={m.ageRating} />
        <RemindBell movieId={m.movieId} title={m.title} variant="overlay" />
      </View>
      <Mono size={11} color={colors.laterite}>
        {day ? `OPENS ${shortDate(day)}` : 'COMING SOON'}
      </Mono>
      <Body size={width > 150 ? 15 : 13} weight="semi" color={colors.bone} numberOfLines={2}>
        {m.title}
      </Body>
    </Pressable>
  );
}

function Offer({ offer: o }: { offer: Promotion }) {
  const [used, setUsed] = useState(false);
  const pct = String(o.discountType).toUpperCase() === 'PERCENTAGE';
  const value = pct ? `${Math.round(toNumber(o.discountValue))}% off` : `${money(o.discountValue)} off`;
  const until = o.endDate ? new Date(o.endDate) : null;
  const terms = dot(
    o.minTickets ? `${o.minTickets}+ tickets` : null,
    pct && toNumber(o.maxDiscount) > 0 ? `up to ${money(o.maxDiscount)} off` : null,
    until ? `until ${shortDate(until)}` : null,
  );

  const use = () => {
    if (!o.promotionCode) return;
    setPendingPromo(o.promotionCode);
    setUsed(true);
    router.navigate('/films');
  };

  return (
    <View style={styles.offer}>
      <View style={{ padding: 16, gap: 6 }}>
        <Display size={34} black color={colors.ink}>
          {value}
        </Display>
        <Body weight="bold" color={colors.ink}>
          {o.promotionName}
        </Body>
        {o.description ? (
          <Body size={14} color={colors.inkSoft}>
            {o.description}
          </Body>
        ) : null}
        {terms ? (
          <Mono size={11} color={colors.inkSoft} bold={false}>
            {terms.toUpperCase()}
          </Mono>
        ) : null}
      </View>
      <View style={styles.perf} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14 }}>
        {o.promotionCode ? (
          <>
            <View style={{ gap: 2, flexShrink: 1 }}>
              <Mono size={10} color={colors.inkSoft} bold={false}>
                CODE
              </Mono>
              <Mono size={18} color={colors.ink} selectable>
                {o.promotionCode}
              </Mono>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Opens Films. The code is added when you choose seats."
              onPress={use}
              style={({ pressed }) => [styles.useBtn, pressed && { opacity: 0.8 }]}>
              <Mono size={12} color={colors.bone}>
                {used ? 'ADDED ✓' : 'USE CODE'}
              </Mono>
            </Pressable>
          </>
        ) : (
          <Body size={13} color={colors.inkSoft}>
            There’s no code to enter in the app for this offer.
          </Body>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wideHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, paddingBottom: 8 },
  section: {
    marginTop: 28,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
  },
  event: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.rule, alignItems: 'flex-start' },
  dateBlock: { width: 52, alignItems: 'center', paddingTop: 2 },
  offer: { backgroundColor: colors.bone, borderRadius: radius.paper },
  perf: { marginHorizontal: 14, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#B9AE97' },
  useBtn: { height: 44, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: colors.ink, borderRadius: radius.action },
});
