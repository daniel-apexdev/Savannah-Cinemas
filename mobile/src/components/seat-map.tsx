import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Seat } from '@/lib/types';
import { colors, fonts } from '@/theme';

import { Mono } from './type';
import { ZoomBox } from './zoom-box';

export type SeatKind = 'STANDARD' | 'VIP' | 'WHEELCHAIR' | string;

export const seatKind = (s: Seat): SeatKind => (s.seatType ? s.seatType.toUpperCase() : 'STANDARD');

type Props = {
  seats: Seat[];
  selected: Set<number>;
  onToggle: (seat: Seat) => void;
  width: number;
  priceOf: (seat: Seat) => string;
  /** Told when the plan is zoomed (> 1) so the page can stop scrolling */
  onZoomChange?: (zoom: number) => void;
};

/**
 * The hall plan, built from the screen's real seat rows. Rows made
 * only of wheelchair spaces sit at the back. Seat number gaps in the
 * data become gaps in the plan.
 */
export function SeatMap({ seats, selected, onToggle, width, priceOf, onZoomChange }: Props) {
  const [zoom, setZoom] = useState(1);
  const rows = new Map<string, Seat[]>();
  for (const s of seats) {
    if (!rows.has(s.rowLabel)) rows.set(s.rowLabel, []);
    rows.get(s.rowLabel)!.push(s);
  }
  const ordered = [...rows.entries()]
    .map(([label, list]) => ({ label, list: list.sort((a, b) => a.seatNumber - b.seatNumber) }))
    .sort((a, b) => {
      const aw = a.list.every((s) => seatKind(s) === 'WHEELCHAIR');
      const bw = b.list.every((s) => seatKind(s) === 'WHEELCHAIR');
      if (aw !== bw) return aw ? 1 : -1;
      return a.label.localeCompare(b.label, undefined, { numeric: true });
    });

  // The whole hall fits the width; zoom in to make seats bigger
  const maxNum = Math.max(1, ...seats.map((s) => s.seatNumber));
  const gap = maxNum > 14 ? 4 : 6;
  const labelW = 18;
  const avail = width - 2 * labelW - 2 * gap - 24;
  const size = Math.max(12, Math.min(34, Math.floor((avail - gap * (maxNum - 1)) / maxNum)));
  const rowGap = Math.max(6, Math.round(size * 0.28));
  const height = ordered.length * size + Math.max(0, ordered.length - 1) * rowGap + 16;
  // Seat numbers once each seat is big enough on screen to read them
  const numbers = size * zoom >= 30;

  const plan = (
    <View style={{ gap: rowGap, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, height }}>
      {ordered.map(({ label, list }) => {
        const byNum = new Map(list.map((s) => [s.seatNumber, s]));
        const lastNum = list[list.length - 1]?.seatNumber ?? 0;
        const cells: (Seat | null)[] = [];
        for (let n = 1; n <= lastNum; n++) cells.push(byNum.get(n) ?? null);
        return (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap }}>
            <RowLabel label={label} />
            {cells.map((s, i) =>
              s ? (
                <SeatCell key={s.seatId} seat={s} size={size} on={selected.has(s.seatId)} onToggle={onToggle} price={priceOf(s)} numbers={numbers} />
              ) : (
                <View key={`gap-${i}`} style={{ width: size, height: size }} />
              ),
            )}
            <RowLabel label={label} />
          </View>
        );
      })}
    </View>
  );

  return (
    <ZoomBox
      width={width}
      height={height}
      onZoomChange={(z) => {
        setZoom(z);
        onZoomChange?.(z);
      }}>
      {plan}
    </ZoomBox>
  );
}

const RowLabel = ({ label }: { label: string }) => (
  <Mono size={11} color={colors.dust} bold={false} style={{ width: 18, textAlign: 'center' }} accessibilityElementsHidden importantForAccessibility="no">
    {label}
  </Mono>
);

const SeatCell = memo(function SeatCell({
  seat,
  size,
  on,
  onToggle,
  price,
  numbers,
}: {
  seat: Seat;
  size: number;
  on: boolean;
  onToggle: (s: Seat) => void;
  price: string;
  numbers?: boolean;
}) {
  const kind = seatKind(seat);
  const wheel = kind === 'WHEELCHAIR';
  const vip = kind === 'VIP';
  const inactive = seat.status === 'INACTIVE';
  const taken = seat.status === 'BOOKED';
  const shape = { width: size, height: size, borderRadius: wheel ? size / 2 : 0, borderTopLeftRadius: wheel ? size / 2 : 3, borderTopRightRadius: wheel ? size / 2 : 3, borderBottomLeftRadius: wheel ? size / 2 : 7, borderBottomRightRadius: wheel ? size / 2 : 7 };

  if (inactive) return <View style={shape} accessibilityElementsHidden importantForAccessibility="no" />;

  const label = `Seat ${seat.seatLabel}, ${wheel ? 'wheelchair space' : vip ? 'VIP' : 'standard'}, ${taken ? 'taken' : on ? `selected, ${price}` : price}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on, disabled: taken }}
      disabled={taken}
      onPress={() => onToggle(seat)}
      hitSlop={size < 20 ? 1 : 3}
      style={({ pressed }) => [
        styles.seat,
        shape,
        taken
          ? styles.taken
          : on
            ? styles.on
            : wheel
              ? styles.wheel
              : vip
                ? styles.vip
                : styles.open,
        pressed && !taken && { transform: [{ translateY: 1 }, { scale: 0.94 }] },
        on && { transform: [{ translateY: -2 }] },
      ]}>
      {taken ? (
        <View style={[styles.slash, { width: size * 0.9 }]} />
      ) : wheel ? (
        <Text style={[styles.mark, { color: on ? colors.ink : colors.dust, fontSize: Math.max(6, size * 0.38) }]}>W</Text>
      ) : on || numbers ? (
        <Text style={[styles.mark, { color: on ? colors.ink : colors.dust, fontSize: Math.max(6, size * 0.38) }]}>{seat.seatNumber}</Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  seat: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  open: { borderWidth: 1.5, borderColor: colors.bone },
  vip: { borderWidth: 1.5, borderColor: colors.vip, borderBottomWidth: 6 },
  wheel: { borderWidth: 1.5, borderColor: colors.dust },
  on: { backgroundColor: colors.laterite },
  taken: { backgroundColor: colors.taken },
  slash: { height: 2, backgroundColor: colors.takenStripe, transform: [{ rotate: '-45deg' }] },
  mark: { fontFamily: fonts.monoBold, fontSize: 10 },
});
