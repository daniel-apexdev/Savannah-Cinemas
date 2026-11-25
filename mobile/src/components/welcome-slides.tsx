import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { BellIcon } from '@/components/icons';
import { LogoMark } from '@/components/logo';
import { TrophyMedal } from '@/components/trophy';
import { Display, Label, Mono } from '@/components/type';
import { avatarByKey } from '@/lib/avatars';
import type { Trophy } from '@/lib/types';
import { colors, radius, space } from '@/theme';

/**
 * The welcome tour: the app's first-open screens (app/welcome.tsx) and
 * the website's first-visit pop-up (components/welcome-tour.tsx).
 */
export type Slide = { key: string; kicker: string; title: string; body: string; art: (w: number) => ReactNode };

export const APP_SLIDES: Slide[] = [
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

/** The website: browse and book without an account; an account adds the extras. */
export const WEB_SLIDES: Slide[] = [
  {
    key: 'hello',
    kicker: 'ACCRA MALL · WEST HILLS MALL',
    title: 'Welcome to Savannah Cinemas',
    body: 'Here’s what you can do on the website. It takes a minute to book, and you don’t need an account.',
    art: (w) => <LogoMark size={Math.min(170, w * 0.42)} />,
  },
  {
    key: 'seats',
    kicker: 'BOOK',
    title: 'Pick your exact seats',
    body: 'Choose your cinema and a showtime, pick the seats you want on the hall map, and pay online with Mobile Money or a card.',
    art: (w) => <SeatArt width={Math.min(300, w * 0.75)} />,
  },
  {
    key: 'snacks',
    kicker: 'SNACKS',
    title: 'Popcorn, ready and waiting',
    body: 'Add popcorn, drinks and combos while you book, then collect them at the counter with your code.',
    art: (w) => <SvgXml xml={avatarByKey.get('popcorn')!.svg} width={Math.min(150, w * 0.4)} height={Math.min(150, w * 0.4)} />,
  },
  {
    key: 'tickets',
    kicker: 'TICKETS',
    title: 'Tickets straight to your inbox',
    body: 'Give your email at checkout and we’ll send your QR ticket and receipt. Show the code at the door.',
    art: () => <TicketArt />,
  },
  {
    key: 'rewards',
    kicker: 'FREE ACCOUNT',
    title: 'Want the extras?',
    body: 'Create a free account to earn points and trophies, keep every ticket on any device, save a watchlist and get reminders before showtime.',
    art: (w) => <TrophyArt width={w} />,
  },
];

/* ---------- Slide art (drawn, no stock imagery) ---------- */

export function SeatArt({ width }: { width: number }) {
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

export function TrophyArt({ width }: { width: number }) {
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

export function TicketArt() {
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
