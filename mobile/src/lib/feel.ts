import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { getSetting } from './settings';

/** Light tick for seat taps etc. No-op on web. */
export function tick() {
  if (Platform.OS === 'web' || !getSetting('haptics')) return;
  Haptics.selectionAsync().catch(() => {});
}

export function success() {
  if (Platform.OS === 'web' || !getSetting('haptics')) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Respect the OS "reduce motion" setting: animations become instant cuts. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}
