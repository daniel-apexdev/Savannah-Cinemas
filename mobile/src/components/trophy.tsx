import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Trophy } from '@/lib/types';
import { colors, fonts } from '@/theme';

import { TrophyIcon, hasTrophyIcon } from './trophy-icons';

/** Two letters for the medal: initials, or the first two letters of a single word. */
export function monogram(name: string) {
  const words = name
    .replace(/[’'&]/g, '')
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w) && !/^(the|of|in|a)$/i.test(w));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * A trophy medal: a ticket-perforated disc. Earned medals are solid
 * (gold for seasonal challenges, laterite for hidden ones, bone for the
 * rest); locked ones are an outline with a progress arc.
 */
export function TrophyMedal({ trophy, size = 76 }: { trophy: Trophy; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const p = trophy.progress ? Math.min(1, trophy.progress.current / Math.max(1, trophy.progress.target)) : 0;
  const fill = trophy.group === 'Challenges' ? colors.vip : trophy.group === 'Hidden' ? colors.laterite : colors.bone;
  const locked = !trophy.earned;
  const mystery = locked && trophy.hidden;
  const icon = !mystery && hasTrophyIcon(trophy.code);

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {locked ? (
          <>
            <Circle cx={50} cy={50} r={r} stroke={colors.rule} strokeWidth={4} fill="none" />
            {p > 0 ? (
              <Circle
                cx={50}
                cy={50}
                r={r}
                stroke={colors.laterite}
                strokeWidth={4}
                fill="none"
                strokeDasharray={`${c * p} ${c}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            ) : null}
            <Circle cx={50} cy={50} r={34} stroke={colors.rule} strokeWidth={1.5} strokeDasharray="3 4" fill="none" />
          </>
        ) : (
          <>
            <Circle cx={50} cy={50} r={47} fill={fill} />
            <Circle cx={50} cy={50} r={38} stroke={colors.night} strokeWidth={2} strokeDasharray="4 4" fill="none" opacity={0.55} />
          </>
        )}
        {icon ? <TrophyIcon code={trophy.code} color={locked ? colors.dust : colors.night} bg={locked ? colors.night : fill} muted={locked} /> : null}
      </Svg>
      {icon ? null : (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.center}>
            <Text
              maxFontSizeMultiplier={1}
              style={{
                fontFamily: fonts.displayBlack,
                fontSize: size * 0.3,
                lineHeight: size * 0.36,
                color: locked ? colors.dust : colors.night,
                letterSpacing: 0.5,
              }}>
              {mystery ? '?' : monogram(trophy.name)}
            </Text>
          </View>
        </View>
      )}
      {trophy.isNew ? <View style={[styles.newDot, { right: size * 0.04, top: size * 0.04 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  newDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.laterite,
    borderWidth: 2,
    borderColor: colors.night,
  },
});
