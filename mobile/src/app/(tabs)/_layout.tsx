import { Redirect } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { useWelcomed } from '@/lib/welcome';
import { colors, fonts, space } from '@/theme';

/** Word-tabs. No icon row: the words are the marquee. */
const WordTab = forwardRef<ComponentRef<typeof View>, TabTriggerSlotProps & { label: string }>(function WordTab(
  { isFocused, label, ...props },
  ref,
) {
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

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const welcomed = useWelcomed();
  // First open on this device, signed out: show the welcome slides
  if (!user && welcomed === 'no') return <Redirect href="/welcome" />;
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
