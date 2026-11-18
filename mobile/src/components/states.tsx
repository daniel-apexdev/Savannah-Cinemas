import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { ApiError } from '@/lib/api';
import { API_BASE } from '@/lib/config';
import { useReducedMotion } from '@/lib/feel';
import { colors, space } from '@/theme';

import { Button } from './controls';
import { Body, Display, Label } from './type';

/** Breathing placeholder block for loading states. */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.9, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, v]);
  return <Animated.View style={[{ backgroundColor: colors.booth, borderRadius: 2, opacity: reduced ? 0.7 : v }, style]} />;
}

/** Full-area message: empty and error states share one calm layout. */
export function Message({
  kicker,
  title,
  body,
  action,
  style,
}: {
  kicker?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.msg, style]} accessibilityLiveRegion="polite">
      <View style={styles.bar} />
      {kicker ? <Label color={colors.lateriteSoft}>{kicker}</Label> : null}
      <Display size={34}>{title}</Display>
      {body ? <Body>{body}</Body> : null}
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry, style }: { error: ApiError; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  const offline = error.offline;
  return (
    <Message
      style={style}
      kicker={offline ? 'NO CONNECTION' : 'SOMETHING WENT WRONG'}
      title={offline ? 'The projector is off' : 'That reel jammed'}
      body={
        offline
          ? `${error.message}\n\nTrying ${API_BASE}`
          : error.message
      }
      action={onRetry ? <Button label="Try again" variant="outline" onPress={onRetry} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  msg: { paddingHorizontal: space.gutter, paddingVertical: space.xxl, gap: space.md },
  bar: { width: 48, height: 6, backgroundColor: colors.laterite, marginBottom: space.sm },
});
