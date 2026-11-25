import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space, touch } from '@/theme';

import { StackHeader } from './header';
import { Body, Label, Mono } from './type';
import { SiteFooter } from '@/components/site-footer';

const MAX_W = 560;

/** Stacked settings page: header, scrolling body, optional pinned footer (e.g. Save). */
export function SettingsScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string | null;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.night }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StackHeader title={title} subtitle={subtitle} fallback="/account" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width, alignSelf: 'center', paddingHorizontal: space.gutter, paddingTop: 6, paddingBottom: 40, gap: 18 }}>
        {children}
        <SiteFooter />
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
          <View style={{ width: width - space.gutter * 2, alignSelf: 'center', gap: 10 }}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** A group of rows under a small mono heading. */
export function Group({ title, children, note }: { title?: string; children: ReactNode; note?: string }) {
  return (
    <View>
      {title ? <Label style={{ paddingBottom: 4 }}>{title.toUpperCase()}</Label> : null}
      <View style={styles.group}>{children}</View>
      {note ? (
        <Body size={12.5} color={colors.dust} style={{ marginTop: 8 }}>
          {note}
        </Body>
      ) : null}
    </View>
  );
}

/** Tappable row: label (+ optional detail underneath), value on the right, arrow. */
export function NavRow({
  label,
  detail,
  value,
  onPress,
  tone = 'normal',
  accessibilityHint,
}: {
  label: string;
  detail?: string | null;
  value?: string | null;
  onPress: () => void;
  tone?: 'normal' | 'danger';
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.booth }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Body weight="semi" color={tone === 'danger' ? colors.lateriteSoft : colors.bone}>
          {label}
        </Body>
        {detail ? (
          <Body size={12.5} color={colors.dust} numberOfLines={2}>
            {detail}
          </Body>
        ) : null}
      </View>
      {value ? (
        <Body size={14} color={colors.dust} numberOfLines={1} style={{ flexShrink: 1, maxWidth: '50%', textAlign: 'right' }}>
          {value}
        </Body>
      ) : null}
      {tone === 'danger' ? null : (
        <Mono size={14} color={colors.dust}>
          →
        </Mono>
      )}
    </Pressable>
  );
}

/** Read-only row. */
export function InfoRow({ label, value, selectable }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}, ${value}`}>
      <Body color={colors.dust}>{label}</Body>
      <Body color={colors.bone} numberOfLines={1} selectable={selectable} style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </Body>
    </View>
  );
}

/** On/off row. */
export function ToggleRow({
  label,
  detail,
  value,
  onChange,
  disabled,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={styles.row}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Body weight="semi" color={colors.bone}>
          {label}
        </Body>
        {detail ? (
          <Body size={12.5} color={colors.dust}>
            {detail}
          </Body>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.rule, true: colors.laterite }}
        thumbColor={colors.bone}
        ios_backgroundColor={colors.rule}
        // react-native-web colours the "on" thumb separately
        {...(Platform.OS === 'web' ? ({ activeThumbColor: colors.bone } as object) : null)}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

/** Inline notice: an outcome after an action. */
export function Notice({ tone = 'ok', children }: { tone?: 'ok' | 'error'; children: ReactNode }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { borderLeftColor: tone === 'ok' ? colors.bone : colors.laterite }]}>
      <Body size={14} color={tone === 'ok' ? colors.bone : colors.lateriteSoft}>
        {children}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderTopWidth: 1, borderTopColor: colors.rule },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: Math.max(touch, 56),
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  footer: { borderTopWidth: 1, borderTopColor: colors.rule, backgroundColor: colors.night, paddingTop: 12, paddingHorizontal: space.gutter },
  notice: { borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 6 },
});
