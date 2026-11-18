import { router } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import { colors, space, touch } from '@/theme';

// Matches the showtime generator's fortnight
const DAYS_AHEAD = 14;
const MAX_W = 560;

type FilmRow = { movie: Movie | undefined; movieId: number; title: string; posterUrl?: string | null; times: ShowtimeListItem[] };

export default function Tonight() {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
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
  const heroSeats = useRequest(
    () => (heroId ? api.showtimeSeats(heroId) : Promise.reject(new Error('no show'))),
    [heroId],
    { enabled: !!heroId },
  );
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
                Savannah Cinemas
              </Display>
              <LocationButton onChange={() => setPicked(null)} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={user ? 'Your account' : 'Sign in'}
              onPress={() => (user ? router.navigate('/account') : router.push('/sign-in'))}
              style={({ pressed }) => [user ? null : [styles.avatar, styles.signIn], pressed && { opacity: 0.7 }]}>
              {user ? <Avatar user={user} size={touch} /> : <Mono size={13}>SIGN IN</Mono>}
            </Pressable>
          </View>

        </View>

        <View style={styles.dateBar}>
          {/* Date strip: pinned under the status bar while the films scroll */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateStrip} contentContainerStyle={{ paddingHorizontal: space.gutter }}>
            {days.map((k, i) => {
              const d = dayFromKey(k);
              const on = k === selected;
              const has = (byDay.get(k)?.length ?? 0) > 0;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${i === 0 ? 'Tonight' : weekday(d)} ${d.getDate()}${has ? '' : ', no shows'}`}
                  onPress={() => pickDay(k)}
                  style={[styles.day, on && styles.dayOn]}>
                  <Mono size={11} color={on ? colors.laterite : colors.dust} bold={on}>
                    {i === 0 ? 'TONIGHT' : weekday(d)}
                  </Mono>
                  <Display size={20} color={on ? colors.bone : has ? colors.dust : colors.disabled} accessibilityRole="text">
                    {i === 0 ? `${weekday(d)} ${d.getDate()}` : String(d.getDate())}
                  </Display>
                </Pressable>
              );
            })}
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
                    ? specialLabel(specials.programme(specials.byShowtime.get(hero.showtimeId)!.programme)?.name, specials.byShowtime.get(hero.showtimeId)!.discountPercent)
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
                  <Button
                    style={{ width: 116 }}
                    variant="outlineInk"
                    label="Trailer"
                    onPress={() => setTrailerOpen(true)}
                  />
                ) : (
                  <Button style={{ width: 116 }} variant="outlineInk" label="Details" onPress={() => openFilm(hero.movieId)} />
                )}
              </View>
            </View>

            {rows.length > 0 ? (
              <>
                <View style={styles.secHead}>
                  <Display size={24}>{isToday(selectedDate) ? 'Later tonight' : 'Also showing'}</Display>
                  <Label>{rows.length} {rows.length === 1 ? 'FILM' : 'FILMS'}</Label>
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
                        return sp ? (
                          <Label color={colors.vip}>{specialLabel(specials.programme(sp.programme)?.name, sp.discountPercent)}</Label>
                        ) : null;
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
      </ScrollView>
      {heroMovie?.trailerUrl ? (
        <TrailerModal url={heroMovie.trailerUrl} title={heroMovie.title} visible={trailerOpen} onClose={() => setTrailerOpen(false)} />
      ) : null}
    </View>
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
});

