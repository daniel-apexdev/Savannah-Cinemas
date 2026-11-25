import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '@/theme';

import { sized } from './artwork';

/**
 * The profile header band: the user's chosen film still, fading into
 * the page at the bottom so the avatar and name sit cleanly on it.
 * With no still chosen it's a quiet booth-coloured band.
 */
export function ProfileBanner({
  url,
  width,
  height,
  children,
  large,
}: {
  url?: string | null;
  width: number;
  height: number;
  children?: ReactNode;
  /** Website: a full-width banner needs a bigger still */
  large?: boolean;
}) {
  const src = sized(url, large ? 'w1280' : 'w780');
  return (
    <View style={{ width, height, backgroundColor: colors.booth, overflow: 'hidden' }}>
      {src ? <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityIgnoresInvertColors /> : null}
      <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
        <Defs>
          <LinearGradient id="pb-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.night} stopOpacity={src ? 0.45 : 0} />
            <Stop offset="0.45" stopColor={colors.night} stopOpacity={src ? 0.1 : 0} />
            <Stop offset="1" stopColor={colors.night} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#pb-fade)" />
      </Svg>
      {children}
    </View>
  );
}
