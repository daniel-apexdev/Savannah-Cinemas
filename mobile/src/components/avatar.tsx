import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { initials } from '@/lib/auth';
import { avatarByKey } from '@/lib/avatars';
import type { User } from '@/lib/types';
import { colors } from '@/theme';

import { Mono } from './type';

/** A user's picked avatar, or their initials in a ring if they haven't picked one. */
export function Avatar({
  user,
  avatarKey,
  size = 44,
  ring,
  style,
}: {
  user?: User | null;
  avatarKey?: string | null;
  size?: number;
  /** Border colour drawn around it (e.g. to sit on a backdrop) */
  ring?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const art = avatarByKey.get(avatarKey ?? user?.avatar ?? '');
  const border = ring ? { borderWidth: Math.max(2, size * 0.04), borderColor: ring } : null;
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2 }, styles.base, !art && styles.empty, border, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {art ? (
        <SvgXml xml={art.svg} width="100%" height="100%" />
      ) : (
        <Mono size={Math.round(size * 0.32)} color={colors.bone}>
          {initials(user ?? null) || '?'}
        </Mono>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: 1.5, borderColor: colors.bone, backgroundColor: colors.night },
});
