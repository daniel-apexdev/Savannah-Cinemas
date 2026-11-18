import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, isWeb, radius, touch } from '@/theme';

import { Label } from './type';

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: 'primary' | 'outline' | 'outlineInk' | 'quiet';
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  left?: ReactNode;
  height?: number;
};

/** Condensed-caps action. Primary is the one laterite light on a screen. */
export function Button({ label, variant = 'primary', busy, disabled, style, left, height = 52, ...rest }: ButtonProps) {
  const isDisabled = disabled || busy;
  const fg =
    variant === 'primary' ? colors.ink : variant === 'outlineInk' ? colors.ink : variant === 'quiet' ? colors.lateriteSoft : colors.bone;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!busy }}
      accessibilityLabel={label}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.btn,
        { height },
        variant === 'primary' && { backgroundColor: colors.laterite },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.bone },
        variant === 'outlineInk' && { borderWidth: 1.5, borderColor: colors.ink },
        variant === 'quiet' && { height: touch, paddingHorizontal: 0 },
        isDisabled && { opacity: 0.4 },
        pressed && !isDisabled && { transform: [{ translateY: 1 }], opacity: 0.88 },
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {left}
          <Text
            maxFontSizeMultiplier={1.3}
            style={[styles.btnText, { color: fg, fontSize: variant === 'quiet' ? 18 : 21 }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export type TokenState = 'open' | 'chosen' | 'few' | 'full';

/** A showtime as a tappable mono time token. */
export function TimeToken({
  time,
  note,
  state = 'open',
  onPress,
  accessibilityLabel,
}: {
  time: string;
  note?: string;
  state?: TokenState;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const full = state === 'full';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? time}
      accessibilityState={{ selected: state === 'chosen', disabled: full }}
      disabled={full || !onPress}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.token,
        state === 'open' && { borderColor: colors.bone },
        state === 'chosen' && { backgroundColor: colors.laterite, borderColor: colors.laterite },
        state === 'few' && { borderColor: colors.laterite, borderStyle: 'dashed' },
        full && { borderColor: colors.rule },
        pressed && { opacity: 0.75 },
      ]}>
      <Text
        style={[
          styles.tokenText,
          state === 'chosen' && { color: colors.ink },
          state === 'few' && { color: colors.lateriteSoft },
          full && { color: colors.disabled, textDecorationLine: 'line-through' },
        ]}>
        {time}
        {note ? ` · ${note}` : ''}
      </Text>
    </Pressable>
  );
}

/** Square icon button with a solid ground (never a scrim over artwork). */
export function IconButton({
  children,
  onPress,
  label,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.icon, pressed && { opacity: 0.7 }, style]}>
      {children}
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label: string; error?: string | null };

export const Field = forwardRef<ComponentRef<typeof TextInput>, FieldProps>(function Field({ label, error, style, ...rest }, ref) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label.toUpperCase()}</Label>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.disabled}
        selectionColor={colors.laterite}
        accessibilityLabel={label}
        {...rest}
        style={[styles.input, !!error && { borderColor: colors.laterite }, style]}
      />
      {error ? <Label color={colors.lateriteSoft}>{error}</Label> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.action,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontFamily: fonts.display, textTransform: 'uppercase', letterSpacing: 0.4 },
  token: {
    minHeight: touch,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: radius.action,
    justifyContent: 'center',
  },
  tokenText: { fontFamily: fonts.monoBold, fontSize: 15, color: colors.bone },
  icon: {
    width: touch,
    height: touch,
    borderRadius: radius.action,
    backgroundColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 52,
    borderBottomWidth: 1.5,
    borderColor: colors.bone,
    color: colors.bone,
    fontFamily: fonts.body,
    fontSize: 17,
    paddingHorizontal: 0,
    ...(isWeb ? ({ outlineStyle: 'none' } as object) : null),
  },
});
