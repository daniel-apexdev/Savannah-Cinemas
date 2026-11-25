import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ItemImage } from '@/components/concessions';
import { IconButton } from '@/components/controls';
import { BackIcon, CloseIcon } from '@/components/icons';
import { ErrorState, Message, Shimmer } from '@/components/states';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { useReducedMotion } from '@/lib/feel';
import { clock, dot, money, shortDate } from '@/lib/format';
import { useRequest } from '@/lib/use-request';
import { colors, motion, radius, space } from '@/theme';
import { SiteFooter } from '@/components/site-footer';

const MAX_W = 560;

/** A snack order: what to collect, and the code to show at the kiosk. */
export default function SnackOrder() {
  const { orderId, justPaid } = useLocalSearchParams<{ orderId: string; justPaid?: string }>();
  const id = Number(orderId);
  const fresh = justPaid === '1';
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const reduced = useReducedMotion();

  const req = useRequest(async () => (await api.myOrders()).find((o) => o.orderId === id) ?? null, [id]);
  const o = req.data;

  const [feed] = useState(() => new Animated.Value(fresh ? 1 : 0));
  useEffect(() => {
    if (!o || !fresh) return;
    if (reduced) {
      feed.setValue(0);
      return;
    }
    Animated.timing(feed, { toValue: 0, duration: motion.print, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [o, fresh, reduced, feed]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/account');
  };

  const paid = o?.status === 'PAID';

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <ScrollView contentContainerStyle={{ width, alignSelf: 'center', paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
        <View style={styles.head}>
          <IconButton label={fresh ? 'Done' : 'Back'} onPress={close} style={{ borderWidth: 1.5, borderColor: colors.rule }}>
            {fresh ? <CloseIcon /> : <BackIcon />}
          </IconButton>
          {o ? <Label color={paid ? colors.laterite : colors.lateriteSoft}>{o.status === 'PAID' ? 'READY TO COLLECT' : o.status}</Label> : null}
        </View>

        {fresh && o ? (
          <View style={{ paddingHorizontal: space.gutter, paddingTop: 10 }}>
            <Display size={46} black>
              Snacks sorted
            </Display>
          </View>
        ) : null}

        {req.loading ? (
          <View style={{ padding: space.gutter }}>
            <Shimmer style={{ height: 380, borderRadius: radius.paper }} />
          </View>
        ) : req.error ? (
          <ErrorState error={req.error} onRetry={req.reload} />
        ) : !o ? (
          <Message title="Order not found" body="It may belong to another account." />
        ) : (
          <Animated.View
            style={[
              styles.paper,
              {
                opacity: feed.interpolate({ inputRange: [0, 1], outputRange: [o.status === 'CANCELLED' ? 0.55 : 1, 0] }),
                transform: [{ translateY: feed.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }) }],
              },
            ]}>
            <View style={{ padding: 16, gap: 6 }}>
              <Mono size={10.5} color="#6B6457" bold={false}>
                SNACKS FOR
              </Mono>
              <Display size={30} black color={colors.ink} numberOfLines={2}>
                {o.movie.title}
              </Display>
              <Mono size={12.5} color={colors.inkSoft}>
                {dot(shortDate(new Date(o.startTime)), clock(o.startTime), `REF ${o.bookingRef}`)}
              </Mono>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              {o.items.map((i) => (
                <View key={i.itemId} style={styles.item}>
                  <ItemImage uri={i.imageUrl} name={i.name} size={40} />
                  <Body color={colors.ink} style={{ flex: 1 }} numberOfLines={1}>
                    {i.name}
                  </Body>
                  <Mono size={13} color={colors.inkSoft}>
                    × {i.quantity}
                  </Mono>
                  <Mono size={13} color={colors.ink} style={{ minWidth: 70, textAlign: 'right' }}>
                    {money(i.lineTotal)}
                  </Mono>
                </View>
              ))}
              <View style={[styles.item, { borderBottomWidth: 0 }]}>
                <Body weight="bold" color={colors.ink} style={{ flex: 1 }}>
                  {paid ? 'Paid' : 'Total'}
                </Body>
                <Mono size={17} color={colors.ink}>
                  {money(o.totalAmount)}
                </Mono>
              </View>
            </View>

            <View style={styles.perf}>
              <View style={[styles.notch, { left: -26 }]} />
              <View style={[styles.notch, { right: -26 }]} />
            </View>

            <View style={styles.qrRow}>
              {paid && o.collectionCode ? (
                <View style={styles.qr} accessible accessibilityLabel={`Collection QR code for ${o.collectionCode}`}>
                  <QRCode value={`SAVANNAH:SNACKS:${o.collectionCode}:${o.orderId}`} size={110} color={colors.ink} backgroundColor="#FFFFFF" ecl="M" />
                </View>
              ) : null}
              <View style={{ flex: 1, gap: 6 }}>
                <Mono size={10.5} color="#6B6457" bold={false}>
                  COLLECTION CODE
                </Mono>
                <Mono size={24} color={colors.ink} selectable>
                  {o.collectionCode ?? '—'}
                </Mono>
                <Body size={12.5} color={colors.inkSoft}>
                  {paid
                    ? 'Show this at the kiosk before your film.'
                    : o.status === 'CANCELLED'
                      ? 'This order was cancelled with its booking.'
                      : 'Your code appears once the booking is paid.'}
                </Body>
              </View>
            </View>
          </Animated.View>
        )}
        <SiteFooter />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  paper: { marginHorizontal: space.gutter, marginTop: 16, backgroundColor: colors.bone, borderRadius: radius.paper },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderBottomWidth: 1, borderBottomColor: '#D8CDB6' },
  perf: { marginHorizontal: 14, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#B9AE97' },
  notch: { position: 'absolute', top: -12, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.night },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  qr: { padding: 8, backgroundColor: '#FFFFFF' },
});
