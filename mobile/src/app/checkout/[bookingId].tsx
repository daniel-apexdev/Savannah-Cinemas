import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Poster } from '@/components/artwork';
import { PaymentPicker } from '@/components/concessions';
import { Button, Field, IconButton } from '@/components/controls';
import { goBack } from '@/components/header';
import { BackIcon } from '@/components/icons';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notify';
import { PAYMENTS_LIVE } from '@/lib/config';
import { success } from '@/lib/feel';
import { clock, dot, money, shortDate, titleCase, toNumber } from '@/lib/format';
import type { ConcessionOrder, PaymentMethod } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useRequest } from '@/lib/use-request';
import { colors, radius, space } from '@/theme';

const MAX_W = 560;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Booking step 3 of 3: review tickets + snacks, pay once. */
export default function Checkout() {
  const { bookingId, holdUntil, from } = useLocalSearchParams<{ bookingId: string; holdUntil?: string; from?: string }>();
  const id = Number(bookingId);
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const now = useNow(1000);

  const req = useRequest(async () => {
    const [booking, orders] = await Promise.all([api.booking(id), api.bookingConcessions(id).catch(() => [] as ConcessionOrder[])]);
    return { booking, snacks: orders.find((o) => o.source === 'BOOKING') ?? null };
  }, [id]);

  const { user } = useAuth();
  const { resync } = useNotifications();
  const [method, setMethod] = useState<PaymentMethod>('MOBILE_MONEY');
  // Where the tickets + receipt go. Starts as the account email.
  const [email, setEmail] = useState<string | null>(null);
  const receiptTo = (email ?? user?.email ?? '').trim();
  const emailOk = EMAIL.test(receiptTo);
  const [emailTouched, setEmailTouched] = useState(false);

  // Savannah Rewards: what this member could take off this booking
  const quote = useRequest(() => api.rewardsQuote(id), [id, req.data?.booking.totalAmount], { enabled: !!user && !!req.data });
  const [usePoints, setUsePoints] = useState(false);
  const pointsOff = usePoints && quote.data && quote.data.points > 0 ? quote.data.discount : 0;
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Hold countdown (bookings hold seats for 15 minutes)
  const deadline = holdUntil ? Number(holdUntil) : null;
  const left = deadline ? deadline - now : null;
  const expired = left != null && left <= 0;

  // Already paid? Go straight to the ticket.
  const b = req.data?.booking;
  useEffect(() => {
    if (b && b.status === 'CONFIRMED') {
      router.replace({ pathname: '/ticket/[bookingId]', params: { bookingId: String(id) } });
    }
  }, [b, id]);

  const pay = async () => {
    setEmailTouched(true);
    if (!emailOk) {
      setPayError('Check the email address for your confirmation.');
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      const r = await api.pay(id, method, receiptTo, pointsOff > 0);
      success();
      // Schedule the 3 h / 30 min reminders on the phone (asks once for permission)
      resync(true);
      router.dismissAll();
      router.push({
        pathname: '/ticket/[bookingId]',
        params: {
          bookingId: String(id),
          justPaid: '1',
          emailTo: r.email?.to ?? receiptTo,
          emailSent: r.email?.sent ? '1' : r.email?.pending ? 'pending' : '0',
          earned: String(r.rewards?.pointsEarned ?? ''),
          trophies: (r.rewards?.newTrophies ?? []).map((t) => t.name).join('|'),
        },
      });
    } catch (e: any) {
      setPayError(e?.message ?? 'Payment failed. You have not been charged.');
    } finally {
      setPaying(false);
    }
  };

  const editSnacks = () => {
    if (from === 'snacks') goBack();
    else router.push({ pathname: '/snacks/[bookingId]', params: { bookingId: String(id), holdUntil: holdUntil ?? '' } });
  };

  const snacks = req.data?.snacks;
  const mmss =
    left != null && left > 0 ? `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}` : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.night }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <IconButton label="Back" onPress={() => goBack()} style={{ borderWidth: 1.5, borderColor: colors.rule }}>
          <BackIcon />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Display size={26}>Pay</Display>
          {from === 'snacks' ? <Label>STEP 3 OF 3</Label> : null}
        </View>
        {mmss ? (
          <View style={styles.hold} accessibilityLabel={`Seats held for ${mmss}`}>
            <Label color={left! < 120000 ? colors.laterite : colors.dust}>HELD {mmss}</Label>
          </View>
        ) : null}
      </View>

      {req.loading ? (
        <View style={{ padding: space.gutter, gap: 12 }}>
          <Shimmer style={{ height: 120 }} />
          <Shimmer style={{ height: 160 }} />
        </View>
      ) : req.error || !b ? (
        <ErrorState error={req.error!} onRetry={req.reload} />
      ) : expired || b.status === 'CANCELLED' ? (
        <Message
          kicker="HOLD EXPIRED"
          title="Those seats were released"
          body="Seats are held for 15 minutes while you pay. Pick them again. They may still be free."
          action={
            <Button
              label="Choose seats again"
              onPress={() => {
                router.dismissAll();
                router.push({ pathname: '/seats/[showtimeId]', params: { showtimeId: String(b.showtimeId) } });
              }}
            />
          }
        />
      ) : (
        <>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ width, alignSelf: 'center', paddingHorizontal: space.gutter, paddingBottom: 200, gap: 18 }}>
            {/* Order */}
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Poster url={b.movie.posterUrl} title={b.movie.title} width={72} size="w185" />
              <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
                <Display size={26} black numberOfLines={2}>
                  {b.movie.title}
                </Display>
                <Label>{dot(shortDate(new Date(b.startTime)), clock(b.startTime), b.screen.name.toUpperCase())}</Label>
                <Body size={13} color={colors.dust}>
                  {b.cinema.name}
                </Body>
              </View>
            </View>

            <View style={styles.box}>
              {b.seats.map((s) => (
                <View key={s.seatId} style={styles.line}>
                  <Body color={colors.bone}>
                    Seat <Mono size={14}>{s.seatLabel}</Mono>
                    <Body size={13} color={colors.dust}>
                      {'  '}
                      {titleCase(s.seatType ?? 'standard')}
                    </Body>
                  </Body>
                  <Mono size={14}>{money(s.ticketPrice ?? b.ticketPrice)}</Mono>
                </View>
              ))}
              {toNumber(b.discountAmount) > 0 ? (
                <View style={styles.line}>
                  <Body color={colors.bone}>Promo discount</Body>
                  <Mono size={14} color={colors.lateriteSoft}>
                    −{money(b.discountAmount)}
                  </Mono>
                </View>
              ) : null}
              {snacks?.items.map((i) => (
                <View key={`snack-${i.itemId}`} style={styles.line}>
                  <Body color={colors.bone}>
                    {i.name}
                    <Body size={13} color={colors.dust}>
                      {'  '}× {i.quantity}
                    </Body>
                  </Body>
                  <Mono size={14}>{money(i.lineTotal)}</Mono>
                </View>
              ))}
              <Pressable accessibilityRole="button" onPress={editSnacks} style={[styles.line, { minHeight: 44 }]}>
                <Mono size={12} color={colors.lateriteSoft}>
                  {snacks ? 'EDIT SNACKS' : '+ ADD SNACKS'}
                </Mono>
              </Pressable>
              {quote.data && quote.data.points > 0 ? (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: usePoints }}
                  accessibilityLabel={`Use ${quote.data.points} Savannah Rewards points for ${money(quote.data.discount)} off`}
                  onPress={() => setUsePoints((v) => !v)}
                  style={[styles.line, { minHeight: 60 }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Body color={colors.bone}>Use {quote.data.points} points</Body>
                    <Mono size={11} color={colors.dust} bold={false}>
                      {`YOU HAVE ${quote.data.balance.toLocaleString('en-GB')} · SAVANNAH REWARDS`}
                    </Mono>
                  </View>
                  <Mono size={14} color={usePoints ? colors.lateriteSoft : colors.dust}>
                    −{money(quote.data.discount)}
                  </Mono>
                  <Switch
                    value={usePoints}
                    onValueChange={setUsePoints}
                    trackColor={{ false: colors.rule, true: colors.laterite }}
                    thumbColor={colors.bone}
                    ios_backgroundColor={colors.rule}
                    {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.bone } as object) : null)}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </Pressable>
              ) : null}
              <View style={[styles.line, { borderBottomWidth: 0 }]}>
                <Body weight="bold" color={colors.bone}>
                  Total
                </Body>
                <View style={{ alignItems: 'flex-end' }}>
                  {pointsOff > 0 ? (
                    <Mono size={13} color={colors.dust} bold={false} style={{ textDecorationLine: 'line-through' }}>
                      {money(b.totalAmount)}
                    </Mono>
                  ) : null}
                  <Mono size={22}>{money(toNumber(b.totalAmount) - pointsOff)}</Mono>
                </View>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Field
                label={user ? 'Send tickets & receipt to' : 'Your email for the tickets'}
                value={email ?? user?.email ?? ''}
                onChangeText={(t) => {
                  setEmail(t);
                  setPayError(null);
                }}
                onBlur={() => setEmailTouched(true)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="you@example.com"
                error={emailTouched && !emailOk ? 'Enter a valid email address' : null}
              />
              <Body size={12.5} color={colors.dust}>
                {user
                  ? 'We’ll email your QR ticket and receipt here once you’ve paid. Your ticket is also saved in Account.'
                  : 'No account needed: we’ll email your QR ticket and receipt here once you’ve paid. Show the QR code at the door.'}
              </Body>
            </View>

            <PaymentPicker value={method} onChange={setMethod} />

            {!PAYMENTS_LIVE ? (
              <View style={styles.test}>
                <Label color={colors.vip}>TEST MODE</Label>
                <Body size={13} color={colors.boneSoft}>
                  The Savannah server is simulating payments, so no money is taken. A real Mobile Money or card provider still needs to be connected before
                  launch.
                </Body>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.tray, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
            {payError ? (
              <Mono size={12} color={colors.laterite}>
                {payError}
              </Mono>
            ) : null}
            <Button label={`Pay ${money(toNumber(b.totalAmount) - pointsOff)}`} busy={paying} onPress={pay} />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.gutter, paddingBottom: 14 },
  hold: { borderWidth: 1.5, borderColor: colors.rule, borderRadius: 3, paddingHorizontal: 10, height: 32, justifyContent: 'center' },
  box: { borderTopWidth: 1.5, borderTopColor: colors.bone },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    gap: 12,
  },
  test: { borderWidth: 1, borderColor: colors.rule, borderStyle: 'dashed', padding: 14, gap: 6, borderRadius: radius.action },
  tray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.gutter,
    paddingTop: 12,
    gap: 10,
    backgroundColor: colors.night,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
});
