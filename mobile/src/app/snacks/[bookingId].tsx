import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/controls';
import { basketCount, basketFromOrders, basketTotal, Menu } from '@/components/concessions';
import { BackIcon } from '@/components/icons';
import { Sheet } from '@/components/sheet';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import type { Basket as BasketType } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useRequest } from '@/lib/use-request';
import { colors, space } from '@/theme';

const MAX_W = 560;

/**
 * Booking step 2 of 3: add snacks to the held booking. They join the
 * booking's total, so one payment covers tickets and food.
 */
export default function SnacksStep() {
  const { bookingId, holdUntil } = useLocalSearchParams<{ bookingId: string; holdUntil?: string }>();
  const id = Number(bookingId);
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const now = useNow(1000);

  const req = useRequest(async () => {
    const [items, orders] = await Promise.all([api.concessions(), api.bookingConcessions(id).catch(() => [])]);
    // Pre-fill whatever was chosen before (coming back from Pay)
    return { items, prev: basketFromOrders(orders) };
  }, [id]);

  const [edited, setEdited] = useState<BasketType | null>(null);
  const basket = edited ?? req.data?.prev ?? {};
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leave, setLeave] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const deadline = holdUntil ? Number(holdUntil) : null;
  const left = deadline ? deadline - now : null;
  const mmss =
    left != null && left > 0
      ? `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`
      : null;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setLeave(true);
      return true;
    });
    return () => sub.remove();
  }, []);

  const items = req.data?.items ?? [];
  const count = basketCount(basket);
  const total = basketTotal(basket, items);

  const next = async (b: BasketType) => {
    setSaving(true);
    setError(null);
    try {
      await api.setBookingConcessions(id, b);
      router.push({ pathname: '/checkout/[bookingId]', params: { bookingId: String(id), holdUntil: holdUntil ?? '', from: 'snacks' } });
    } catch (e: any) {
      // Menu not set up on the server: let them pay for tickets anyway.
      if (e?.status === 503 && basketCount(b) === 0) {
        router.push({ pathname: '/checkout/[bookingId]', params: { bookingId: String(id), holdUntil: holdUntil ?? '', from: 'snacks' } });
      } else {
        setError(e?.message ?? 'Could not save your snacks.');
      }
    } finally {
      setSaving(false);
    }
  };

  const release = async () => {
    setReleasing(true);
    try {
      await api.cancelBooking(id);
    } catch {
      /* already expired or cancelled: leaving is still fine */
    }
    setReleasing(false);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
        <IconButton label="Back to seats" onPress={() => setLeave(true)} style={{ borderWidth: 1.5, borderColor: colors.rule }}>
          <BackIcon />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Display size={26}>Snacks</Display>
          <Label>STEP 2 OF 3 · OPTIONAL</Label>
        </View>
        {mmss ? (
          <View style={styles.hold}>
            <Label color={left! < 120000 ? colors.laterite : colors.dust}>HELD {mmss}</Label>
          </View>
        ) : null}
      </View>

      {req.loading ? (
        <View style={{ padding: space.gutter, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <Shimmer key={i} style={{ height: 64 }} />
          ))}
        </View>
      ) : req.error && !req.data ? (
        req.error.status === 503 ? (
          <Message
            title="Snacks aren't on sale in the app yet"
            body="You can still buy them at the kiosk. Carry on to pay for your tickets."
            action={<Button label="Continue to payment" onPress={() => next({})} busy={saving} />}
          />
        ) : (
          <ErrorState error={req.error} onRetry={req.reload} />
        )
      ) : (
        <>
          <ScrollView contentContainerStyle={{ width, alignSelf: 'center', paddingHorizontal: space.gutter, paddingBottom: 200 }}>
            <Body>Order now and collect at the kiosk with your ticket. It goes on the same payment. Tap an item to upgrade the size or add extras.</Body>
            <Menu items={items} basket={basket} onChange={setEdited} />
          </ScrollView>

          <View style={[styles.tray, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>
            {error ? (
              <Mono size={12} color={colors.laterite}>
                {error}
              </Mono>
            ) : null}
            {count > 0 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Label color={colors.inkSoft}>{count} {count === 1 ? 'ITEM' : 'ITEMS'}</Label>
                <Mono size={20} color={colors.ink}>
                  + {money(total)}
                </Mono>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {count === 0 ? (
                <Button style={{ flex: 1 }} label="No snacks, continue" onPress={() => next({})} busy={saving} />
              ) : (
                <>
                  <Button style={{ width: 112 }} variant="outlineInk" label="Clear" onPress={() => setEdited({})} />
                  <Button style={{ flex: 1 }} label="Add & continue" onPress={() => next(basket)} busy={saving} />
                </>
              )}
            </View>
          </View>
        </>
      )}

      {leave ? (
        <Sheet title="Release these seats?" onClose={() => setLeave(false)}>
          <Body>Going back cancels this unpaid booking so the seats are free for you, or anyone else, to pick again.</Body>
          <Button label="Release and go back" variant="outline" busy={releasing} onPress={release} />
          <Button label="Stay" onPress={() => setLeave(false)} />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.gutter, paddingBottom: 14 },
  hold: { borderWidth: 1.5, borderColor: colors.rule, borderRadius: 3, paddingHorizontal: 10, height: 32, justifyContent: 'center' },
  tray: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bone,
    paddingHorizontal: space.gutter,
    paddingTop: 14,
    gap: 12,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
});
