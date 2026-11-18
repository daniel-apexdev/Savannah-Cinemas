import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Group, NavRow, SettingsScreen } from '@/components/settings-ui';
import { ErrorState, Shimmer } from '@/components/states';
import { Body, Display, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { HOLD_MINUTES } from '@/lib/config';
import { openDirections } from '@/lib/directions';
import { useRequest } from '@/lib/use-request';
import { colors } from '@/theme';

const shortName = (n: string) => n.replace(/^Savannah Cinemas\s*[-–]\s*/i, '');

// Only things the app itself does, so nothing here can contradict the
// cinema's own policies.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'How do I get in?',
    a: 'Open the ticket from Account and show the QR code at the door. Turn your screen brightness up if the scanner struggles.',
  },
  {
    q: 'How long are seats held?',
    a: `Seats you choose are held for ${HOLD_MINUTES} minutes while you add snacks and pay. If time runs out they go back on sale and you can choose again.`,
  },
  {
    q: 'Where do I collect snacks?',
    a: 'At the kiosk. Give them the collection code shown on your ticket in Account and in your confirmation email.',
  },
  {
    q: 'I didn’t finish paying. What now?',
    a: 'Unpaid bookings show “Awaiting payment” in Account until the hold runs out. Tap one to pay, or release the seats.',
  },
  {
    q: 'Can I change or cancel a booking?',
    a: 'Open the ticket and choose Cancel booking (or Release seats if you haven’t paid). Your seats go back on sale. Refunds follow the cinema’s refund policy, so contact them below with any questions.',
  },
];

export default function Help() {
  const cinemas = useRequest(() => api.cinemas(), []);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <SettingsScreen title="Help" subtitle="QUESTIONS & CONTACT">
      <Group title="Common questions">
        {FAQ.map((f, i) => {
          const on = open === i;
          return (
            <Pressable
              key={f.q}
              accessibilityRole="button"
              accessibilityState={{ expanded: on }}
              onPress={() => setOpen(on ? null : i)}
              style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.rule, gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Body weight="semi" color={colors.bone} style={{ flex: 1 }}>
                  {f.q}
                </Body>
                <Mono size={16} color={colors.dust}>
                  {on ? '–' : '+'}
                </Mono>
              </View>
              {on ? <Body size={14}>{f.a}</Body> : null}
            </Pressable>
          );
        })}
      </Group>

      {cinemas.loading ? (
        <Shimmer style={{ height: 120 }} />
      ) : cinemas.error && !cinemas.data ? (
        <ErrorState error={cinemas.error} onRetry={cinemas.reload} />
      ) : (
        (cinemas.data ?? [])
          .filter((c) => c.isActive !== false)
          .map((c) => (
            <View key={c.cinemaId} style={{ gap: 6 }}>
              <Display size={24}>{shortName(c.cinemaName)}</Display>
              {[c.address, c.city !== c.address ? c.city : null, c.region].filter(Boolean).length ? (
                <Body size={14} color={colors.dust}>
                  {[c.address, c.city !== c.address ? c.city : null, c.region].filter(Boolean).join(', ')}
                </Body>
              ) : null}
              <Group>
                <NavRow
                  label="Directions"
                  value={/mall/i.test(c.address ?? '') ? (c.address ?? '').split(',')[0] : 'Open in Maps'}
                  accessibilityHint="Opens Google Maps"
                  onPress={() => openDirections(c)}
                />
                {c.phoneNumber ? (
                  <NavRow
                    label="Call"
                    value={c.phoneNumber}
                    accessibilityHint="Opens your phone app"
                    onPress={() => Linking.openURL(`tel:${c.phoneNumber!.replace(/[^\d+]/g, '')}`).catch(() => {})}
                  />
                ) : null}
                {c.email ? (
                  <NavRow
                    label="Email"
                    value={c.email}
                    accessibilityHint="Opens your mail app"
                    onPress={() => Linking.openURL(`mailto:${c.email}`).catch(() => {})}
                  />
                ) : null}
              </Group>
            </View>
          ))
      )}
    </SettingsScreen>
  );
}
