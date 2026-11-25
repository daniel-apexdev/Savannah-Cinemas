import { router } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop, Poster } from '@/components/artwork';
import { Avatar } from '@/components/avatar';
import { Button, TimeToken } from '@/components/controls';
import { LocationButton } from '@/components/location-picker';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { TrailerModal } from '@/components/trailer';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { addDays, clock, dayFromKey, dayKey, dot, isToday, runtime, startsIn, weekday } from '@/lib/format';
import type { Movie, ShowtimeListItem } from '@/lib/types';
import { useLocation } from '@/lib/location';
import { specialLabel, useSpecials } from '@/lib/specials';
import { useNow } from '@/lib/use-now';
import { useRequest } from '@/lib/use-request';
import { usePageWidth, useScreen, useWide } from '@/lib/layout';
import { SiteFooter } from '@/components/site-footer';
import { colors, space, touch } from '@/theme';

// Matches the showtime generator's fortnight
const DAYS_AHEAD = 14;
const MAX_W = 560;

type FilmRow = { movie: Movie | undefined; movieId: number; title: string; posterUrl?: string | null; times: ShowtimeListItem[] };

export default function Tonight() {
  const insets = useSafeAreaInsets();
  // Wider on desktop web (lib/layout)
  const width = usePageWidth(MAX_W, 760);
  const wide = useWide();
  const screen = useScreen();
  const { user } = useAuth();

  const req = useRequest(async () => {
    const [showtimes, movies] = await Promise.all([api.showtimes(), api.movies()]);
    return { showtimes, movies };
  }, []);

  // Ticks every minute so "starts in" and past shows stay honest.
  const now = useNow();

  // The location picked in the masthead (Accra Mall / West Hills Mall)
  const { cinemaId: activeCinema } = useLocation();
  const specials = useSpecials();

  const movieById = useMemo(() => new Map((req.data?.movies ?? []).map((m) => [m.movieId, m])), [req.data]);

  // Upcoming, bookable shows per local day
  const byDay = useMemo(() => {
    const map = new Map<string, ShowtimeListItem[]>();
    for (const s of req.data?.showtimes ?? []) {
      if (!s.isActive) continue;
      if (s.status === 'CANCELLED' || s.status === 'COMPLETED') continue;
      if (activeCinema != null && Number(s.cinemaId) !== activeCinema) continue;
      if (new Date(s.startTime).getTime() <= now) continue;
      const k = dayKey(s.startTime);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    map.forEach((list) => list.sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime)));
    return map;
  }, [req.data, activeCinema, now]);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => dayKey(addDays(today, i)));
  }, []);

  const [picked, setPicked] = useState<string | null>(null);
  const firstWithShows = days.find((d) => (byDay.get(d)?.length ?? 0) > 0) ?? days[0];
  const selected = picked ?? firstWithShows;
  const shows = useMemo(() => byDay.get(selected) ?? [], [byDay, selected]);
  const hero = shows[0];
  const heroMovie = hero ? movieById.get(hero.movieId) : undefined;

  // How full is the next show? One small request, only for the hero.
  const heroId = hero?.showtimeId;
  const heroSeats = useRequest(() => (heroId ? api.showtimeSeats(heroId) : Promise.reject(new Error('no show'))), [heroId], { enabled: !!heroId });
  const seatsLeft = heroSeats.data?.summary.availableSeats;

  const rows: FilmRow[] = useMemo(() => {
    const m = new Map<number, FilmRow>();
    for (const s of shows) {
      if (hero && s.showtimeId === hero.showtimeId) continue;
      if (!m.has(s.movieId)) {
        const movie = movieById.get(s.movieId);
        m.set(s.movieId, { movie, movieId: s.movieId, title: movie?.title ?? s.movieTitle, posterUrl: movie?.posterUrl ?? s.posterUrl, times: [] });
      }
      m.get(s.movieId)!.times.push(s);
    }
    return [...m.values()];
  }, [shows, hero, movieById]);

  const [trailerOpen, setTrailerOpen] = useState(false);

  // Picking a date while scrolled down: jump back to the top of that
  // day's list (the strip stays pinned), instead of landing mid-way.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrollY = useRef(0);
  const headH = useRef(0);
  const pickDay = (k: string) => {
    setPicked(k);
    if (scrollY.current > headH.current) scrollRef.current?.scrollTo({ y: headH.current, animated: false });
  };

  const openFilm = (id: number) => router.push({ pathname: '/film/[id]', params: { id: String(id) } });
  const openSeats = (id: number) => router.push({ pathname: '/seats/[showtimeId]', params: { showtimeId: String(id) } });

  const selectedDate = dayFromKey(selected);
  const heroKicker = hero
    ? isToday(new Date(hero.startTime))
      ? `NEXT UP · ${startsIn(hero.startTime, now)}`
      : `FIRST SHOW · ${weekday(selectedDate)} ${selectedDate.getDate()}`
    : '';

  const seatsNote = seatsLeft != null ? (seatsLeft === 0 ? 'FULL' : `${seatsLeft} SEATS LEFT`) : null;
  const heroSpecial = hero ? specials.byShowtime.get(hero.showtimeId) : undefined;
  const heroMeta = hero
    ? dot(
        heroSpecial ? specialLabel(specials.programme(heroSpecial.programme)?.name, heroSpecial.discountPercent) : null,
        clock(hero.startTime),
        hero.screenName.toUpperCase(),
        runtime(heroMovie?.runtimeMinutes),
        heroMovie?.ageRating,
        seatsNote,
      )
    : '';
  const timeTokens = (r: FilmRow) =>
    r.times.map((s) => (
      <TimeToken
        key={s.showtimeId}
        time={clock(s.startTime)}
        note={
          specials.byShowtime.get(s.showtimeId)
            ? `-${Math.round(specials.byShowtime.get(s.showtimeId)!.discountPercent)}%`
            : new Set(r.times.map((t) => t.screenId)).size > 1
              ? s.screenName.replace(/^screen\s*/i, 'S')
              : undefined
        }
        accessibilityLabel={`${r.title} at ${clock(s.startTime)}, ${s.screenName}. Choose seats`}
        onPress={() => openSeats(s.showtimeId)}
      />
    ));
  // ---------------- Tablet, laptop and desktop (website) ----------------
  if (screen.wide) {
    const { content, gutter, inner, desktop } = screen;
    const col = { width: content, alignSelf: 'center' as const, paddingHorizontal: gutter };
    // Desktop: art and marquee side by side; tablet: stacked
    const artW = desktop ? Math.round(inner * 0.62) : inner;
    const artH = Math.round(artW * 0.5625);
    const cols = desktop ? 3 : 2;
    const cardW = Math.floor((inner - (cols - 1) * 28) / cols);
    return (
      <View style={{ flex: 1, backgroundColor: colors.night }}>
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={64}
          stickyHeaderIndices={[1]}
          contentContainerStyle={{ paddingTop: 28 }}>
          <View
            style={[col, styles.wideMast]}
            onLayout={(e) => {
              headH.current = e.nativeEvent.layout.height + 28;
            }}>
            <View style={{ gap: 6 }}>
              <Label color={colors.laterite}>WHAT’S ON</Label>
              <Display size={desktop ? 64 : 52} black accessibilityRole="header">
                {isToday(selectedDate) ? 'Tonight' : `${weekday(selectedDate)} ${selectedDate.getDate()}`}
              </Display>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Label>CINEMA</Label>
              <LocationButton onChange={() => setPicked(null)} />
            </View>
          </View>

          <View style={styles.dateBar}>
            <View style={col}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.dateStrip}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
                {days.map((k, i) => (
                  <DayTab key={k} dayKey={k} index={i} on={k === selected} has={(byDay.get(k)?.length ?? 0) > 0} compact={false} onPress={() => pickDay(k)} />
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={[col, { paddingTop: 28 }]}>
            {req.loading ? (
              <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 0 }}>
                <Shimmer style={{ width: artW, height: artH }} />
                <Shimmer style={{ flex: 1, height: desktop ? artH : 180, backgroundColor: colors.booth }} />
              </View>
            ) : req.error && !req.data ? (
              <ErrorState error={req.error} onRetry={req.reload} />
            ) : !hero ? (
              <Message
                kicker={`${weekday(selectedDate)} ${selectedDate.getDate()}`}
                title="Nothing on the board"
                body={
                  byDay.size === 0
                    ? 'No showtimes are scheduled for the coming week yet. Browse the films and add them to your watchlist.'
                    : 'No more shows that day. Pick another date above.'
                }
                action={<Button label="Browse films" variant="outline" onPress={() => router.push('/films')} />}
              />
            ) : (
              <>
                {/* Next up: the art beside a bone marquee panel */}
                <View style={[styles.heroWide, { flexDirection: desktop ? 'row' : 'column' }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${heroMovie?.title ?? hero.movieTitle}, details`}
                    onPress={() => openFilm(hero.movieId)}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [hovered && { opacity: 0.92 }]}>
                    <Backdrop
                      url={heroMovie?.backdropUrl}
                      fallbackUrl={heroMovie?.posterUrl ?? hero.posterUrl}
                      width={artW}
                      height={artH}
                      title={hero.movieTitle}
                    />
                  </Pressable>
                  <View style={[styles.band, styles.bandWide, desktop && { width: inner - artW, minHeight: artH }]}>
                    <Label color={colors.laterite}>{heroKicker}</Label>
                    <Display size={desktop ? 52 : 46} black color={colors.ink} numberOfLines={3}>
                      {heroMovie?.title ?? hero.movieTitle}
                    </Display>
                    <Mono size={12.5} color={colors.inkSoft}>
                      {heroMeta}
                    </Mono>
                    {heroMovie?.description ? (
                      <Body size={14.5} color={colors.inkSoft} numberOfLines={desktop ? 4 : 3}>
                        {heroMovie.description}
                      </Body>
                    ) : null}
                    <View style={{ flexGrow: 1 }} />
                    <View style={{ gap: 10, marginTop: 8 }}>
                      <Button
                        label={seatsLeft === 0 ? 'Sold out' : `Book ${clock(hero.startTime)}`}
                        disabled={seatsLeft === 0}
                        onPress={() => openSeats(hero.showtimeId)}
                      />
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {heroMovie?.trailerUrl ? (
                          <Button style={{ flex: 1 }} height={46} variant="outlineInk" label="Trailer" onPress={() => setTrailerOpen(true)} />
                        ) : null}
                        <Button style={{ flex: 1 }} height={46} variant="outlineInk" label="Film details" onPress={() => openFilm(hero.movieId)} />
                      </View>
                    </View>
                  </View>
                </View>

                {rows.length > 0 ? (
                  <>
                    <View style={[styles.secHead, { paddingHorizontal: 0, paddingTop: 44, paddingBottom: 18 }]}>
                      <Display size={34}>{isToday(selectedDate) ? 'Later tonight' : 'Also showing'}</Display>
                      <Label>
                        {rows.length} {rows.length === 1 ? 'FILM' : 'FILMS'}
                      </Label>
                    </View>
                    <View style={[styles.cardGrid, { gap: 28 }]}>
                      {rows.map((r) => {
                        const sp = r.times.map((t) => specials.byShowtime.get(t.showtimeId)).find(Boolean);
                        return (
                          <View key={r.movieId} style={[styles.card, { width: cardW }]}>
                            <Pressable accessibilityRole="button" accessibilityLabel={`${r.title}, details`} onPress={() => openFilm(r.movieId)}>
                              <Poster url={r.posterUrl} title={r.title} width={96} meta={r.movie?.ageRating ?? undefined} />
                            </Pressable>
                            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                              <Pressable onPress={() => openFilm(r.movieId)} accessibilityRole="link">
                                <Display size={26} numberOfLines={2} accessibilityRole="text">
                                  {r.title}
                                </Display>
                              </Pressable>
                              <Body size={13} color={colors.dust}>
                                {dot(r.movie?.runtimeMinutes ? `${r.movie.runtimeMinutes} min` : null, r.movie?.ageRating)}
                              </Body>
                              {sp ? <Label color={colors.vip}>{specialLabel(specials.programme(sp.programme)?.name, sp.discountPercent)}</Label> : null}
                              <View style={styles.tokens}>{timeTokens(r)}</View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </>
            )}
          </View>
          <SiteFooter />
        </ScrollView>
        {heroMovie?.trailerUrl ? (
          <TrailerModal url={heroMovie.trailerUrl} title={heroMovie.title} visible={trailerOpen} onClose={() => setTrailerOpen(false)} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.night, paddingTop: insets.top }}>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={64}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingTop: 6, paddingBottom: 32, alignSelf: 'center', width }}
        refreshControl={<RefreshControl refreshing={req.refreshing} onRefresh={req.reload} tintColor={colors.bone} />}>
        <View
          onLayout={(e) => {
            headH.current = e.nativeEvent.layout.height + 6;
          }}>
          {/* Masthead */}
          <View style={styles.mast}>
            <View style={{ gap: 2, flexShrink: 1 }}>
              <Display size={30} black accessibilityRole="header">
                {wide ? 'Tonight' : 'Savannah Cinemas'}
              </Display>
              <LocationButton onChange={() => setPicked(null)} />
            </View>
            {/* On desktop the site header already carries Account / Sign in */}
            {!wide && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={user ? 'Your account' : 'Sign in'}
                onPress={() => (user ? router.navigate('/account') : router.push('/sign-in'))}
                style={({ pressed }) => [user ? null : [styles.avatar, styles.signIn], pressed && { opacity: 0.7 }]}>
                {user ? <Avatar user={user} size={touch} /> : <Mono size={13}>SIGN IN</Mono>}
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.dateBar}>
          {/* Date strip: pinned under the status bar while the films scroll */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateStrip} contentContainerStyle={{ paddingHorizontal: space.gutter }}>
            {days.map((k, i) => (
              <DayTab key={k} dayKey={k} index={i} on={k === selected} has={(byDay.get(k)?.length ?? 0) > 0} compact={true} onPress={() => pickDay(k)} />
            ))}
          </ScrollView>
        </View>

        {req.loading ? (
          <View style={{ paddingTop: 18, gap: 12 }}>
            <Shimmer style={{ marginHorizontal: space.gutter, height: 14, width: 180 }} />
            <Shimmer style={{ width, height: Math.round(width * 0.5625) }} />
            <Shimmer style={{ marginHorizontal: space.gutter, height: 44, width: width * 0.7 }} />
            {[0, 1].map((i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 14, paddingHorizontal: space.gutter, marginTop: 10 }}>
                <Shimmer style={{ width: 64, height: 96 }} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Shimmer style={{ height: 22, width: '70%' }} />
                  <Shimmer style={{ height: 14, width: '45%' }} />
                  <Shimmer style={{ height: 44, width: 150 }} />
                </View>
              </View>
            ))}
          </View>
        ) : req.error && !req.data ? (
          <ErrorState error={req.error} onRetry={req.reload} />
        ) : !hero ? (
          <Message
            kicker={`${weekday(selectedDate)} ${selectedDate.getDate()}`}
            title="Nothing on the board"
            body={
              byDay.size === 0
                ? 'No showtimes are scheduled for the coming week yet. Browse the films and add them to your watchlist.'
                : 'No more shows that day. Pick another date above.'
            }
            action={<Button label="Browse films" variant="outline" onPress={() => router.push('/films')} />}
          />
        ) : (
          <>
            {/* Next up: the art, then a solid marquee band. Nothing on top of the art. */}
            <Label color={colors.laterite} style={styles.kicker}>
              {heroKicker}
            </Label>
            <Pressable accessibilityRole="button" accessibilityLabel={`${heroMovie?.title ?? hero.movieTitle}, details`} onPress={() => openFilm(hero.movieId)}>
              <Backdrop
                url={heroMovie?.backdropUrl}
                fallbackUrl={heroMovie?.posterUrl ?? hero.posterUrl}
                width={width}
                height={Math.round(width * 0.5625)}
                title={hero.movieTitle}
              />
            </Pressable>
            <View style={styles.band}>
              <Display size={44} black color={colors.ink} numberOfLines={3}>
                {heroMovie?.title ?? hero.movieTitle}
              </Display>
              <Mono size={12.5} color={colors.inkSoft}>
                {dot(
                  specials.byShowtime.get(hero.showtimeId)
                    ? specialLabel(
                        specials.programme(specials.byShowtime.get(hero.showtimeId)!.programme)?.name,
                        specials.byShowtime.get(hero.showtimeId)!.discountPercent,
                      )
                    : null,
                  clock(hero.startTime),
                  hero.screenName.toUpperCase(),
                  runtime(heroMovie?.runtimeMinutes),
                  heroMovie?.ageRating,
                  seatsLeft != null ? (seatsLeft === 0 ? 'FULL' : `${seatsLeft} SEATS LEFT`) : null,
                )}
              </Mono>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                <Button
                  style={{ flex: 1 }}
                  label={seatsLeft === 0 ? 'Sold out' : `Book ${clock(hero.startTime)}`}
                  disabled={seatsLeft === 0}
                  onPress={() => openSeats(hero.showtimeId)}
                />
                {heroMovie?.trailerUrl ? (
                  <Button style={{ width: 116 }} variant="outlineInk" label="Trailer" onPress={() => setTrailerOpen(true)} />
                ) : (
                  <Button style={{ width: 116 }} variant="outlineInk" label="Details" onPress={() => openFilm(hero.movieId)} />
                )}
              </View>
            </View>

            {rows.length > 0 ? (
              <>
                <View style={styles.secHead}>
                  <Display size={24}>{isToday(selectedDate) ? 'Later tonight' : 'Also showing'}</Display>
                  <Label>
                    {rows.length} {rows.length === 1 ? 'FILM' : 'FILMS'}
                  </Label>
                </View>
                {rows.map((r, i) => (
                  <View key={r.movieId} style={[styles.row, i < rows.length - 1 && styles.rowRule]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`${r.title}, details`} onPress={() => openFilm(r.movieId)}>
                      <Poster url={r.posterUrl} title={r.title} width={64} size="w185" meta={r.movie?.ageRating ?? undefined} />
                    </Pressable>
                    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                      <Pressable onPress={() => openFilm(r.movieId)} accessibilityRole="link">
                        <Display size={24} numberOfLines={2} accessibilityRole="text">
                          {r.title}
                        </Display>
                      </Pressable>
                      <Body size={13} color={colors.dust}>
                        {dot(r.movie?.runtimeMinutes ? `${r.movie.runtimeMinutes} min` : null, r.movie?.ageRating)}
                      </Body>
                      {(() => {
                        const sp = r.times.map((t) => specials.byShowtime.get(t.showtimeId)).find(Boolean);
                        return sp ? <Label color={colors.vip}>{specialLabel(specials.programme(sp.programme)?.name, sp.discountPercent)}</Label> : null;
                      })()}
                      <View style={styles.tokens}>
                        {r.times.map((s) => (
                          <TimeToken
                            key={s.showtimeId}
                            time={clock(s.startTime)}
                            note={
                              specials.byShowtime.get(s.showtimeId)
                                ? `-${Math.round(specials.byShowtime.get(s.showtimeId)!.discountPercent)}%`
                                : new Set(r.times.map((t) => t.screenId)).size > 1
                                  ? s.screenName.replace(/^screen\s*/i, 'S')
                                  : undefined
                            }
                            accessibilityLabel={`${r.title} at ${clock(s.startTime)}, ${s.screenName}. Choose seats`}
                            onPress={() => openSeats(s.showtimeId)}
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
        <SiteFooter />
      </ScrollView>
      {heroMovie?.trailerUrl ? (
        <TrailerModal url={heroMovie.trailerUrl} title={heroMovie.title} visible={trailerOpen} onClose={() => setTrailerOpen(false)} />
      ) : null}
    </View>
  );
}

/** One date in the strip under the masthead. */
function DayTab({
  dayKey: k,
  index,
  on,
  has,
  compact,
  onPress,
}: {
  dayKey: string;
  index: number;
  on: boolean;
  has: boolean;
  compact: boolean;
  onPress: () => void;
}) {
  const d = dayFromKey(k);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${index === 0 ? 'Tonight' : weekday(d)} ${d.getDate()}${has ? '' : ', no shows'}`}
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.day,
        !compact && styles.dayWide,
        on && styles.dayOn,
        hovered && !on && { borderBottomColor: colors.rule },
      ]}>
      <Mono size={11} color={on ? colors.laterite : colors.dust} bold={on}>
        {index === 0 ? 'TONIGHT' : weekday(d)}
      </Mono>
      <Display size={20} color={on ? colors.bone : has ? colors.dust : colors.disabled} accessibilityRole="text">
        {index === 0 ? `${weekday(d)} ${d.getDate()}` : String(d.getDate())}
      </Display>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    paddingBottom: space.md,
    gap: space.md,
  },
  avatar: {
    minWidth: touch,
    height: touch,
    borderRadius: touch / 2,
    borderWidth: 1.5,
    borderColor: colors.bone,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signIn: { borderRadius: 3, paddingHorizontal: 12 },
  dateBar: { backgroundColor: colors.night },
  dateStrip: { borderBottomWidth: 1, borderBottomColor: colors.rule, flexGrow: 0 },
  day: { width: 72, height: 56, justifyContent: 'center', gap: 2, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  dayOn: { borderBottomColor: colors.laterite },
  kicker: { paddingHorizontal: space.gutter, paddingTop: 18, paddingBottom: 10 },
  band: { backgroundColor: colors.bone, paddingHorizontal: space.gutter, paddingTop: 16, paddingBottom: 18, gap: 8 },
  secHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: space.gutter,
    paddingTop: 24,
    paddingBottom: 12,
  },
  row: { flexDirection: 'row', gap: 14, paddingHorizontal: space.gutter, paddingBottom: 16, marginBottom: 16 },
  rowRule: { borderBottomWidth: 1, borderBottomColor: colors.rule },
  tokens: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  // Website (tablet and up)
  wideMast: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 18, gap: 24 },
  dayWide: { width: undefined, minWidth: 64, paddingHorizontal: 4 },
  heroWide: { borderWidth: 1.5, borderColor: colors.bone, borderRadius: 4, overflow: 'hidden' },
  bandWide: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 28, gap: 12 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { flexDirection: 'row', gap: 18, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.rule },
});
