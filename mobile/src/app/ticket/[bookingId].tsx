import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Poster } from '@/components/artwork';
import { Button, Field, IconButton } from '@/components/controls';
import { BackIcon, CloseIcon } from '@/components/icons';
import { ErrorState, Shimmer } from '@/components/states';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { HOLD_MINUTES } from '@/lib/config';
import { openDirections } from '@/lib/directions';
import { useReducedMotion } from '@/lib/feel';
import { useNotifications } from '@/lib/notify';
import { clock, money, shortDate, toNumber } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useRequest } from '@/lib/use-request';
import { colors, motion, radius, space } from '@/theme';
import { SiteFooter } from '@/components/site-footer';

const MAX_W = 560;

export default function Ticket() {
  const { bookingId, justPaid, emailTo, emailSent, earned, trophies } = useLocalSearchParams<{
    bookingId: string;
    justPaid?: string;
    emailTo?: string;
    emailSent?: string;
    earned?: string;
    trophies?: string;
  }>();
  const pointsEarned = Number(earned) || 0;
  const newTrophies = (trophies ?? '').split('|').filter(Boolean);
  const id = Number(bookingId);
  const fresh = justPaid === '1';
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const reduced = useReducedMotion();

  const req = useRequest(() => api.booking(id), [id]);
  const snacks = useRequest(() => api.bookingConcessions(id).catch(() => []), [id]);
  const now = useNow(15_000);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // The ticket "prints": feeds up out of a slot, once, after payment.
  const [feed] = useState(() => new Animated.Value(fresh ? 1 : 0));
  useEffect(() => {
    if (!req.data || !fresh) return;
    if (reduced) {
      feed.setValue(0);
      return;
    }
    Animated.timing(feed, { toValue: 0, duration: motion.print, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [req.data, fresh, reduced, feed]);

  const close = () => {
    if (fresh) {
      router.dismissAll();
      router.navigate('/account');
    } else if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const { resync } = useNotifications();
  const doCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await api.cancelBooking(id);
      resync(false);
      setConfirmCancel(false);
      await Promise.all([req.reload(), snacks.reload()]);
    } catch (e: any) {
      setCancelError(e?.message ?? 'Could not cancel.');
    } finally {
      setCancelling(false);
    }
  };

  const b = req.data;
  const future = b ? new Date(b.startTime).getTime() > now : false;
  const pending = b?.status === 'PENDING';
  const holdEnds = b?.bookingDate ? new Date(b.bookingDate).getTime() + HOLD_MINUTES * 60_000 : null;
  const canPay = pending && future && (holdEnds == null || holdEnds > now);
  const canCancel = !!b && future && (b.status === 'CONFIRMED' || b.status === 'PENDING');
  const qrSize = Math.min(150, Math.round((width - space.gutter * 2) * 0.4));

  const kicker = !b
    ? ''
    : b.status === 'CANCELLED'
      ? 'CANCELLED'
      : pending
        ? canPay
          ? 'AWAITING PAYMENT'
          : 'NOT PAID · HOLD EXPIRED'
        : future
          ? 'CONFIRMED'
          : 'SEEN';

  const directions = () => {
    if (b) openDirections(b.cinema);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <ScrollView contentContainerStyle={{ width, alignSelf: 'center', paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View style={styles.head}>
          <IconButton label={fresh ? 'Done' : 'Back'} onPress={close} style={{ borderWidth: 1.5, borderColor: colors.rule }}>
            {fresh ? <CloseIcon /> : <BackIcon />}
          </IconButton>
          <Label color={b?.status === 'CANCELLED' || (pending && !canPay) ? colors.lateriteSoft : colors.laterite}>{kicker}</Label>
        </View>

        {fresh && b ? (
          <View style={{ paddingHorizontal: space.gutter, paddingTop: 10 }}>
            <Display size={46} black>
              You’re in
            </Display>
            {emailTo ? (
              <Body size={14} color={emailSent === '0' ? colors.lateriteSoft : colors.dust}>
                {emailSent === '1'
                  ? `Tickets and receipt sent to ${emailTo}.`
                  : emailSent === 'pending'
                    ? `Sending your tickets to ${emailTo}…`
                    : `Paid, but we couldn’t email ${emailTo}. You can send it again below.`}
              </Body>
            ) : null}
            {pointsEarned > 0 || newTrophies.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${pointsEarned ? `${pointsEarned} points earned. ` : ''}${newTrophies.length ? `New trophies: ${newTrophies.join(', ')}. ` : ''}Open trophies`}
                onPress={() => {
                  router.dismissAll();
                  router.navigate({ pathname: '/account', params: { tab: newTrophies.length ? 'trophies' : 'rewards', at: String(Date.now()) } });
                }}
                style={({ pressed }) => [styles.reward, pressed && { opacity: 0.85 }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  {pointsEarned ? (
                    <Mono size={15} color={colors.ink}>
                      {`+${pointsEarned} POINTS`}
                    </Mono>
                  ) : null}
                  {newTrophies.length ? (
                    <Body size={13.5} weight="semi" color={colors.ink}>
                      {`New ${newTrophies.length === 1 ? 'trophy' : 'trophies'}: ${newTrophies.join(', ')}`}
                    </Body>
                  ) : null}
                </View>
                <Mono size={12} color={colors.ink}>
                  {newTrophies.length ? 'SEE TROPHIES →' : 'REWARDS →'}
                </Mono>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {req.loading ? (
          <View style={{ padding: space.gutter }}>
            <Shimmer style={{ height: 420, borderRadius: radius.paper }} />
          </View>
        ) : req.error || !b ? (
          <ErrorState error={req.error!} onRetry={req.reload} />
        ) : (
          <>
            <Animated.View
              style={[
                styles.paper,
                b.status === 'CANCELLED' && { opacity: 0.55 },
                {
                  opacity: feed.interpolate({ inputRange: [0, 1], outputRange: [b.status === 'CANCELLED' ? 0.55 : 1, 0] }),
                  transform: [{ translateY: feed.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }) }],
                },
              ]}>
              <View style={{ flexDirection: 'row', gap: 14, padding: 16 }}>
                <Poster url={b.movie.posterUrl} title={b.movie.title} width={62} size="w185" />
                <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
                  <Display size={30} black color={colors.ink} numberOfLines={3}>
                    {b.movie.title}
                  </Display>
                  <Body size={13} color={colors.inkSoft}>
                    {b.cinema.name}
                  </Body>
                </View>
              </View>

              <View style={styles.grid}>
                <Cell k="DATE" v={shortDate(new Date(b.startTime))} />
                <Cell k="START" v={clock(b.startTime)} />
                <Cell k="SCREEN" v={b.screen.name.replace(/^screen\s*/i, '') || b.screen.name} />
                <Cell k={b.seats.length === 1 ? 'SEAT' : 'SEATS'} v={b.seats.map((s) => s.seatLabel).join(' ')} />
                <Cell k={pending ? 'TO PAY' : 'PAID'} v={money(b.totalAmount)} />
                <Cell k="TICKETS" v={String(b.ticketQuantity || b.seats.length)} />
              </View>

              <View style={styles.perf}>
                <View style={[styles.notch, { left: -26 }]} />
                <View style={[styles.notch, { right: -26 }]} />
              </View>

              <View style={styles.qrRow}>
                {b.ticket?.qrCodeData && b.status === 'CONFIRMED' ? (
                  <View style={styles.qr} accessible accessibilityLabel="Ticket QR code. Show this at the door.">
                    <QRCode value={b.ticket.qrCodeData} size={qrSize} color={colors.ink} backgroundColor="#FFFFFF" ecl="M" />
                  </View>
                ) : null}
                <View style={{ flex: 1, gap: 6 }}>
                  <Mono size={10.5} color="#6B6457" bold={false}>
                    BOOKING REF
                  </Mono>
                  <Mono size={20} color={colors.ink} selectable>
                    {b.bookingRef}
                  </Mono>
                  {b.ticket?.ticketCode ? (
                    <Mono size={11} color={colors.inkSoft} bold={false} selectable>
                      {b.ticket.ticketCode}
                    </Mono>
                  ) : null}
                  <Body size={12.5} color={colors.inkSoft}>
                    {b.status === 'CONFIRMED'
                      ? b.ticket
                        ? 'Show this at the door. It works without signal once opened.'
                        : 'Show your booking reference at the counter.'
                      : b.status === 'CANCELLED'
                        ? 'This booking was cancelled.'
                        : 'No ticket until payment is complete.'}
                  </Body>
                </View>
              </View>
            </Animated.View>

            <View style={{ paddingHorizontal: space.gutter, paddingTop: 16, gap: 10 }}>
              {canPay ? (
                <Button
                  label={`Pay ${money(b.totalAmount)}`}
                  onPress={() =>
                    router.push({
                      pathname: '/checkout/[bookingId]',
                      params: { bookingId: String(b.bookingId), holdUntil: holdEnds ? String(holdEnds) : '' },
                    })
                  }
                />
              ) : null}
              {(snacks.data ?? []).filter((o) => o.items.length > 0).map((o) => (
                <Pressable
                  key={o.orderId}
                  accessibilityRole="button"
                  accessibilityLabel={`Snacks, ${o.status === 'PAID' ? `code ${o.collectionCode}` : o.status.toLowerCase()}. Open`}
                  onPress={() => router.push({ pathname: '/order/[orderId]', params: { orderId: String(o.orderId) } })}
                  style={({ pressed }) => [styles.snackRow, pressed && { opacity: 0.8 }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Label>{o.source === 'PREORDER' ? 'SNACK PRE-ORDER' : 'SNACKS'}</Label>
                    <Body size={13.5} color={colors.bone} numberOfLines={2}>
                      {o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                    </Body>
                  </View>
                  <Mono size={14} color={o.status === 'PAID' ? colors.bone : colors.dust}>
                    {o.status === 'PAID' ? o.collectionCode : o.status}
                  </Mono>
                </Pressable>
              ))}
              {b.status === 'CONFIRMED' || b.status === 'COMPLETED' ? (
                <EmailPanel
                  booking={b}
                  initial={emailTo ? { to: emailTo, sent: emailSent === '1', pending: emailSent === 'pending' } : null}
                  onSent={req.reload}
                />
              ) : null}
              {b.status !== 'CANCELLED' && future ? <Button label="Directions" variant="outline" onPress={directions} /> : null}
              {canCancel ? (
                <Button variant="quiet" label={pending ? 'Release seats' : 'Cancel booking'} onPress={() => setConfirmCancel(true)} />
              ) : null}
              {toNumber(b.discountAmount) > 0 ? (
                <Body size={12.5} color={colors.dust}>
                  Includes a promo discount of {money(b.discountAmount)}.
                </Body>
              ) : null}
              {toNumber(b.pointsDiscount) > 0 ? (
                <Body size={12.5} color={colors.dust}>
                  {`You used ${b.pointsRedeemed} Savannah Rewards points for ${money(b.pointsDiscount)} off.`}
                </Body>
              ) : null}
            </View>
          </>
        )}
        <SiteFooter />
      </ScrollView>

      {confirmCancel && b ? (
        <View style={styles.scrim}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <Display size={28}>{pending ? 'Release these seats?' : 'Cancel this booking?'}</Display>
            <Body>
              {pending
                ? 'Nothing has been paid. The seats go back on sale straight away.'
                : `Your seats ${b.seats.map((s) => s.seatLabel).join(', ')} go back on sale${(snacks.data ?? []).some((o) => o.items.length > 0) ? ' and your snack orders are cancelled with them' : ''}. Refunds follow the cinema's refund policy.`}
            </Body>
            {cancelError ? (
              <Mono size={12} color={colors.laterite}>
                {cancelError}
              </Mono>
            ) : null}
            <Button label={pending ? 'Release seats' : 'Cancel booking'} variant="outline" busy={cancelling} onPress={doCancel} />
            <Button label="Keep it" onPress={() => setConfirmCancel(false)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Where the confirmation went, and a way to send it again (or elsewhere). */
function EmailPanel({
  booking,
  initial,
  onSent,
}: {
  booking: Booking;
  initial: { to: string; sent: boolean; pending?: boolean } | null;
  onSent: () => void;
}) {
  const [result, setResult] = useState<{ to: string; sent: boolean; pending?: boolean; error?: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lastTo = result?.to ?? booking.receiptEmail ?? initial?.to ?? null;
  const sentAt = booking.confirmationSentAt ? new Date(booking.confirmationSentAt) : null;
  const status = result
    ? result.error
      ? `Couldn’t send: ${result.error}`
      : result.pending
        ? `Sending to ${result.to}…`
        : `Sent to ${result.to}`
    : sentAt && lastTo
      ? `Sent to ${lastTo} · ${shortDate(sentAt)} ${clock(sentAt)}`
      : initial
        ? initial.sent
          ? `Sent to ${initial.to}`
          : initial.pending
            ? `Sending to ${initial.to}…`
            : `Not sent to ${initial.to}`
        : 'Not emailed yet';
  const address = (to ?? lastTo ?? '').trim();

  const send = async () => {
    if (!EMAIL.test(address)) {
      setResult({ to: address, sent: false, error: 'enter a valid email address' });
      return;
    }
    setBusy(true);
    try {
      const r = await api.emailBooking(booking.bookingId, address);
      setResult({ to: r.to ?? address, sent: r.sent, pending: r.pending });
      setEditing(false);
      onSent();
    } catch (e: any) {
      setResult({ to: address, sent: false, error: e?.message ?? 'please try again' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.emailBox}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label>CONFIRMATION EMAIL</Label>
          <Body size={13.5} color={result?.error ? colors.lateriteSoft : colors.bone} accessibilityLiveRegion="polite">
            {status}
          </Body>
        </View>
        {!editing ? (
          <Pressable accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={8} style={{ height: 44, justifyContent: 'center' }}>
            <Mono size={12} color={colors.lateriteSoft}>
              {lastTo ? 'SEND AGAIN' : 'EMAIL IT'}
            </Mono>
          </Pressable>
        ) : null}
      </View>
      {editing ? (
        <View style={{ gap: 10 }}>
          <Field
            label="Send to"
            value={to ?? lastTo ?? ''}
            onChangeText={setTo}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button style={{ flex: 1 }} label="Send" busy={busy} onPress={send} height={46} />
            <Button style={{ width: 110 }} label="Cancel" variant="outline" onPress={() => setEditing(false)} height={46} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ width: '33.33%', paddingVertical: 6, paddingRight: 6, gap: 2 }}>
      <Mono size={10.5} color="#6B6457" bold={false}>
        {k}
      </Mono>
      <Mono size={15} color={colors.ink}>
        {v}
      </Mono>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  paper: { marginHorizontal: space.gutter, marginTop: 16, backgroundColor: colors.bone, borderRadius: radius.paper },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 14 },
  perf: { marginHorizontal: 14, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#B9AE97', position: 'relative' },
  notch: { position: 'absolute', top: -12, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.night },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  qr: { padding: 8, backgroundColor: '#FFFFFF' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, padding: 14, backgroundColor: colors.vip, borderRadius: radius.action },
  emailBox: { gap: 10, padding: 14, borderWidth: 1.5, borderColor: colors.rule, borderRadius: radius.action },
  snackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.action,
  },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,5,4,0.78)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.booth, padding: space.gutter, gap: 14, borderTopWidth: 1.5, borderTopColor: colors.bone },
});
