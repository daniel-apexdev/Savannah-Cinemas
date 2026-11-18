import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

import { Display } from './type';

/** Bottom sheet over a dim scrim. Tapping the scrim closes it. */
export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.scrim}>
      <Pressable style={{ flex: 1 }} accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} disabled={!onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} accessibilityViewIsModal>
        <Display size={28}>{title}</Display>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,5,4,0.78)' },
  sheet: {
    backgroundColor: colors.booth,
    padding: space.gutter,
    gap: 14,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
    maxHeight: '85%',
  },
});
