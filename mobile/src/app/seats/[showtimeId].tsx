import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/controls';
import { StackHeader } from '@/components/header';
import { SeatMap, seatKind } from '@/components/seat-map';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { Body, Label, Mono } from '@/components/type';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { HOLD_MINUTES } from '@/lib/config';
import { tick } from '@/lib/feel';
import { peekPendingPromo, takePendingPromo } from '@/lib/promo';
import { clock, dot, money, shortDate, toNumber } from '@/lib/format';
import type { Seat } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { usePageWidth } from '@/lib/layout';
import { colors, radius, space } from '@/theme';

const MAX_SEATS = 10;
/** When the server's hold on a new booking runs out. */
const holdDeadline = () => Date.now() + HOLD_MINUTES * 60_000;
const MAX_W = 560;

const KIND_NAME: Record<string, string> = { STANDARD: 'Standard', VIP: 'VIP', WHEELCHAIR: 'Wheelchair' };

/**
 * Seats a selection would leave stranded: a free seat with something
 * unbookable on both sides (a chosen or taken seat, a gap, or the row
 * end) where at least one side is one of your seats. Cinemas try to
 * avoid these, since a single seat rarely sells.
 */
function strandedSeats(seats: Seat[], chosenIds: Set<number>) {
  const rows = new Map<string, Map<number, Seat>>();
  for (const s of seats) {
    if (!rows.has(s.rowLabel)) rows.set(s.rowLabel, new Map());
    rows.get(s.rowLabel)!.set(s.seatNumber, s);
  }
  const out: Seat[] = [];
  rows.forEach((row) => {
    const isFree = (n: number) => {
      const s = row.get(n);
      return !!s && s.status === 'AVAILABLE' && !chosenIds.has(s.seatId) && seatKind(s) !== 'WHEELCHAIR';
    };
    const isMine = (n: number) => {
      const s = row.get(n);
      return !!s && chosenIds.has(s.seatId);
    };
    row.forEach((s, n) => {
      if (!isFree(n)) return;
      if (isFree(n - 1) || isFree(n + 1)) return;
      if (isMine(n - 1) || isMine(n + 1)) out.push(s);
    });
  });
  return out;
}

export default function Seats() {
  const { showtimeId } = useLocalSearchParams<{ showtimeId: string }>();
  const id = Number(showtimeId);
  const insets = useSafeAreaInsets();
  // Wider on desktop web (lib/layout)
  const width = usePageWidth(MAX_W, 760);
  const { user } = useAuth();

  const req = useRequest(async () => {
    const [seats, pricing] = await Promise.all([api.showtimeSeats(id), api.showtimePricing(id).catch(() => null)]);
    return { seats, pricing };
  }, [id]);

  // Seats can change while you're away (someone else books, or you
  // released a hold from checkout) — refresh whenever we come back.
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      req.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const [selected, setSelected] = useState<Set<number>>(new Set());
  // A code chosen on the Events tab arrives filled in
  // (read in the initialiser, cleared once mounted: initialisers can run twice)
  // While the plan is zoomed, a drag moves the plan, not the page
  const [zoomed, setZoomed] = useState(false);
  const [promo, setPromo] = useState(() => peekPendingPromo());
  const [promoOpen, setPromoOpen] = useState(() => peekPendingPromo() !== '');
  useEffect(() => {
    takePendingPromo();
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = req.data?.pricing?.currency ?? 'GHS';

  // Mirrors bookingController: price by seat type, else ADULT, else the showtime price.
  const priceMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of req.data?.pricing?.prices ?? []) {
      const k = p.ticketType.toUpperCase();
      if (!m.has(k)) m.set(k, toNumber(p.amount));
    }
    return m;
  }, [req.data]);
  const fallback = toNumber(req.data?.seats.showtime.ticketPrice);
  const priceFor = useCallback(
    (s: Seat) => priceMap.get(seatKind(s)) ?? priceMap.get('ADULT') ?? fallback,
    [priceMap, fallback],
  );

  const seats = useMemo(() => req.data?.seats.seats ?? [], [req.data]);
  // Only seats that are still free count, so a refresh quietly drops any that were taken.
  const chosen = seats.filter((s) => selected.has(s.seatId) && s.status === 'AVAILABLE').sort((a, b) => a.seatLabel.localeCompare(b.seatLabel, undefined, { numeric: true }));
  const total = chosen.reduce((a, s) => a + priceFor(s), 0);
  // (React Compiler memoises these)
  const chosenIds = new Set(chosen.map((c) => c.seatId));
  const stranded = chosen.length ? strandedSeats(seats, chosenIds) : [];
  // "2 × Standard · 1 × VIP"
  const kindCount = new Map<string, number>();
  chosen.forEach((c) => kindCount.set(seatKind(c), (kindCount.get(seatKind(c)) ?? 0) + 1));
  const breakdown = [...kindCount.entries()].map(([k, n]) => `${n} × ${KIND_NAME[k] ?? k}`).join(' · ');

  const toggle = useCallback(
    (s: Seat) => {
      if (s.status !== 'AVAILABLE') return;
      setError(null);
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(s.seatId)) next.delete(s.seatId);
        else {
          if (next.size >= MAX_SEATS) {
            setError(`You can book up to ${MAX_SEATS} seats at once.`);
            return prev;
          }
          next.add(s.seatId);
        }
        tick();
        return next;
      });
    },
    [],
  );

  const kinds = useMemo(() => {
    const present = new Set(seats.filter((s) => s.status !== 'INACTIVE').map(seatKind));
    return [...present];
  }, [seats]);

  const proceed = async () => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const booking = await api.createBooking(id, chosen.map((c) => c.seatId), promo);
      const holdUntil = holdDeadline();
      setSelected(new Set());
      router.push({
        pathname: '/snacks/[bookingId]',
        params: { bookingId: String(booking.bookingId), holdUntil: String(holdUntil) },
      });
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      if (err.status === 409 || /seat/i.test(err.message)) {
        // Someone got there first: refresh and drop seats that are gone.
        await req.reload();
      }
    } finally {
      setBusy(false);
    }
  };

  const st = req.data?.seats.showtime;
  const subtitle = st ? dot(shortDate(new Date(st.startTime)), clock(st.startTime), st.screen.name.toUpperCase()) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.night }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StackHeader title={st?.movie.title ?? 'Choose seats'} subtitle={subtitle} />

      {req.loading ? (
        <View style={{ padding: space.gutter, gap: 10, alignItems: 'center' }}>
          <Shimmer style={{ height: 14, width: width - 80, marginTop: 20 }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <Shimmer key={i} style={{ height: 26, width: width - 60 }} />
          ))}
        </View>
      ) : req.error && !req.data ? (
        <ErrorState error={req.error} onRetry={req.reload} />
      ) : seats.length === 0 ? (
        <Message title="No seat plan" body="This screen has no seats set up yet. Please choose another showtime." />
      ) : (
        <>
          <ScrollView scrollEnabled={!zoomed} contentContainerStyle={{ width, alignSelf: 'center', paddingBottom: 220 }}>
            {req.data?.pricing?.special ? (
              <View style={styles.special} accessible accessibilityLabel={`${req.data.pricing.special.name ?? 'Special night'}: ${Math.round(req.data.pricing.special.discountPercent)}% off every seat`}>
                <Mono size={12.5} color={colors.ink}>
                  {`${(req.data.pricing.special.name ?? 'Special night').toUpperCase()} · ${Math.round(req.data.pricing.special.discountPercent)}% OFF EVERY SEAT`}
                </Mono>
              </View>
            ) : null}
            {/* The screen */}
            <View style={styles.screenWrap} accessible accessibilityLabel="Screen this way">
              <View style={styles.screenArc} />
              <Label style={{ letterSpacing: 4 }}>SCREEN</Label>
            </View>

            <SeatMap
              seats={seats}
              selected={chosenIds}
              onToggle={toggle}
              width={width}
              priceOf={(s) => money(priceFor(s), currency)}
              onZoomChange={(z) => setZoomed(z > 1)}
            />

            <View style={styles.legend}>
              {kinds.includes('STANDARD') ? <LegendItem kind="open" text={`Open · ${money(priceFor({ seatType: 'STANDARD' } as Seat), currency)}`} /> : null}
              {kinds.includes('VIP') ? <LegendItem kind="vip" text={`VIP · ${money(priceFor({ seatType: 'VIP' } as Seat), currency)}`} /> : null}
              {kinds.includes('WHEELCHAIR') ? <LegendItem kind="wheel" text="Wheelchair" /> : null}
              <LegendItem kind="taken" text="Taken" />
              <LegendItem kind="on" text="Yours" />
            </View>
            <Body size={12.5} color={colors.dust} style={{ textAlign: 'center', paddingHorizontal: 28, marginTop: 10 }}>
              {req.data?.seats.summary.availableSeats ?? 0} of {req.data?.seats.summary.activeSeats ?? 0} seats free
            </Body>

            <View style={{ paddingHorizontal: space.gutter, marginTop: 20 }}>
              {promoOpen ? (
                <Field
                  label="Promo code"
                  value={promo}
                  onChangeText={(t) => setPromo(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="e.g. WEEKEND10"
                />
              ) : (
                <Pressable accessibilityRole="button" onPress={() => setPromoOpen(true)} style={{ height: 44, justifyContent: 'center' }}>
                  <Mono size={12.5} color={colors.lateriteSoft}>
                    HAVE A PROMO CODE?
                  </Mono>
                </Pressable>
              )}
            </View>
          </ScrollView>

          <View style={[styles.tray, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
            {error ? (
              <Mono size={12} color={colors.laterite} bold>
                {error}
              </Mono>
            ) : null}
            {!error && stranded.length ? (
              <Body size={12.5} color={colors.inkSoft} accessibilityLiveRegion="polite">
                {`This leaves ${stranded.map((x) => x.seatLabel).join(', ')} on ${stranded.length === 1 ? 'its' : 'their'} own. If you can, move along so no single seat is left empty.`}
              </Body>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Label color={colors.inkSoft}>{chosen.length === 0 ? 'NO SEATS YET' : breakdown.toUpperCase()}</Label>
                {chosen.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {chosen.map((c) => (
                      <Pressable
                        key={c.seatId}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove seat ${c.seatLabel}`}
                        onPress={() => toggle(c)}
                        hitSlop={4}
                        style={({ pressed }) => [styles.chip, seatKind(c) === 'VIP' && styles.chipVip, pressed && { opacity: 0.6 }]}>
                        <Mono size={13} color={colors.ink}>
                          {c.seatLabel}
                        </Mono>
                        <Mono size={11} color={colors.inkSoft}>
                          ✕
                        </Mono>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <Mono size={17} color={colors.ink}>
                    Tap a seat
                  </Mono>
                )}
              </View>
              <Mono size={22} color={colors.ink} accessibilityLabel={`Total ${money(total, currency)}`}>
                {money(total, currency)}
              </Mono>
            </View>
            <Button
              label={user ? 'Continue' : 'Sign in to continue'}
              disabled={chosen.length === 0}
              busy={busy}
              onPress={proceed}
            />
            {chosen.length ? (
              <Body size={12} color={colors.inkSoft} style={{ textAlign: 'center', marginTop: -4 }}>
                {`Seats are held for ${HOLD_MINUTES} minutes while you pay.`}
              </Body>
            ) : null}
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function LegendItem({ kind, text }: { kind: 'open' | 'vip' | 'wheel' | 'taken' | 'on'; text: string }) {
  const box =
    kind === 'open'
      ? { borderWidth: 1.5, borderColor: colors.bone }
      : kind === 'vip'
        ? { borderWidth: 1.5, borderBottomWidth: 4, borderColor: colors.vip }
        : kind === 'wheel'
          ? { borderWidth: 1.5, borderColor: colors.dust, borderRadius: 7, borderTopLeftRadius: 7, borderTopRightRadius: 7 }
          : kind === 'taken'
            ? { backgroundColor: colors.taken }
            : { backgroundColor: colors.laterite };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[{ width: 14, height: 14, borderTopLeftRadius: 2, borderTopRightRadius: 2, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 }, box]} />
      <Body size={12} color={colors.dust}>
        {text}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  special: { marginHorizontal: space.gutter, marginTop: 4, marginBottom: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.vip, borderRadius: 3, alignSelf: 'flex-start' },
  screenWrap: { alignItems: 'center', gap: 6, marginHorizontal: 34, marginTop: 18, marginBottom: 22 },
  screenArc: {
    alignSelf: 'stretch',
    height: 16,
    borderTopWidth: 3,
    borderColor: colors.bone,
    borderTopLeftRadius: 200,
    borderTopRightRadius: 200,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, paddingHorizontal: space.gutter, marginTop: 24 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 3,
  },
  chipVip: { borderBottomWidth: 4, borderBottomColor: colors.vip },
  tray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bone,
    paddingHorizontal: space.gutter,
    paddingTop: 14,
    gap: 12,
    borderTopLeftRadius: radius.paper,
    borderTopRightRadius: radius.paper,
  },
});
