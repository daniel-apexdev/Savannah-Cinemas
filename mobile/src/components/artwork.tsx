import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

import { Display, Mono } from './type';

/** TMDB serves several widths; pick one that fits instead of always the original. */
export function sized(url: string | null | undefined, width: 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280') {
  if (!url) return null;
  return url.replace(/(image\.tmdb\.org\/t\/p\/)(w\d+|original)\//, `$1${width}/`);
}

type PosterProps = {
  url?: string | null;
  title: string;
  meta?: string | null; // e.g. "2026 · PG-13"
  width: number;
  style?: StyleProp<ViewStyle>;
  size?: 'w185' | 'w342' | 'w500';
  border?: string;
};

/**
 * Film poster at 2:3. When artwork is missing or fails to load we
 * typeset the title on the booth colour — never a stock image.
 */
export function Poster({ url, title, meta, width, style, size = 'w342', border }: PosterProps) {
  const [failed, setFailed] = useState(false);
  const height = Math.round(width * 1.5);
  const src = sized(url, size);
  const box = [
    styles.poster,
    { width, height },
    border ? { borderWidth: 3, borderColor: border } : null,
    style,
  ];

  if (!src || failed) {
    // Size the title so its longest word fits on one line (no mid-word breaks).
    const pad = Math.max(6, width / 12);
    const longest = Math.max(4, ...title.split(/\s+/).map((w) => w.length));
    const fs = Math.max(8, Math.min(30, width / 5, (width - pad * 2) / (longest * 0.55)));
    return (
      <View style={[box, styles.fallback, { padding: pad }]} accessibilityLabel={`${title} (no artwork)`}>
        {meta ? <Mono size={Math.max(9, width / 13)} color={colors.dust} bold={false}>{meta}</Mono> : <View />}
        <Display size={fs} black numberOfLines={4} accessibilityRole="text">
          {title}
        </Display>
        <View style={{ height: 4, width: Math.max(18, width / 4), backgroundColor: colors.laterite }} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: src }}
      style={StyleSheet.flatten(box) as ImageStyle}
      contentFit="cover"
      transition={180}
      recyclingKey={src}
      onError={() => setFailed(true)}
      accessibilityLabel={`${title} poster`}
      placeholder={{ blurhash: 'L03lE#-;fQ-;~qWBfQWBfQfQfQfQ' }}
    />
  );
}

/** 16:9 backdrop; falls back to the poster scaled, then to a quiet band. */
export function Backdrop({
  url,
  fallbackUrl,
  width,
  height,
  title,
}: {
  url?: string | null;
  fallbackUrl?: string | null;
  width: number;
  height: number;
  title: string;
}) {
  const [stage, setStage] = useState<0 | 1 | 2>(url ? 0 : fallbackUrl ? 1 : 2);
  const src = stage === 0 ? sized(url, 'w1280') : stage === 1 ? sized(fallbackUrl, 'w780') : null;
  if (!src) {
    return (
      <View style={{ width, height, backgroundColor: colors.booth, justifyContent: 'flex-end', padding: 20 }}>
        <View style={{ height: 6, width: 48, backgroundColor: colors.laterite }} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: src }}
      style={{ width, height, backgroundColor: colors.booth }}
      contentFit="cover"
      contentPosition={stage === 1 ? 'top' : 'center'}
      transition={200}
      onError={() => setStage((s) => (s === 0 && fallbackUrl ? 1 : 2))}
      accessibilityLabel={`${title} backdrop`}
    />
  );
}

const styles = StyleSheet.create({
  poster: { borderRadius: radius.poster, backgroundColor: colors.booth, overflow: 'hidden' },
  fallback: {
    borderWidth: 1,
    borderColor: colors.rule,
    justifyContent: 'space-between',
  },
});
