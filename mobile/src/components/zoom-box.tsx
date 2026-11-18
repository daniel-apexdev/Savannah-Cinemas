import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme';

import { Mono } from './type';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
const STEP = 0.75;

/**
 * Pinch to zoom, drag to look around when zoomed, plus +/− and Fit
 * buttons (for one hand, or anyone who can't pinch). Children stay
 * tappable at any zoom: touches map through the transform.
 *
 * onZoomChange tells the parent when it's zoomed, so it can stop its
 * own scrolling while a drag is moving the plan instead.
 */
export function ZoomBox({
  children,
  width,
  height,
  onZoomChange,
}: {
  children: ReactNode;
  width: number;
  height: number;
  onZoomChange?: (zoom: number) => void;
}) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ s: 1, x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const report = (z: number) => {
    const rounded = Math.round(z * 100) / 100;
    setZoom(rounded);
    onZoomChange?.(rounded);
  };

  // Keep the content covering the box (no dragging it off into space)
  const clamp = (v: number, s: number, size: number) => {
    'worklet';
    const max = (size * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, v));
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = { s: scale.value, x: tx.value, y: ty.value };
    })
    .onUpdate((e) => {
      const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.value.s * e.scale));
      // Zoom around the fingers: the point under them stays put
      const fx = e.focalX - width / 2;
      const fy = e.focalY - height / 2;
      const k = s / start.value.s;
      tx.value = clamp(fx - (fx - start.value.x) * k, s, width);
      ty.value = clamp(fy - (fy - start.value.y) * k, s, height);
      scale.value = s;
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        runOnJS(report)(1);
      } else {
        runOnJS(report)(scale.value);
      }
    });

  const pan = Gesture.Pan()
    .enabled(zoom > 1)
    .minDistance(6)
    .averageTouches(true)
    .onStart(() => {
      start.value = { s: scale.value, x: tx.value, y: ty.value };
    })
    .onUpdate((e) => {
      tx.value = clamp(start.value.x + e.translationX, scale.value, width);
      ty.value = clamp(start.value.y + e.translationY, scale.value, height);
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const setTo = (z: number) => {
    const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    const k = s / zoom;
    scale.set(withTiming(s, { duration: 180 }));
    tx.set(withTiming(clamp(tx.get() * k, s, width), { duration: 180 }));
    ty.set(withTiming(clamp(ty.get() * k, s, height), { duration: 180 }));
    report(s);
  };

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View style={{ width, height, overflow: 'hidden' }} collapsable={false}>
          <Animated.View style={[{ width, height }, animated]}>{children}</Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.controls} accessibilityRole="toolbar">
        <ZoomButton label="−" a11y="Zoom out" disabled={zoom <= MIN_ZOOM} onPress={() => setTo(zoom - STEP)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={zoom > 1 ? 'Fit the whole hall' : 'Pinch or use plus to zoom in'}
          disabled={zoom <= 1}
          onPress={() => setTo(1)}
          style={styles.fit}>
          <Mono size={11} color={zoom > 1 ? colors.bone : colors.dust}>
            {zoom > 1 ? `${zoom.toFixed(1)}× · FIT` : 'PINCH TO ZOOM'}
          </Mono>
        </Pressable>
        <ZoomButton label="+" a11y="Zoom in" disabled={zoom >= MAX_ZOOM} onPress={() => setTo(zoom + STEP)} />
      </View>
    </View>
  );
}

function ZoomButton({ label, a11y, disabled, onPress }: { label: string; a11y: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, disabled && { opacity: 0.35 }, pressed && { backgroundColor: colors.booth }]}>
      <Mono size={18} color={colors.bone}>
        {label}
      </Mono>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 },
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.rule, borderRadius: 3 },
  fit: { height: 44, minWidth: 140, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
});
