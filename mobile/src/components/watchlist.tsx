import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Poster } from '@/components/artwork';
import { Button, IconButton, TimeToken } from '@/components/controls';
import { BookmarkIcon } from '@/components/icons';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clock, dot, isToday, rating, shortDate, year } from '@/lib/format';
import type { Movie, ShowtimeListItem, WatchlistItem } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useRequest } from '@/lib/use-request';
import { colors, space } from '@/theme';

const MAX_W = 560;

type Row = { w: WatchlistItem; movie?: Movie; next?: ShowtimeListItem };

/**
 * Films you've saved, each with its next show so you can go straight to
 * seats. Showing films first, soonest first; then coming soon; then the rest.
 *
 * Used by the Watchlist screen (scrolls itself) and the Account tab
 * (embedded: inside Account's own scroll view).
 */
export function WatchlistBody({ embedded = false, onCount }: { embedded?: boolean; onCount?: (n: number) => void }) {
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const { user } = useAuth();
  const now = useNow();

  const req = useRequest(
    async () => {
      const [list, showtimes, movies] = await Promise.all([
        api.watchlist(),
        api.showtimes().catch(() => [] as ShowtimeListItem[]),
        api.movies().catch(() => [] as Movie[]),
      ]);
      return { list, showtimes, movies };
    },
    [user?.userId],
    { enabled: !!user },
  );

  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);

  const rows: Row[] = useMemo(() => {
    if (!req.data) return [];
    const byMovie = new Map(req.data.movies.map((m) => [m.movieId, m]));
    const nextShow = new Map<number, ShowtimeListItem>();
    for (const s of req.data.showtimes) {
      if (!s.isActive || s.status === 'CANCELLED' || new Date(s.startTime).getTime() <= now) continue;
      const cur = nextShow.get(s.movieId);
      if (!cur || new Date(s.startTime) < new Date(cur.startTime)) nextShow.set(s.movieId, s);
    }
    const rank = (r: Row) => (r.next ? 0 : r.movie?.status === 'UPCOMING' || r.movie?.status === 'COMING_SOON' ? 1 : 2);
    return req.data.list
      .filter((w) => !removed.has(w.filmId))
      .map((w) => ({ w, movie: byMovie.get(w.filmId), next: nextShow.get(w.filmId) }))
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.next && b.next ? +new Date(a.next.startTime) - +new Date(b.next.startTime) : 0) ||
          a.w.title.localeCompare(b.w.title),
      );
  }, [req.data, removed, now]);

  const remove = async (filmId: number) => {
    setBusy(filmId);
    setRemoved((s) => new Set(s).add(filmId));
    try {
      await api.removeFromWatchlist(filmId);
    } catch {
      // Put it back if the server said no
      setRemoved((s) => {
        const n = new Set(s);
        n.delete(filmId);
        return n;
      });
    } finally {
      setBusy(null);
    }
  };

  const open = (id: number) => router.push({ pathname: '/film/[id]', params: { id: String(id) } });

  const count = req.data ? rows.length : null;
  useEffect(() => {
    if (count != null) onCount?.(count);
  }, [count, onCount]);

  const List = embedded ? View : ScrollView;
  const listProps = embedded
    ? {}
    : {
        contentContainerStyle: { width, alignSelf: 'center' as const, paddingBottom: 40 },
        refreshControl: <RefreshControl refreshing={req.refreshing} onRefresh={req.reload} tintColor={colors.bone} />,
      };

  return (
    <View style={embedded ? undefined : { flex: 1 }}>
      {!user ? (
        <Message
          kicker="WATCHLIST"
          title="Keep a list of films to catch"
          body="Sign in to save films and see when they're showing."
          action={<Button label="Sign in" onPress={() => router.push('/sign-in')} />}
        />
      ) : req.loading ? (
        <View style={{ paddingHorizontal: space.gutter, gap: 16, paddingTop: 8 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 14 }}>
              <Shimmer style={{ width: 72, height: 108 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Shimmer style={{ height: 24, width: '70%' }} />
                <Shimmer style={{ height: 14, width: '40%' }} />
                <Shimmer style={{ height: 44, width: 120 }} />
              </View>
            </View>
          ))}
        </View>
      ) : req.error && !req.data ? (
        <ErrorState error={req.error} onRetry={req.reload} />
      ) : rows.length === 0 ? (
        <Message
          title="Nothing saved yet"
          body="Tap the bookmark on any film and it lands here, with its next showtime."
          action={<Button label="Browse films" variant="outline" onPress={() => router.navigate('/films')} />}
        />
      ) : (
        <List {...listProps}>
          {rows.map(({ w, movie, next }, i) => {
            const upcoming = movie?.status === 'UPCOMING' || movie?.status === 'COMING_SOON';
            const nextDay = next ? new Date(next.startTime) : null;
            return (
              <View key={w.filmId} style={[styles.row, i < rows.length - 1 && styles.rule]}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${w.title}, details`} onPress={() => open(w.filmId)}>
                  <Poster url={movie?.posterUrl ?? w.poster} title={w.title} width={72} size="w185" meta={year(movie?.releaseDate) ?? (w.year ? String(w.year) : null)} />
                </Pressable>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => open(w.filmId)} accessibilityRole="link">
                      <Display size={24} numberOfLines={2} accessibilityRole="text">
                        {w.title}
                      </Display>
                    </Pressable>
                    <IconButton
                      label={`Remove ${w.title} from watchlist`}
                      onPress={busy === w.filmId ? undefined : () => remove(w.filmId)}
                      style={{ marginTop: -6, marginRight: -10 }}>
                      <BookmarkIcon filled color={colors.laterite} />
                    </IconButton>
                  </View>
                  <Body size={13} color={colors.dust}>
                    {dot(year(movie?.releaseDate) ?? (w.year ? String(w.year) : null), movie?.ageRating, rating(movie?.rating ?? w.rating))}
                  </Body>
                  {next && nextDay ? (
                    <View style={{ gap: 6 }}>
                      <Label color={colors.laterite}>
                        NEXT SHOW · {isToday(nextDay) ? 'TONIGHT' : shortDate(nextDay)}
                      </Label>
                      <View style={{ flexDirection: 'row' }}>
                        <TimeToken
                          time={clock(next.startTime)}
                          note={next.screenName.replace(/^screen\s*/i, 'S')}
                          accessibilityLabel={`Book ${w.title} at ${clock(next.startTime)}`}
                          onPress={() => router.push({ pathname: '/seats/[showtimeId]', params: { showtimeId: String(next.showtimeId) } })}
                        />
                      </View>
                    </View>
                  ) : (
                    <Mono size={11.5} color={colors.dust}>
                      {upcoming
                        ? `COMING SOON${movie?.releaseDate ? ` · ${shortDate(new Date(movie.releaseDate))}` : ''}`
                        : 'NOT SCHEDULED RIGHT NOW'}
                    </Mono>
                  )}
                </View>
              </View>
            );
          })}
        </List>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, paddingHorizontal: space.gutter, paddingVertical: 16 },
  rule: { borderBottomWidth: 1, borderBottomColor: colors.rule },
});
