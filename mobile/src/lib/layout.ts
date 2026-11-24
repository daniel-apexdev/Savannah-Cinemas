import { Platform, useWindowDimensions } from 'react-native';

/** At this width and up (browsers on laptops and desktops) the site layout kicks in. */
export const WIDE_AT = 900;

/**
 * Desktop web: a top navigation bar and wider pages.
 * Phones and narrow windows keep the app layout.
 */
export function useWide() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_AT;
}

/**
 * Page width: `narrow` on phones (the app's 560), `wide` on desktop
 * web, never wider than the window.
 */
export function usePageWidth(narrow = 560, wide = narrow) {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= WIDE_AT;
  return Math.min(width, isWide ? wide : narrow);
}
