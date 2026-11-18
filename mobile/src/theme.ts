/**
 * Savannah Cinemas — "Harmattan Marquee" design tokens.
 *
 * One warm dark room, bone paper for anything you show at the door,
 * and a single earth-red light (laterite) reserved for the primary
 * action, your selection, and "now".
 */
import { Platform } from 'react-native';

export const colors = {
  night: '#12100D', // projection room: app ground
  booth: '#1D1A16', // raised surfaces
  rule: '#34302A', // hairlines, inactive borders
  bone: '#F1E8D6', // text on dark, ticket paper
  boneSoft: '#D6CCB8', // long-form reading on dark
  dust: '#A89F8E', // secondary text on dark (7:1 on night)
  ink: '#12100D', // text on bone
  inkSoft: '#4A443B', // secondary text on bone
  laterite: '#E0562B', // the one light
  lateriteSoft: '#F07A52', // laterite as text on dark at small sizes
  vip: '#F2C14E', // VIP seat marker only
  taken: '#2A2620',
  takenStripe: '#3A352D',
  disabled: '#6F675B',
} as const;

export const fonts = {
  display: 'BigShoulders-ExtraBold',
  displayBlack: 'BigShoulders-Black',
  body: 'Hanken-Regular',
  bodyMedium: 'Hanken-Medium',
  bodySemi: 'Hanken-SemiBold',
  bodyBold: 'Hanken-Bold',
  mono: 'JetBrains-Medium',
  monoBold: 'JetBrains-Bold',
} as const;

export const fontAssets = {
  [fonts.display]: require('@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_800ExtraBold.ttf'),
  [fonts.displayBlack]: require('@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_900Black.ttf'),
  [fonts.body]: require('@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf'),
  [fonts.bodyMedium]: require('@expo-google-fonts/hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf'),
  [fonts.bodySemi]: require('@expo-google-fonts/hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf'),
  [fonts.bodyBold]: require('@expo-google-fonts/hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf'),
  [fonts.mono]: require('@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'),
  [fonts.monoBold]: require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  gutter: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  action: 3, // buttons, time tokens
  poster: 2,
  paper: 4, // tickets
} as const;

/** Minimum touch target on both platforms. */
export const touch = 44;

export const motion = {
  press: 120,
  band: 200,
  poster: 280,
  print: 420,
} as const;

export const isWeb = Platform.OS === 'web';
