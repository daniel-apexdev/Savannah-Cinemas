import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Poster } from '@/components/artwork';
import { RemindBell } from '@/components/remind-bell';
import { BookmarkIcon, CloseIcon, SearchIcon } from '@/components/icons';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { Body, Display, Label, Mono } from '@/components/type';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clock, dayKey, dot, isToday, opens, rating, runtime, shortDate, toNumber, year } from '@/lib/format';
import { useLocation } from '@/lib/location';
import { setSetting, useSetting, type FilmsLayout } from '@/lib/settings';
import type { Movie, ShowtimeListItem } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useRequest } from '@/lib/use-request';
import { usePageWidth, useScreen } from '@/lib/layout';
import { SiteFooter } from '@/components/site-footer';
import { colors, fonts, isWeb, space } from '@/theme';

type Shelf = 'now' | 'coming';
const MAX_W = 560;
const GAP = 10;

export default function Films() {
  const insets = useSafeAreaInsets();
  // Website on tablet/desktop: full site column, more posters per row
  const screen = useScreen();
  const phoneW = usePageWidth(MAX_W);
  const width = screen.wide ? screen.content : phoneW;
  const gut = screen.wide ? screen.gutter : space.gutter;
  const inner = width - gut * 2;
  const { user } = useAuth();
  const [shelf, setShelf] = useState<Shelf>('now');
  // Count for the Watchlist link (the list itself has its own screen)
  const saved = useRequest(() => api.watchlist(), [user?.userId], { enabled: !!user });

  // Best-rated first so the feature slot goes to a headline film.
  const nowShowing = useRequest(
    async () => (await api.nowShowing()).sort((a, b) => toNumber(b.rating) - toNumber(a.rating) || a.title.localeCompare(b.title)),
    [],
  );
  const coming = useRequest(() => api.upcoming(), []);

  // How the shelf is laid out (remembered on the device)
  const layout = useSetting('filmsLayout');
  // The Index view lists each film's next shows
  const shows = useRequest(() => api.showtimes(), [], { enabled: layout === 'index' });
  const now = useNow();
  const { cinemaId: here } = useLocation();
  const nextShows = useMemo(() => {
    const m = new Map<number, ShowtimeListItem[]>();
    for (const s of shows.data ?? []) {
      if (!s.isActive || s.status === 'CANCELLED' || s.status === 'COMPLETED') continue;
      if (new Date(s.startTime).getTime() <= now) continue;
      if (here != null && Number(s.cinemaId) !== here) continue;
      if (!m.has(s.movieId)) m.set(s.movieId, []);
      m.get(s.movieId)!.push(s);
    }
    m.forEach((l) => l.sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime)));
    return m;
  }, [shows.data, now, here]);

  // Search (server-side, title/description ILIKE). Results are stored
  // with the term they answer, so stale responses never show.
  const [q, setQ] = useState('');
  const term = q.trim();
  const [searchNonce, setSearchNonce] = useState(0);
  const [answer, setAnswer] = useState<{ key: string; list: Movie[] | null; error: ApiError | null }>({ key: '', list: null, error: null });
  const searchKey = `${term.toLowerCase()}#${searchNonce}`;
  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api
        .search(term, ctrl.signal)
        .then((list) => setAnswer({ key: searchKey, list, error: null }))
        .catch((e) => {
          if (!ctrl.signal.aborted) setAnswer({ key: searchKey, list: null, error: e });
        });
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, searchKey]);
  const answered = answer.key === searchKey;
  const searching = term.length >= 2 && !answered;
  const results = answered ? answer.list : null;
  const searchError = answered ? answer.error : null;

  const active = shelf === 'now' ? nowShowing : coming;
  const isSearch = term.length >= 2;
  const list = isSearch ? (results ?? []) : (active.data ?? []);
  const remind = !isSearch && shelf === 'coming';
  const loading = isSearch ? searching : active.loading;
  const error = isSearch ? searchError : active.error;

  const open = (m: Movie) => router.push({ pathname: '/film/[id]', params: { id: String(m.movieId) } });

  const shelves: { key: Shelf; label: string; count?: number }[] = [
    { key: 'now', label: 'NOW', count: nowShowing.data?.length },
    { key: 'coming', label: 'COMING', count: coming.data?.length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 32, width, alignSelf: 'center' }}
        refreshControl={!isSearch ? <RefreshControl refreshing={active.refreshing} onRefresh={active.reload} tintColor={colors.bone} /> : undefined}>
        <View style={{ paddingHorizontal: gut, gap: 14, paddingTop: screen.wide ? 22 : 0 }}>
          <View style={screen.wide ? styles.wideHead : null}>
            <Display size={screen.desktop ? 64 : 52} black>
              {isSearch ? 'Search' : shelf === 'now' ? 'Now showing' : 'Coming soon'}
            </Display>

            <View style={[styles.search, screen.wide && { width: screen.desktop ? 380 : 300 }]}>
              <SearchIcon />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search films"
                placeholderTextColor={colors.dust}
                selectionColor={colors.laterite}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search films"
                style={styles.searchInput}
              />
              {q ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQ('')} hitSlop={10} style={styles.clear}>
                  <CloseIcon size={16} color={colors.dust} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {!isSearch ? (
            <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }} accessibilityRole="tablist">
              {shelves.map((s) => {
                const on = s.key === shelf;
                return (
                  <Pressable
                    key={s.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setShelf(s.key)}
                    style={[styles.shelf, on && styles.shelfOn]}>
                    <Mono size={12} color={on ? colors.bone : colors.dust}>
                      {s.count != null ? `${s.label} · ${s.count}` : s.label}
                    </Mono>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Open your watchlist"
                onPress={() => router.push('/watchlist')}
                style={[styles.shelf, { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <BookmarkIcon size={14} color={colors.lateriteSoft} filled={(saved.data?.length ?? 0) > 0} />
                <Mono size={12} color={colors.lateriteSoft}>
                  {user && saved.data ? `WATCHLIST · ${saved.data.length}` : 'WATCHLIST'}
                </Mono>
              </Pressable>
            </View>
          ) : (
            <Label>
              {searching ? 'SEARCHING…' : `${results?.length ?? 0} ${(results?.length ?? 0) === 1 ? 'RESULT' : 'RESULTS'} FOR “${term.toUpperCase()}”`}
            </Label>
          )}
        </View>

        <View style={[styles.viewBar, { paddingHorizontal: gut }]}>
          <Label>{loading ? ' ' : `${list.length} ${list.length === 1 ? 'FILM' : 'FILMS'}`}</Label>
          <LayoutSwitch value={layout} onChange={(v) => setSetting('filmsLayout', v)} />
        </View>

        <View style={{ paddingTop: 12 }}>
          {loading ? (
            screen.wide ? (
              <View style={{ paddingHorizontal: gut, flexDirection: 'row', gap: 18 }}>
                {Array.from({ length: screen.desktop ? 5 : 4 }, (_, i) => (
                  <Shimmer key={i} style={{ flex: 1, aspectRatio: 2 / 3 }} />
                ))}
              </View>
            ) : (
              <WallSkeleton width={width} />
            )
          ) : error && list.length === 0 ? (
            <ErrorState error={error} onRetry={isSearch ? () => setSearchNonce((n) => n + 1) : active.reload} />
          ) : list.length === 0 ? (
            <Message
              title={isSearch ? 'No films match' : 'Nothing here yet'}
              body={isSearch ? 'Try a shorter title or an actor’s name.' : 'Check back soon. New films are added as they’re programmed.'}
            />
          ) : layout === 'grid' ? (
            <Grid movies={list} inner={inner} gutter={gut} cols={screen.desktop ? 7 : screen.wide ? 5 : undefined} onOpen={open} remind={remind} />
          ) : layout === 'index' ? (
            <Index
              movies={list}
              onOpen={open}
              nextShows={nextShows}
              showsLoaded={!!shows.data}
              now={now}
              remind={remind}
              gutter={gut}
              columns={screen.desktop ? 2 : 1}
              inner={inner}
            />
          ) : screen.wide ? (
            // Website: the wall becomes a row of big posters with titles
            <Grid movies={list} inner={inner} gutter={gut} cols={screen.desktop ? 5 : 4} big onOpen={open} remind={remind} />
          ) : (
            <Wall movies={list} width={width} onOpen={open} remind={remind} />
          )}
        </View>
        <SiteFooter />
      </ScrollView>
    </View>
  );
}

/** Poster wall: a large poster with two stacked beside it, then a row of three; repeat. */
function Wall({ movies, width: full, onOpen, remind }: { movies: Movie[]; width: number; onOpen: (m: Movie) => void; remind?: boolean }) {
  // The wall reads best up to tablet width; on desktop it sits centred
  const width = Math.min(full, 820);
  const inner = width - space.gutter * 2;
  const small = Math.floor((inner - GAP - GAP / 1.5) / 3);
  const big = inner - GAP - small;
  const third = Math.floor((inner - GAP * 2) / 3);

  const groups = useMemo(() => {
    const out: { kind: 'feature' | 'row'; items: Movie[] }[] = [];
    let i = 0;
    let feature = true;
    while (i < movies.length) {
      out.push({ kind: feature ? 'feature' : 'row', items: movies.slice(i, i + 3) });
      i += 3;
      feature = !feature;
    }
    return out;
  }, [movies]);

  const cell = (m: Movie, w: number, size: 'w185' | 'w342' | 'w500') => (
    <Pressable
      key={m.movieId}
      accessibilityRole="button"
      accessibilityLabel={`${m.title}${m.ageRating ? `, ${m.ageRating}` : ''}`}
      onPress={() => onOpen(m)}
      style={({ pressed }) => pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }}>
      <Poster url={m.posterUrl} title={m.title} meta={opens(m.releaseDate) ? null : dot(year(m.releaseDate), m.ageRating)} width={w} size={size} />
      {opens(m.releaseDate) ? (
        <View style={styles.opensTag} pointerEvents="none">
          <Mono size={w > 200 ? 11 : 9} color={colors.night}>
            {opens(m.releaseDate)!.replace('OPENS ', '')}
          </Mono>
        </View>
      ) : null}
      {remind ? <RemindBell movieId={m.movieId} title={m.title} variant="overlay" /> : null}
    </Pressable>
  );

  return (
    <View style={{ paddingHorizontal: space.gutter, gap: 14, width, alignSelf: 'center' }}>
      {groups.map((g, gi) =>
        g.kind === 'feature' ? (
          <View key={gi} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: GAP }}>
              {cell(g.items[0], big, 'w500')}
              <View style={{ gap: GAP }}>
                {g.items[1] ? cell(g.items[1], small, 'w342') : null}
                {g.items[2] ? cell(g.items[2], small, 'w342') : null}
              </View>
            </View>
            {opens(g.items[0].releaseDate) ? (
              <View style={{ width: big, gap: 2 }}>
                <Display size={20} numberOfLines={1} accessibilityRole="text">
                  {g.items[0].title}
                </Display>
                <Label>{dot(opens(g.items[0].releaseDate), g.items[0].ageRating)}</Label>
              </View>
            ) : (
              <View style={{ width: big, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <Display size={20} numberOfLines={1} style={{ flex: 1 }} accessibilityRole="text">
                  {g.items[0].title}
                </Display>
                <Label>{dot(runtime(g.items[0].runtimeMinutes), g.items[0].ageRating)}</Label>
              </View>
            )}
          </View>
        ) : (
          <View key={gi} style={{ flexDirection: 'row', gap: GAP }}>
            {g.items.map((m) => cell(m, third, 'w342'))}
          </View>
        ),
      )}
    </View>
  );
}

const LAYOUTS: { key: FilmsLayout; label: string; a11y: string }[] = [
  { key: 'wall', label: 'WALL', a11y: 'Poster wall' },
  { key: 'grid', label: 'GRID', a11y: 'Poster grid, more films per screen' },
  { key: 'index', label: 'INDEX', a11y: 'List with next showtimes' },
];

function LayoutSwitch({ value, onChange }: { value: FilmsLayout; onChange: (v: FilmsLayout) => void }) {
  return (
    <View style={styles.switch} accessibilityRole="radiogroup" accessibilityLabel="Layout">
      {LAYOUTS.map((l) => {
        const on = l.key === value;
        return (
          <Pressable
            key={l.key}
            accessibilityRole="radio"
            accessibilityLabel={l.a11y}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(l.key)}
            hitSlop={{ top: 6, bottom: 6 }}
            style={[styles.switchBtn, on && { backgroundColor: colors.bone }]}>
            <Mono size={11} color={on ? colors.ink : colors.dust}>
              {l.label}
            </Mono>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Posters in columns, title underneath. Phone: three or four across.
 * Website: `cols` across; `big` for the roomier poster wall.
 */
function Grid({
  movies,
  inner,
  gutter,
  cols: wanted,
  big,
  onOpen,
  remind,
}: {
  movies: Movie[];
  inner: number;
  gutter: number;
  cols?: number;
  big?: boolean;
  onOpen: (m: Movie) => void;
  remind?: boolean;
}) {
  const cols = wanted ?? (inner >= 480 ? 4 : 3);
  const gap = big ? 24 : wanted ? 16 : GAP;
  const w = Math.floor((inner - gap * (cols - 1)) / cols);
  return (
    <View style={{ paddingHorizontal: gutter, flexDirection: 'row', flexWrap: 'wrap', columnGap: gap, rowGap: big ? 32 : 18 }}>
      {movies.map((m) => {
        const tag = opens(m.releaseDate);
        return (
          <Pressable
            key={m.movieId}
            accessibilityRole="button"
            accessibilityLabel={dot(m.title, tag ?? null, m.ageRating)}
            onPress={() => onOpen(m)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              { width: w, gap: big ? 8 : 6 },
              hovered && { transform: [{ translateY: -3 }] },
              pressed && { opacity: 0.85 },
            ]}>
            <Poster url={m.posterUrl} title={m.title} meta={tag ? null : m.ageRating} width={w} size={big ? 'w500' : 'w342'} />
            {tag ? (
              <View style={styles.opensTag} pointerEvents="none">
                <Mono size={9} color={colors.night}>
                  {tag.replace('OPENS ', '')}
                </Mono>
              </View>
            ) : null}
            {remind ? <RemindBell movieId={m.movieId} title={m.title} variant="overlay" /> : null}
            {big ? (
              <Display size={22} numberOfLines={2} accessibilityRole="text">
                {m.title}
              </Display>
            ) : (
              <Body size={13} weight="semi" color={colors.bone} numberOfLines={2} style={{ lineHeight: 17 }}>
                {m.title}
              </Body>
            )}
            <Mono size={big ? 11.5 : 10.5} color={colors.dust} bold={false} numberOfLines={1}>
              {big ? dot(tag, runtime(m.runtimeMinutes), m.ageRating, rating(m.rating)) : dot(m.ageRating, rating(m.rating))}
            </Mono>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A marquee index: one line per film, with its next shows. */
function Index({
  movies,
  onOpen,
  nextShows,
  showsLoaded,
  now,
  remind,
  gutter = space.gutter,
  columns = 1,
  inner = 0,
}: {
  gutter?: number;
  columns?: number;
  inner?: number;
  remind?: boolean;
  movies: Movie[];
  onOpen: (m: Movie) => void;
  nextShows: Map<number, ShowtimeListItem[]>;
  showsLoaded: boolean;
  now: number;
}) {
  const when = (s: ShowtimeListItem) => {
    const d = new Date(s.startTime);
    if (isToday(d)) return clock(d);
    const tomorrow = dayKey(new Date(now + 86_400_000)) === dayKey(d);
    return `${tomorrow ? 'TMRW' : shortDate(d).split(' ').slice(0, 2).join(' ')} ${clock(d)}`;
  };
  return (
    <View style={{ paddingHorizontal: gutter, flexDirection: columns > 1 ? 'row' : 'column', flexWrap: 'wrap', columnGap: 32 }}>
      {movies.map((m, i) => {
        const next = nextShows.get(m.movieId) ?? [];
        const tag = opens(m.releaseDate);
        const status = tag
          ? next.length
            ? `${tag} · ON SALE`
            : tag
          : !showsLoaded
            ? ' '
            : next.length
              ? next.slice(0, 3).map(when).join('  ·  ')
              : 'NO SHOWS SCHEDULED';
        return (
          <Pressable
            key={m.movieId}
            accessibilityRole="button"
            accessibilityLabel={dot(m.title, runtime(m.runtimeMinutes), m.ageRating, status.trim() || null)}
            onPress={() => onOpen(m)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.indexRow,
              columns > 1 && { width: Math.floor((inner - 32) / 2) },
              i < columns && { borderTopWidth: 1, borderTopColor: colors.rule },
              (pressed || hovered) && { backgroundColor: colors.booth },
            ]}>
            <Poster url={m.posterUrl} title={m.title} width={44} size="w185" />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Display size={20} numberOfLines={1} accessibilityRole="text">
                {m.title}
              </Display>
              <Mono size={10.5} color={colors.dust} bold={false} numberOfLines={1}>
                {dot(runtime(m.runtimeMinutes), m.ageRating, rating(m.rating))}
              </Mono>
              <Mono size={11.5} color={next.length && !tag ? colors.bone : colors.dust} numberOfLines={1}>
                {status}
              </Mono>
            </View>
            {remind ? <RemindBell movieId={m.movieId} title={m.title} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function WallSkeleton({ width: full }: { width: number }) {
  const width = Math.min(full, 820);
  const inner = width - space.gutter * 2;
  const small = Math.floor((inner - GAP - GAP / 1.5) / 3);
  const big = inner - GAP - small;
  return (
    <View style={{ paddingHorizontal: space.gutter, flexDirection: 'row', gap: GAP, width, alignSelf: 'center' }}>
      <Shimmer style={{ width: big, height: big * 1.5 }} />
      <View style={{ gap: GAP }}>
        <Shimmer style={{ width: small, height: small * 1.5 }} />
        <Shimmer style={{ width: small, height: small * 1.5 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  opensTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.bone,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.bone,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 46,
    color: colors.bone,
    fontFamily: fonts.body,
    fontSize: 16,
    ...(isWeb ? ({ outlineStyle: 'none' } as object) : null),
  },
  clear: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  shelf: { paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  shelfOn: { borderBottomColor: colors.laterite },
  viewBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 },
  wideHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 },
  switch: { flexDirection: 'row', borderWidth: 1.5, borderColor: colors.rule, borderRadius: 3, overflow: 'hidden' },
  switchBtn: { height: 32, paddingHorizontal: 10, justifyContent: 'center' },
  indexRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.rule },
});
