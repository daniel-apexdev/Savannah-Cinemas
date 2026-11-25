import { router, useSegments, type Href } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { LogoMark } from '@/components/logo';
import { useAuth } from '@/lib/auth';
import { SITE_MAX, useScreen } from '@/lib/layout';
import { colors, fonts } from '@/theme';

/**
 * The website's top bar on pages outside the four main tabs (a film,
 * seats, checkout, tickets, settings...). The tabs draw their own copy
 * with live tab state; this one just links. Tablet and up only.
 */
export function SiteHeader() {
  const { wide, width, gutter } = useScreen();
  const { user } = useAuth();
  const segments = useSegments();
  if (Platform.OS !== 'web' || !wide) return null;
  // The tabs have their own header; the first-visit welcome has none
  if (segments[0] === '(tabs)' || segments[0] === 'welcome' || !segments.length) return null;

  const links: [string, Href][] = [
    ['Tonight', '/'],
    ['Films', '/films'],
    ['Events', '/events'],
    [user ? 'Account' : 'Sign in', user ? '/account' : { pathname: '/sign-in', params: { mode: 'in' } }],
  ];

  return (
    <View style={[styles.header, { paddingHorizontal: Math.max(gutter, (width - SITE_MAX) / 2 + gutter) }]} accessibilityRole="header">
      <Pressable accessibilityRole="link" accessibilityLabel="Savannah Cinemas, home" onPress={() => router.navigate('/')} style={styles.brand}>
        <LogoMark size={36} />
        <Text style={styles.brandText}>Savannah Cinemas</Text>
      </Pressable>
      {links.map(([label, href]) => (
        <Pressable
          key={label}
          accessibilityRole="link"
          onPress={() => router.navigate(href)}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.link, (pressed || hovered) && { opacity: 0.75 }]}>
          <Text style={styles.linkText}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 34,
    backgroundColor: colors.night,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.bone,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 'auto' },
  brandText: { fontFamily: fonts.displayBlack, fontSize: 26, color: colors.bone, textTransform: 'uppercase', letterSpacing: 0.5 },
  link: { height: 68, justifyContent: 'center' },
  linkText: { fontFamily: fonts.display, fontSize: 20, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.bone },
});
