import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SITE_MAX, useScreen } from '@/lib/layout';
import { colors, space } from '@/theme';

import { IconButton } from './controls';
import { BackIcon, CloseIcon } from './icons';
import { Display, Label } from './type';

export function goBack(fallback: string = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as any);
}

/** Back + marquee title + mono subtitle, used on stacked screens. */
export function StackHeader({
  title,
  subtitle,
  right,
  close,
  fallback = '/',
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  close?: boolean;
  fallback?: string;
}) {
  const insets = useSafeAreaInsets();
  // Website, tablet and up: line up with the site column, bigger title
  const { wide, width, gutter } = useScreen();
  return (
    <View
      style={[
        styles.wrap,
        { paddingTop: insets.top + 8 },
        wide && { paddingTop: 24, paddingBottom: 18, paddingHorizontal: Math.max(gutter, (width - SITE_MAX) / 2 + gutter), gap: 18 },
      ]}>
      <IconButton label={close ? 'Close' : 'Back'} onPress={() => goBack(fallback)} style={styles.back}>
        {close ? <CloseIcon /> : <BackIcon />}
      </IconButton>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Display size={wide ? 40 : 26} numberOfLines={1}>
          {title}
        </Display>
        {subtitle ? <Label numberOfLines={1}>{subtitle}</Label> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.gutter,
    paddingBottom: space.md,
    backgroundColor: colors.night,
  },
  back: { borderWidth: 1.5, borderColor: colors.rule },
});
