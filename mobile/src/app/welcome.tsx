import { router } from 'expo-router';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { Button } from '@/components/controls';
import { BellIcon } from '@/components/icons';
import { LogoMark } from '@/components/logo';
import { TrophyMedal } from '@/components/trophy';
import { Body, Display, Label, Mono } from '@/components/type';
import { avatarByKey } from '@/lib/avatars';
import { tick } from '@/lib/feel';
import type { Trophy } from '@/lib/types';
import { markWelcomed } from '@/lib/welcome';
import { colors, radius, space } from '@/theme';

const MAX_W = 560;

type Slide = { key: string; kicker: string; title: string; body: string; art: (w: number) => ReactNode };

const SLIDES: Slide[] = [
  {
    key: 'hello',
    kicker: 'ACCRA MALL · WEST HILLS MALL',
    title: 'Welcome to Savannah Cinemas',
    body: 'Everything for a night at the pictures, in your pocket. Here’s what you can do.',
    art: (w) => <LogoMark size={Math.min(190, w * 0.48)} />,
  },
  {
    key: 'seats',
    kicker: 'BOOK',
    title: 'Pick your exact seats',
    body: 'Choose your cinema and a showtime, tap the seats you want on the hall map (pinch to zoom), and pay in the app.',
    art: (w) => <SeatArt width={Math.min(300, w * 0.75)} />,
  },
  {
    key: 'snacks',
    kicker: 'SNACKS',
    title: 'Popcorn, ready and waiting',
    body: 'Add popcorn, drinks and combos while you book, then collect them at the counter with your code.',
    art: (w) => <SvgXml xml={avatarByKey.get('popcorn')!.svg} width={Math.min(170, w * 0.42)} height={Math.min(170, w * 0.42)} />,
  },
  {
    key: 'rewards',
    kicker: 'SAVANNAH REWARDS',
    title: 'Earn points and trophies',
    body: 'Every film earns points to spend on tickets (100 points = GHS 2 off), and trophies for milestones like your first film, late nights and Ghana Month.',
    art: (w) => <TrophyArt width={w} />,
  },
  {
    key: 'tickets',
    kicker: 'TICKETS & REMINDERS',
    title: 'Never miss the start',
    body: 'Your tickets and QR codes live in your account. We remind you before showtime, and when films you’re waiting for open.',
    art: () => <TicketArt />,
  },
];

/**
 * First-open welcome: what the app does, then create an account, sign
 * in, or look around first. Shown once per device to signed-out users.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const last = index === SLIDES.length - 1;
  const artH = Math.max(170, Math.min(260, winH * 0.3));

  const go = (i: number) => {
    const next = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIndex(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };

  const leave = (then?: 'up' | 'in') => {
    markWelcomed();
    router.replace('/');
    if (then) setTimeout(() => router.push({ pathname: '/sign-in', params: { mode: then } }), 0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <View style={[styles.top, { paddingTop: insets.top + 8, width, alignSelf: 'center' }]}>
        <Mono size={11.5} color={colors.dust}>
          {`${index + 1} / ${SLIDES.length}`}
        </Mono>
        <Pressable accessibilityRole="button" onPress={() => leave()} hitSlop={10} style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}>
          <Mono size={12} color={colors.bone}>
            LOOK AROUND FIRST
          </Mono>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width, alignSelf: 'center', flexGrow: 1 }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScroll={(e) => {
          // Web has no momentum end event: follow the scroll position
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== index) setIndex(i);
        }}
        scrollEventThrottle={64}>
        {SLIDES.map((s) => (
          <View key={s.key} style={{ width, paddingHorizontal: space.gutter + 4, justifyContent: 'center' }} accessible accessibilityLabel={`${s.title}. ${s.body}`}>
            <View style={{ height: artH, alignItems: 'center', justifyContent: 'center' }}>{s.art(width)}</View>
            <View style={{ gap: 10, marginTop: 18 }}>
              <Label color={colors.laterite}>{s.kicker}</Label>
              <Display size={38} black>
                {s.title}
              </Display>
              <Body size={16} color={colors.boneSoft}>
                {s.body}
              </Body>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 6, width, alignSelf: 'center' }]}>
        <View style={styles.dots} accessibilityRole="tablist">
          {SLIDES.map((s, i) => (
            <Pressable
              key={s.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={`Slide ${i + 1}: ${s.title}`}
              hitSlop={8}
              onPress={() => {
                tick();
                go(i);
              }}>
              <View style={[styles.dot, i === index && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        {last ? (
          <>
            <Button label="Create account" onPress={() => leave('up')} />
            <Button label="I have an account · Sign in" variant="outline" onPress={() => leave('in')} />
          </>
        ) : (
          <>
            <Button
              label="Next"
              onPress={() => {
                tick();
                go(index + 1);
              }}
            />
            <Button label="Sign in" variant="outline" onPress={() => leave('in')} />
          </>
        )}
      </View>
    </View>
  );
}

/* ---------- Slide art (drawn, no stock imagery) ---------- */

function SeatArt({ width }: { width: number }) {
  const cols = 8;
  const gap = 5;
  const size = Math.floor((width - gap * (cols - 1)) / cols);
  const picked = new Set(['2-3', '2-4']);
  const taken = new Set(['0-1', '0-2', '1-5', '1-6', '3-0', '3-7', '4-2', '4-3']);
  return (
    <View style={{ width, alignItems: 'center', gap: 12 }} accessibilityElementsHidden>
      <View style={styles.screenArc} />
      <Label>SCREEN</Label>
      <View style={{ gap }}>
        {[0, 1, 2, 3, 4].map((r) => (
          <View key={r} style={{ flexDirection: 'row', gap }}>
            {Array.from({ length: cols }, (_, c) => {
              const k = `${r}-${c}`;
              const on = picked.has(k);
              const vip = r === 4 && c > 1 && c < 6;
              return (
                <View
                  key={k}
                  style={[
                    styles.seat,
                    { width: size, height: size * 0.82 },
                    vip && { borderColor: colors.vip },
                    taken.has(k) && { backgroundColor: colors.taken, borderColor: colors.taken },
                    on && { backgroundColor: colors.laterite, borderColor: colors.laterite },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const demo = (code: string, name: string, group: string): Trophy => ({
  code,
  name,
  group,
  description: '',
  hidden: false,
  earned: true,
  progress: null,
});

function TrophyArt({ width }: { width: number }) {
  const size = Math.min(92, (width - space.gutter * 2 - 24) / 3);
  return (
    <View style={{ alignItems: 'center', gap: 16 }} accessibilityElementsHidden>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
        <TrophyMedal trophy={demo('NIGHT_OWL', 'Night Owl', 'Habits')} size={size * 0.86} />
        <TrophyMedal trophy={demo('MADE_IN_GHANA', 'Made in Ghana', 'Challenges')} size={size * 1.1} />
        <TrophyMedal trophy={demo('FIRST_SCREENING', 'First Screening', 'Milestones')} size={size * 0.86} />
      </View>
      <View style={styles.points}>
        <Mono size={15} color={colors.ink}>
          +120 POINTS
        </Mono>
      </View>
    </View>
  );
}

function TicketArt() {
  return (
    <View style={{ alignItems: 'center' }} accessibilityElementsHidden>
      <View style={styles.ticket}>
        <View style={{ flex: 1, gap: 4 }}>
          <Mono size={10} color={colors.inkSoft}>
            TONIGHT · SCREEN 2
          </Mono>
          <Display size={24} black color={colors.ink}>
            19:40
          </Display>
          <Mono size={11} color={colors.ink}>
            SEATS D4 D5
          </Mono>
        </View>
        <View style={styles.qr}>
          {Array.from({ length: 25 }, (_, i) => (
            <View key={i} style={[styles.qrCell, (i * 7 + (i % 3)) % 3 === 0 && { backgroundColor: colors.ink }]} />
          ))}
        </View>
      </View>
      <View style={styles.bellBubble}>
        <BellIcon size={22} color={colors.ink} filled />
        <Mono size={12} color={colors.ink}>
          STARTS IN 30 MIN
        </Mono>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 6 },
  skip: { height: 36, justifyContent: 'center' },
  bottom: { paddingHorizontal: space.gutter, gap: 10, paddingTop: 10 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rule },
  dotOn: { width: 24, backgroundColor: colors.laterite },
  screenArc: { width: '90%', height: 18, borderTopWidth: 3, borderColor: colors.bone, borderTopLeftRadius: 200, borderTopRightRadius: 200 },
  seat: { borderWidth: 1.5, borderColor: colors.dust, borderRadius: 3 },
  points: { backgroundColor: colors.vip, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.action },
  ticket: {
    width: 250,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.bone,
    borderRadius: 4,
    transform: [{ rotate: '-4deg' }],
  },
  qr: { width: 64, height: 64, flexDirection: 'row', flexWrap: 'wrap', gap: 2, padding: 2, backgroundColor: '#fff' },
  qrCell: { width: 10, height: 10, backgroundColor: '#fff' },
  bellBubble: {
    marginTop: -6,
    marginLeft: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.vip,
    borderRadius: 20,
    transform: [{ rotate: '3deg' }],
  },
});
