import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Backdrop, Poster } from '@/components/artwork';
import { CastRow } from '@/components/cast-row';
import { Button, IconButton, TimeToken } from '@/components/controls';
import { goBack } from '@/components/header';
import { BackIcon, BellIcon, BookmarkIcon, PlayIcon } from '@/components/icons';
import { LocationButton } from '@/components/location-picker';
import { RemindBell } from '@/components/remind-bell';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { TrailerModal } from '@/components/trailer';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { locationName, setLocation, useLocation } from '@/lib/location';
import { specialLabel, useSpecials } from '@/lib/specials';
import { useFilmReminder } from '@/lib/notify';
import { clock, dayFromKey, dayKey, dot, isToday, opens, rating, releaseDay, runtime, shortDate, titleCase, weekday, year } from '@/lib/format';
import type { MovieShowtime } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useRequest } from '@/lib/use-request';
import { usePageWidth } from '@/lib/layout';
import { colors, radius, space } from '@/theme';

const MAX_W = 560;

export default function FilmDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const movieId = Number(id);
  const insets = useSafeAreaInsets();
  // Wider on desktop web (lib/layout)
  const width = usePageWidth(MAX_W, 820);
  const { user } = useAuth();
  const now = useNow();
  const [reminded, toggleReminder] = useFilmReminder(movieId);

  const req = useRequest(async () => {
    const [movie, showtimes] = await Promise.all([api.movieDetails(movieId), api.movieShowtimes(movieId).catch(() => [] as MovieShowtime[])]);
    return { movie, showtimes };
  }, [movieId]);

  // Watchlist membership
  const wl = useRequest(() => api.watchlist(), [user?.userId], { enabled: !!user });
  const saved = !!wl.data?.some((w) => w.filmId === movieId);
  const [savingWl, setSavingWl] = useState(false);
  const toggleWatchlist = async () => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    if (!req.data) return;
    setSavingWl(true);
    try {
      if (saved) await api.removeFromWatchlist(movieId);
      else await api.addToWatchlist(req.data.movie);
      await wl.reload();
    } catch {
      await wl.reload();
    } finally {
      setSavingWl(false);
    }
  };

  // Showtimes at the chosen location, grouped by local day
  const { cinemaId: here, cinemas } = useLocation();
  const upcomingShows = useMemo(() => (req.data?.showtimes ?? []).filter((s) => new Date(s.startTime).getTime() > now), [req.data, now]);
  const elsewhere = useMemo(() => {
    if (here == null) return null;
    const ids = new Set(upcomingShows.filter((s) => Number(s.cinema.cinemaId) !== here).map((s) => Number(s.cinema.cinemaId)));
    return cinemas.find((c) => ids.has(c.cinemaId)) ?? null;
  }, [upcomingShows, here, cinemas]);
  const specials = useSpecials();
  const filmSpecial = useMemo(
    () => upcomingShows.map((s) => specials.byShowtime.get(s.showtimeId)).find((x) => x && (here == null || x.cinemaId === here)) ?? null,
    [upcomingShows, specials.byShowtime, here],
  );
  const days = useMemo(() => {
    const m = new Map<string, MovieShowtime[]>();
    for (const s of upcomingShows) {
      if (here != null && Number(s.cinema.cinemaId) !== here) continue;
      const k = dayKey(s.startTime);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [upcomingShows, here]);

  const [dayPick, setDayPick] = useState<string | null>(null);
  const day = dayPick ?? days[0]?.[0] ?? null;
  const dayShows = useMemo(() => days.find(([k]) => k === day)?.[1] ?? [], [days, day]);

  // Group by screen within the day
  const screens = useMemo(() => {
    const m = new Map<string, { name: string; type?: string | null; cinema: string; shows: MovieShowtime[] }>();
    for (const s of dayShows) {
      const key = `${s.cinema.cinemaId}:${s.screen.screenId}`;
      if (!m.has(key)) m.set(key, { name: s.screen.name, type: s.screen.type, cinema: s.cinema.name, shows: [] });
      m.get(key)!.shows.push(s);
    }
    return [...m.values()];
  }, [dayShows]);
  const multiCinema = new Set(dayShows.map((s) => s.cinema.cinemaId)).size > 1;

  // A pick only counts for the day it was made on.
  const [chosen, setChosen] = useState<{ day: string | null; id: number } | null>(null);
  const chosenShow = dayShows.find((s) => chosen?.day === day && s.showtimeId === chosen.id) ?? dayShows[0];

  const [moreSyn, setMoreSyn] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const heroH = Math.round(width * 0.64);

  if (req.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night, alignItems: 'center' }}>
        <View style={{ width }}>
          <Shimmer style={{ width, height: heroH }} />
          <View style={{ padding: space.gutter, gap: 12 }}>
            <Shimmer style={{ height: 40, width: '75%' }} />
            <Shimmer style={{ height: 14, width: '50%' }} />
            <Shimmer style={{ height: 70 }} />
          </View>
        </View>
        <IconButton label="Back" onPress={() => goBack()} style={[styles.navBtn, { top: insets.top + 8, left: 16 }]}>
          <BackIcon />
        </IconButton>
      </View>
    );
  }

  if (req.error || !req.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night, paddingTop: insets.top + 60 }}>
        <ErrorState error={req.error!} onRetry={req.reload} />
        <IconButton label="Back" onPress={() => goBack()} style={[styles.navBtn, { top: insets.top + 8, left: 16 }]}>
          <BackIcon />
        </IconButton>
      </View>
    );
  }

  const m = req.data.movie;
  const director = m.crew?.find((c) => c.job === 'Director')?.name;
  const cast = m.cast ?? [];
  const genres = (m.genres ?? []).map((g) => g.name).slice(0, 3);
  const isUpcoming = m.status === 'UPCOMING' || m.status === 'COMING_SOON';

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <ScrollView contentContainerStyle={{ width, alignSelf: 'center', paddingBottom: 140 }}>
        {/* Backdrop untouched; controls sit on solid tiles */}
        <View style={{ width, height: heroH }}>
          <Backdrop url={m.backdropUrl} fallbackUrl={m.posterUrl} width={width} height={heroH} title={m.title} />
          {m.trailerUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play ${m.title} trailer`}
              onPress={() => setTrailerOpen(true)}
              style={({ pressed }) => [styles.trailer, pressed && { opacity: 0.85 }]}>
              <PlayIcon />
              <Mono size={12.5} color={colors.ink}>
                TRAILER
              </Mono>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.titleRow} pointerEvents="box-none">
          <Poster url={m.posterUrl} title={m.title} width={104} size="w342" border={colors.night} meta={year(m.releaseDate)} />
          <View style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end', gap: 8, paddingTop: 52 }}>
            <Display size={m.title.length > 22 ? 34 : 44} black numberOfLines={4}>
              {m.title}
            </Display>
            <Label>{dot(opens(m.releaseDate) ?? year(m.releaseDate), runtime(m.runtimeMinutes), m.ageRating, rating(m.rating))}</Label>
          </View>
        </View>

        {genres.length ? (
          <Body size={13} color={colors.dust} style={{ paddingHorizontal: space.gutter, marginTop: 12 }}>
            {genres.join(' · ')}
          </Body>
        ) : null}

        {m.description ? (
          <Pressable onPress={() => setMoreSyn((v) => !v)} accessibilityRole="button" accessibilityHint={moreSyn ? 'Show less' : 'Show full synopsis'}>
            <Body style={{ paddingHorizontal: space.gutter, marginTop: 10 }} numberOfLines={moreSyn ? undefined : 3}>
              {m.description}
            </Body>
          </Pressable>
        ) : null}
        <CastRow cast={cast} director={director} />

        {/* Showtimes */}
        <View style={styles.showHead}>
          <Display size={24}>Showtimes</Display>
          <LocationButton onChange={() => setDayPick(null)} />
        </View>
        {filmSpecial ? (
          <View style={styles.special}>
            <Label color={colors.ink}>{specialLabel(specials.programme(filmSpecial.programme)?.name, filmSpecial.discountPercent)}</Label>
            <Body size={13.5} color={colors.ink}>
              {specials.programme(filmSpecial.programme)?.tagline ?? 'Back on the big screen for one night.'}
            </Body>
          </View>
        ) : null}
        {days.length === 0 && elsewhere ? (
          <Message
            style={{ paddingTop: 12 }}
            title={`Not at ${locationName(cinemas.find((c) => c.cinemaId === here))}`}
            body={`${m.title} is playing at ${locationName(elsewhere)}.`}
            action={<Button label={`See ${locationName(elsewhere)} times`} variant="outline" onPress={() => setLocation(elsewhere.cinemaId)} />}
          />
        ) : days.length === 0 ? (
          <Message
            style={{ paddingTop: 12 }}
            title={isUpcoming ? 'Not on sale yet' : 'No upcoming shows'}
            body={
              isUpcoming && releaseDay(m.releaseDate)
                ? `Opens ${titleCase(shortDate(releaseDay(m.releaseDate)!))}. Tickets go on sale once its first shows are programmed. Save it and it’ll be waiting in your watchlist.`
                : 'Nothing is scheduled for this film right now. Save it to your watchlist to keep track.'
            }
          />
        ) : null}
        {days.length === 0 && isUpcoming ? (
          <View style={{ paddingHorizontal: space.gutter, paddingTop: 14 }}>
            <RemindBell movieId={movieId} title={m.title} variant="button" />
          </View>
        ) : null}
        {days.length === 0 ? null : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 18 }}>
              {days.map(([k]) => {
                const d = dayFromKey(k);
                const on = k === day;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setDayPick(k)}
                    style={[styles.dayTab, on && { borderBottomColor: colors.laterite }]}>
                    <Mono size={12} color={on ? colors.laterite : colors.dust}>
                      {isToday(d) ? 'TODAY' : `${weekday(d)} ${d.getDate()}`}
                    </Mono>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ paddingHorizontal: space.gutter, paddingTop: 14, gap: 16 }}>
              {screens.map((sc) => (
                <View key={`${sc.cinema}-${sc.name}`} style={{ gap: 8 }}>
                  <Body size={13} color={colors.dust}>
                    <Body size={13} weight="bold" color={colors.bone}>
                      {sc.name}
                    </Body>
                    {(() => {
                      const extra = dot(sc.type ? titleCase(sc.type) : null, multiCinema ? sc.cinema : null);
                      return extra ? ` · ${extra}` : '';
                    })()}
                  </Body>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {sc.shows.map((s) => (
                      <TimeToken
                        key={s.showtimeId}
                        time={clock(s.startTime)}
                        state={chosenShow?.showtimeId === s.showtimeId ? 'chosen' : 'open'}
                        note={specials.byShowtime.get(s.showtimeId) ? `-${Math.round(specials.byShowtime.get(s.showtimeId)!.discountPercent)}%` : undefined}
                        accessibilityLabel={`${clock(s.startTime)}, ${sc.name}`}
                        onPress={() => setChosen({ day, id: s.showtimeId })}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Solid nav tiles over the art */}
      <IconButton label="Back" onPress={() => goBack()} style={[styles.navBtn, { top: insets.top + 8, left: 16 }]}>
        <BackIcon />
      </IconButton>
      {isUpcoming ? (
        <IconButton
          label={reminded ? `Turn off reminder for ${m.title}` : `Remind me when ${m.title} opens`}
          onPress={toggleReminder}
          style={[styles.navBtn, { top: insets.top + 8, right: 16 + 52 }]}>
          <BellIcon filled={reminded} color={reminded ? colors.laterite : colors.bone} />
        </IconButton>
      ) : null}
      <IconButton
        label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
        onPress={savingWl ? undefined : toggleWatchlist}
        style={[styles.navBtn, { top: insets.top + 8, right: 16 }, savingWl && { opacity: 0.5 }]}>
        <BookmarkIcon filled={saved} color={saved ? colors.laterite : colors.bone} />
      </IconButton>

      {chosenShow ? (
        <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Label numberOfLines={1}>{dot(day ? (isToday(dayFromKey(day)) ? 'TODAY' : `${weekday(dayFromKey(day))} ${dayFromKey(day).getDate()}`) : null, chosenShow.screen.name.toUpperCase().replace(/^SCREEN\s*/, 'SCR '))}</Label>
            <Mono size={20}>{clock(chosenShow.startTime)}</Mono>
          </View>
          <Button
            style={{ flex: 1.4 }}
            label="Choose seats"
            onPress={() => router.push({ pathname: '/seats/[showtimeId]', params: { showtimeId: String(chosenShow.showtimeId) } })}
          />
        </View>
      ) : null}
      {m.trailerUrl ? <TrailerModal url={m.trailerUrl} title={m.title} visible={trailerOpen} onClose={() => setTrailerOpen(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  navBtn: { position: 'absolute' },
  trailer: {
    position: 'absolute',
    right: 16,
    // Sits above the poster/title overlap (titleRow is pulled up 44pt)
    bottom: 58,
    height: 40,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 3,
    backgroundColor: colors.bone,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleRow: { flexDirection: 'row', gap: 16, paddingHorizontal: space.gutter, marginTop: -44 },
  special: {
    marginHorizontal: space.gutter,
    marginTop: 12,
    padding: 12,
    gap: 4,
    backgroundColor: colors.vip,
    borderRadius: radius.action,
  },
  showHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: space.gutter,
    marginTop: 22,
    paddingTop: 14,
    paddingBottom: 6,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
  },
  dayTab: { height: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: space.gutter,
    paddingTop: 12,
    backgroundColor: colors.night,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
});
