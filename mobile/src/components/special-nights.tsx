import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayFromKey, money, shortDate } from '@/lib/format';
import { useLocation } from '@/lib/location';
import { useSpecials } from '@/lib/specials';
import type { SpecialProgramme, SpecialScreening } from '@/lib/types';
import { colors, radius, space } from '@/theme';

import { Poster } from './artwork';
import { TimeToken } from './controls';
import { Body, Display, Label, Mono } from './type';

const WEEKDAYS = ['', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/**
 * "Special nights" on the Events tab: Throwback Thursday, Bargain
 * Tuesday and so on. Each shows its next film at the chosen location
 * with times to book, then the films after that.
 */
export function SpecialNights() {
  const { programmes, screenings, loaded } = useSpecials();
  const { cinemaId } = useLocation();
  if (!loaded || !programmes.length) return null;

  const here = screenings.filter((s) => cinemaId == null || s.cinemaId === cinemaId);

  return (
    <View style={{ gap: 14, paddingHorizontal: space.gutter }}>
      {programmes.map((p) => (
        <ProgrammeCard key={p.code} programme={p} screenings={here.filter((s) => s.programme === p.code)} />
      ))}
    </View>
  );
}

function ProgrammeCard({ programme: p, screenings }: { programme: SpecialProgramme; screenings: SpecialScreening[] }) {
  // Group by night
  const nights = new Map<string, SpecialScreening[]>();
  for (const s of screenings) {
    if (!nights.has(s.showDate)) nights.set(s.showDate, []);
    nights.get(s.showDate)!.push(s);
  }
  const ordered = [...nights.entries()].sort(([a], [b]) => a.localeCompare(b));
  const [next, ...later] = ordered;
  const film = next?.[1][0]?.movie;
  const year = film?.releaseDate ? film.releaseDate.slice(0, 4) : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Label color={colors.laterite}>{`EVERY ${WEEKDAYS[p.weekday] ?? ''} · ${p.times.join(' & ')}`}</Label>
          <Display size={28} black>
            {p.name}
          </Display>
        </View>
        {p.discountPercent > 0 ? (
          <View style={styles.off}>
            <Mono size={14} color={colors.ink}>
              {`${Math.round(p.discountPercent)}% OFF`}
            </Mono>
          </View>
        ) : null}
      </View>
      {p.tagline ? (
        <Body size={14} color={colors.boneSoft}>
          {p.tagline}
        </Body>
      ) : null}

      {next && film ? (
        <View style={styles.next}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${film.title}, details`}
            onPress={() => router.push({ pathname: '/film/[id]', params: { id: String(film.movieId) } })}>
            <Poster url={film.posterUrl} title={film.title} width={92} size="w342" meta={film.ageRating ?? undefined} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Label>{shortDate(dayFromKey(next[0])).toUpperCase()}</Label>
            <Display size={24} numberOfLines={3}>
              {film.title}
            </Display>
            <Mono size={11.5} color={colors.dust}>
              {[year, film.runtimeMinutes ? `${film.runtimeMinutes} MIN` : null, next[1][0].screenName.toUpperCase()].filter(Boolean).join(' · ')}
            </Mono>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {next[1].map((s) => (
                <TimeToken
                  key={s.showtimeId}
                  time={s.startTime.slice(11, 16)}
                  note={money(s.ticketPrice)}
                  accessibilityLabel={`Book ${film.title} at ${s.startTime.slice(11, 16)}, from ${money(s.ticketPrice)}`}
                  onPress={() => router.push({ pathname: '/seats/[showtimeId]', params: { showtimeId: String(s.showtimeId) } })}
                />
              ))}
            </View>
          </View>
        </View>
      ) : (
        <Body size={13} color={colors.dust}>
          The next film is announced a couple of weeks ahead.
        </Body>
      )}

      {later.length ? (
        <View style={{ gap: 6 }}>
          <Label>COMING UP</Label>
          {later.slice(0, 3).map(([date, list]) => (
            <Pressable
              key={date}
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/film/[id]', params: { id: String(list[0].movie.movieId) } })}
              style={({ pressed }) => [styles.laterRow, pressed && { opacity: 0.7 }]}>
              <Mono size={12} color={colors.dust} style={{ width: 86 }}>
                {shortDate(dayFromKey(date)).toUpperCase()}
              </Mono>
              <Body size={14} weight="semi" color={colors.bone} numberOfLines={1} style={{ flex: 1 }}>
                {list[0].movie.title}
              </Body>
              <Mono size={12} color={colors.dust}>
                {list.map((s) => s.startTime.slice(11, 16)).join(' · ')}
              </Mono>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1.5, borderColor: colors.bone, borderRadius: radius.action, padding: 16, gap: 10, backgroundColor: colors.booth },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  off: { backgroundColor: colors.vip, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.action, transform: [{ rotate: '3deg' }] },
  next: { flexDirection: 'row', gap: 14, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.rule },
  laterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36, borderTopWidth: 1, borderTopColor: colors.rule },
});
