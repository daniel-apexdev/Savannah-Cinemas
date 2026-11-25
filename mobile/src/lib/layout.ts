import { Platform, useWindowDimensions } from 'react-native';

/**
 * Website breakpoints. The phone app and narrow browser windows keep the
 * app layout; tablets, laptops and desktops get the site layout (top
 * navigation, wider pages, multi-column sections and a footer).
 */
export const WIDE_AT = 768; // tablet and up: site layout
export const DESKTOP_AT = 1100; // laptops and desktops: more columns, side panels
export const SITE_MAX = 1240; // widest content column

const isWeb = Platform.OS === 'web';

/** Tablet, laptop or desktop browser. */
export function useWide() {
  const { width } = useWindowDimensions();
  return isWeb && width >= WIDE_AT;
}

/**
 * Everything a page needs to lay itself out on the website.
 * `content`: width of the centred content column; `gutter`: its side padding.
 */
export function useScreen() {
  const { width, height } = useWindowDimensions();
  const wide = isWeb && width >= WIDE_AT;
  const desktop = isWeb && width >= DESKTOP_AT;
  const gutter = desktop ? 40 : wide ? 32 : 20;
  const content = Math.min(width, SITE_MAX);
  return { width, height, wide, desktop, gutter, content, inner: content - gutter * 2 };
}

/**
 * Page width: `narrow` on phones (the app's 560), `wide` on tablet and
 * desktop web, never wider than the window.
 */
export function usePageWidth(narrow = 560, wide = narrow) {
  const { width } = useWindowDimensions();
  const isWide = isWeb && width >= WIDE_AT;
  return Math.min(width, isWide ? wide : narrow);
}
