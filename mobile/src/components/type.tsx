import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts } from '@/theme';

type Props = TextProps & { color?: string; size?: number };

/**
 * Marquee titles: Big Shoulders, always capitals.
 * Line height must cover the font's full ascent + descent (1.197 em in
 * its metrics). Anything tighter clips the tops of the capitals on
 * iOS/Android, even though browsers draw it fine.
 */
const DISPLAY_LINE = 1.2;
export function Display({ style, color = colors.bone, size = 32, black, ...rest }: Props & { black?: boolean }) {
  return (
    <Text
      accessibilityRole={rest.accessibilityRole ?? 'header'}
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        styles.display,
        { color, fontSize: size, lineHeight: Math.ceil(size * DISPLAY_LINE), fontFamily: black ? fonts.displayBlack : fonts.display },
        style,
      ]}
    />
  );
}

/** Reading and UI copy. */
export function Body({ style, color = colors.boneSoft, size = 15, weight = 'regular', ...rest }: Props & { weight?: 'regular' | 'medium' | 'semi' | 'bold' }) {
  const fontFamily =
    weight === 'bold' ? fonts.bodyBold : weight === 'semi' ? fonts.bodySemi : weight === 'medium' ? fonts.bodyMedium : fonts.body;
  return <Text {...rest} style={[{ color, fontSize: size, lineHeight: Math.round(size * 1.45), fontFamily }, style]} />;
}

/** Anything printed on a ticket: times, seats, money, references. */
export function Mono({ style, color = colors.bone, size = 13, bold = true, ...rest }: Props & { bold?: boolean }) {
  return (
    <Text
      maxFontSizeMultiplier={1.5}
      {...rest}
      style={[{ color, fontSize: size, fontFamily: bold ? fonts.monoBold : fonts.mono, letterSpacing: 0.2 }, style]}
    />
  );
}

/** Small mono caps label, e.g. "NEXT UP · STARTS IN 34 MIN" */
export function Label({ style, color = colors.dust, ...rest }: Props) {
  return <Mono size={11.5} color={color} {...rest} style={[{ letterSpacing: 0.8 }, style]} />;
}

const styles = StyleSheet.create({
  display: { textTransform: 'uppercase', letterSpacing: 0.2 },
});
