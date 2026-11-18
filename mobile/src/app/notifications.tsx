import { router } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Button } from '@/components/controls';
import { StackHeader } from '@/components/header';
import { BellIcon } from '@/components/icons';
import { Message, Shimmer } from '@/components/states';
import { Body, Label, Mono } from '@/components/type';
import { useAuth } from '@/lib/auth';
import { clock, dayFromKey, dayKey, shortDate } from '@/lib/format';
import { openNotification, useNotifications } from '@/lib/notify';
import type { AppNotification } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { colors, space } from '@/theme';

const MAX_W = 560;

const KIND_LABEL: Record<string, string> = {
  BOOKING_REMINDER: 'YOUR FILM TODAY',
  STARTING_SOON: 'STARTING SOON',
  FILM_ON_SALE: 'ON SALE',
  FILM_OPENING: 'NOW SHOWING',
  TROPHY: 'NEW TROPHY',
};

/** 'YYYY-MM-DDTHH:mm:ss' (cinema time) -> local Date */
function when(v: string) {
  const [d, t = '00:00'] = v.split('T');
  const date = dayFromKey(d);
  const [h, m] = t.split(':').map(Number);
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
}

/** The inbox: everything we've told you, newest first. Opening it marks all read. */
export default function Inbox() {
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const { user } = useAuth();
  const { items, unread, refresh, markAllRead } = useNotifications();
  const now = useNow();

  // Opening the inbox counts as reading it (the dots stay this visit)
  const readAll = useEffectEvent(() => {
    if (unread > 0) markAllRead();
  });
  useEffect(() => {
    refresh().then(() => readAll());
  }, [refresh]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night }}>
        <StackHeader title="Notifications" fallback="/account" />
        <Message title="Sign in for reminders" body="We’ll remind you before your films start and when films you’re waiting for open." action={<Button label="Sign in" onPress={() => router.push('/sign-in')} />} />
      </View>
    );
  }

  // Group by day
  const today = dayKey(new Date(now));
  const yesterday = dayKey(new Date(now - 86400000));
  const groups: { label: string; list: AppNotification[] }[] = [];
  for (const n of items ?? []) {
    const k = n.at.slice(0, 10);
    const label = k === today ? 'TODAY' : k === yesterday ? 'YESTERDAY' : 'EARLIER';
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.list.push(n);
    else groups.push({ label, list: [n] });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <StackHeader title="Notifications" subtitle={unread ? `${unread} NEW` : 'ALL CAUGHT UP'} fallback="/account" />
      {items == null ? (
        <View style={{ paddingHorizontal: space.gutter, gap: 12 }}>
          <Shimmer style={{ height: 72 }} />
          <Shimmer style={{ height: 72 }} />
        </View>
      ) : items.length === 0 ? (
        <Message
          title="Nothing yet"
          body="Booking reminders, opening days for films you’re waiting for, and new trophies will show up here."
          action={<Button label="See what’s coming" variant="outline" onPress={() => router.navigate('/events')} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ width, alignSelf: 'center', paddingBottom: 40, paddingHorizontal: space.gutter }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.bone} />}>
          {groups.map((g) => (
            <View key={g.label} style={{ marginBottom: 18 }}>
              <Label style={{ paddingBottom: 6 }}>{g.label}</Label>
              {g.list.map((n, i) => {
                const d = when(n.at);
                return (
                  <Pressable
                    key={n.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${n.read ? '' : 'New. '}${n.title}. ${n.body ?? ''}`}
                    onPress={() => openNotification(n)}
                    style={({ pressed }) => [styles.row, i === 0 && styles.first, pressed && { backgroundColor: colors.booth }]}>
                    <View style={[styles.icon, !n.read && { borderColor: colors.laterite }]}>
                      <BellIcon size={16} color={n.read ? colors.dust : colors.laterite} filled={!n.read} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Mono size={10.5} color={n.read ? colors.dust : colors.lateriteSoft}>
                        {KIND_LABEL[n.kind] ?? n.kind}
                      </Mono>
                      <Body weight="semi" color={colors.bone}>
                        {n.title}
                      </Body>
                      {n.body ? (
                        <Body size={13.5} color={colors.dust}>
                          {n.body}
                        </Body>
                      ) : null}
                    </View>
                    <Mono size={11} color={colors.dust} bold={false}>
                      {g.label === 'EARLIER' ? shortDate(d).split(' ').slice(1).join(' ') : clock(d)}
                    </Mono>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.rule, alignItems: 'flex-start' },
  first: { borderTopWidth: 1, borderTopColor: colors.rule },
  icon: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.rule, alignItems: 'center', justifyContent: 'center' },
});
