import { Redirect, router } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/logo';
import { useAuth } from '@/lib/auth';
import { GUESTS_ALLOWED } from '@/lib/guest';
import { useWide } from '@/lib/layout';
import { useWelcomed } from '@/lib/welcome';
import { colors, fonts, space } from '@/theme';

/** Word-tabs. No icon row: the words are the marquee. */
const WordTab = forwardRef<ComponentRef<typeof View>, TabTriggerSlotProps & { label: string }>(function WordTab({ isFocused, label, ...props }, ref) {
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}>
      <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.tabText, { color: isFocused ? colors.laterite : colors.dust }]}>
        {label}
      </Text>
      <View style={[styles.mark, { backgroundColor: isFocused ? colors.laterite : 'transparent' }]} />
    </Pressable>
  );
});

/** Desktop web: the same tabs as a site header (logo left, words right). */
const NavLink = forwardRef<ComponentRef<typeof View>, TabTriggerSlotProps & { label: string }>(function NavLink({ isFocused, label, ...props }, ref) {
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="link"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={label}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.navLink, (pressed || hovered) && { opacity: 0.75 }]}>
      <Text style={[styles.navText, { color: isFocused ? colors.laterite : colors.bone }]}>{label}</Text>
      <View style={[styles.mark, { backgroundColor: isFocused ? colors.laterite : 'transparent' }]} />
    </Pressable>
  );
});

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const welcomed = useWelcomed();
  const wide = useWide();
  const { width: winW } = useWindowDimensions();
  // Phone app: nothing to see until you sign in (welcome slides first time)
  if (!user && !GUESTS_ALLOWED) return <Redirect href={welcomed === 'no' ? '/welcome' : { pathname: '/sign-in', params: { mode: 'in' } }} />;
  // Website, first visit: show the welcome slides (they can look around after)
  if (!user && welcomed === 'no') return <Redirect href="/welcome" />;

  if (wide) {
    return (
      <Tabs>
        {/* Triggers must be direct children of TabList (expo-router/ui doesn't look inside Views) */}
        <TabList style={[styles.header, { paddingHorizontal: Math.max(space.gutter, (winW - 1120) / 2 + space.gutter) }]}>
          <Pressable accessibilityRole="link" accessibilityLabel="Savannah Cinemas, home" onPress={() => router.navigate('/')} style={styles.brand}>
            <LogoMark size={36} />
            <Text style={styles.brandText}>Savannah Cinemas</Text>
          </Pressable>
          <TabTrigger name="index" href="/" asChild>
            <NavLink label="Tonight" />
          </TabTrigger>
          <TabTrigger name="films" href="/films" asChild>
            <NavLink label="Films" />
          </TabTrigger>
          <TabTrigger name="events" href="/events" asChild>
            <NavLink label="Events" />
          </TabTrigger>
          <TabTrigger name="account" href="/account" asChild>
            <NavLink label={user ? 'Account' : 'Sign in'} />
          </TabTrigger>
        </TabList>
        <TabSlot style={{ flex: 1 }} />
      </Tabs>
    );
  }

  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TabTrigger name="index" href="/" asChild>
          <WordTab label="Tonight" />
        </TabTrigger>
        <TabTrigger name="films" href="/films" asChild>
          <WordTab label="Films" />
        </TabTrigger>
        <TabTrigger name="events" href="/events" asChild>
          <WordTab label="Events" />
        </TabTrigger>
        <TabTrigger name="account" href="/account" asChild>
          <WordTab label="Account" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 34,
    backgroundColor: colors.night,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.bone,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 'auto' },
  brandText: { fontFamily: fonts.displayBlack, fontSize: 26, color: colors.bone, textTransform: 'uppercase', letterSpacing: 0.5 },
  navLink: { height: 68, justifyContent: 'center', gap: 6, paddingTop: 9 },
  navText: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', letterSpacing: 0.5 },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.night,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
    paddingHorizontal: space.gutter,
    paddingTop: 4,
  },
  tab: { height: 50, justifyContent: 'center', alignItems: 'flex-start', gap: 4 },
  tabText: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', letterSpacing: 0.4 },
  mark: { height: 3, alignSelf: 'stretch' },
});
