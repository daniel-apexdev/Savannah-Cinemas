import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tick } from '@/lib/feel';
import { locationName, setLocation, useLocation } from '@/lib/location';
import { colors, radius, space } from '@/theme';

import { Body, Display, Label, Mono } from './type';

/** The place line under the masthead: "ACCRA MALL ▾". Opens a picker. */
export function LocationButton({ onChange }: { onChange?: (cinemaId: number) => void }) {
  const { cinemas, cinemaId, name } = useLocation();
  const [open, setOpen] = useState(false);
  const many = cinemas.length > 1;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name ? `Location: ${name}. ${many ? 'Change location' : ''}` : 'Choose a location'}
        disabled={!many}
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}>
        <PinIcon />
        <Mono size={12} color={colors.bone} numberOfLines={1}>
          {(name ?? '…').toUpperCase()}
        </Mono>
        {many ? <Chevron /> : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <LocationSheet
          onClose={() => setOpen(false)}
          cinemaId={cinemaId}
          onPick={(id) => {
            tick();
            setLocation(id);
            setOpen(false);
            onChange?.(id);
          }}
        />
      </Modal>
    </>
  );
}

function LocationSheet({ cinemaId, onPick, onClose }: { cinemaId: number | null; onPick: (id: number) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { cinemas } = useLocation();
  return (
    <View style={styles.scrim}>
      <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} accessibilityViewIsModal>
        <Label>CHOOSE YOUR CINEMA</Label>
        <Display size={28}>Where are you watching?</Display>
        <View style={{ gap: 10, marginTop: 4 }}>
          {cinemas.map((c) => {
            const on = c.cinemaId === cinemaId;
            return (
              <Pressable
                key={c.cinemaId}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${locationName(c)}${c.address ? `, ${c.address}` : ''}`}
                onPress={() => onPick(c.cinemaId)}
                style={({ pressed }) => [styles.option, on && styles.optionOn, pressed && { opacity: 0.85 }]}>
                <View style={[styles.radio, on && { borderColor: colors.laterite }]}>{on ? <View style={styles.dot} /> : null}</View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Display size={22} color={colors.bone}>
                    {locationName(c)}
                  </Display>
                  {c.address ? (
                    <Body size={13} color={colors.dust} numberOfLines={2}>
                      {c.address.replace(new RegExp(`^${locationName(c)},\\s*`, 'i'), '')}
                    </Body>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Body size={12.5} color={colors.dust}>
          Showtimes, tickets and directions follow the cinema you pick. You can change it any time from Tonight.
        </Body>
      </View>
    </View>
  );
}

/**
 * Website (tablet and up): both cinemas side by side as a switch, each
 * with its area, instead of the small "ACCRA MALL ▾" line and a sheet.
 * `compact` drops the address line (for narrow panels).
 */
export function LocationTabs({ onChange, compact }: { onChange?: (cinemaId: number) => void; compact?: boolean }) {
  const { cinemas, cinemaId } = useLocation();
  if (cinemas.length < 2) return <LocationButton onChange={onChange} />;
  return (
    <View style={styles.tabs} accessibilityRole="radiogroup" accessibilityLabel="Cinema">
      {cinemas.map((c) => {
        const on = c.cinemaId === cinemaId;
        // The area: first part of the address after the mall's name that isn't a plot number
        const area =
          (c.address ?? '')
            .split(',')
            .map((x) => x.trim())
            .filter((x) => x && x.toLowerCase() !== locationName(c).toLowerCase() && !/^(plot|no\.?\s|\d)/i.test(x))[0] ?? c.city;
        return (
          <Pressable
            key={c.cinemaId}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${locationName(c)}${c.address ? `, ${c.address}` : ''}`}
            onPress={() => {
              if (on) return;
              tick();
              setLocation(c.cinemaId);
              onChange?.(c.cinemaId);
            }}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.tab,
              compact && styles.tabCompact,
              on && styles.tabOn,
              !on && hovered && { borderColor: colors.dust },
              pressed && { opacity: 0.85 },
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              {on ? <PinIcon /> : null}
              <Mono size={compact ? 11.5 : 12.5} color={on ? colors.ink : colors.bone}>
                {locationName(c).toUpperCase()}
              </Mono>
            </View>
            {!compact && area ? (
              <Body size={12} color={on ? colors.inkSoft : colors.dust} numberOfLines={1}>
                {area}
              </Body>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function PinIcon() {
  return (
    <View style={{ width: 12, height: 14, alignItems: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.laterite }} />
      <View style={{ width: 2, height: 4, backgroundColor: colors.laterite }} />
    </View>
  );
}

function Chevron() {
  return <View style={styles.chev} />;
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', minHeight: 28 },
  chev: {
    width: 7,
    height: 7,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.dust,
    transform: [{ rotate: '45deg' }],
    marginTop: -4,
    marginLeft: 2,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(6,5,4,0.78)' },
  sheet: { backgroundColor: colors.booth, padding: space.gutter, gap: 10, borderTopWidth: 1.5, borderTopColor: colors.bone },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.action,
  },
  optionOn: { borderColor: colors.bone, backgroundColor: colors.night },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.dust, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.laterite },
  // Website switch
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { minWidth: 150, paddingHorizontal: 14, paddingVertical: 9, gap: 2, borderWidth: 1.5, borderColor: colors.rule, borderRadius: radius.action },
  tabCompact: { minWidth: 0, paddingVertical: 7, paddingHorizontal: 10 },
  tabOn: { backgroundColor: colors.bone, borderColor: colors.bone },
});
