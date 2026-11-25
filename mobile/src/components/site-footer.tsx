import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/logo';
import { Body, Display, Label, Mono } from '@/components/type';
import { useAuth } from '@/lib/auth';
import { locationName, useLocation } from '@/lib/location';
import { useScreen } from '@/lib/layout';
import { colors } from '@/theme';

/**
 * The website's footer (not in the phone app). Drop it at the end of a
 * page's scroll content: it stretches to the full width of the page,
 * whatever column it sits in.
 */
export function SiteFooter() {
  if (Platform.OS !== 'web') return null;
  return <Footer />;
}

function Footer() {
  const { wide, desktop, gutter } = useScreen();
  const { user } = useAuth();
  const { cinemas } = useLocation();
  const [bleedRef, bleedStyle] = useFullBleed();

  const go = (href: Href) => () => router.navigate(href);

  const explore: [string, Href][] = [
    ['Tonight', '/'],
    ['Films', '/films'],
    ['Events & offers', '/events'],
    ['Watchlist', '/watchlist'],
  ];
  const visit: [string, Href][] = [
    [user ? 'Your tickets' : 'Find your tickets', '/account'],
    [user ? 'Account' : 'Sign in or create an account', user ? '/account' : { pathname: '/sign-in', params: { mode: 'in' } }],
    ['Help & questions', '/settings/help'],
  ];

  const col = { width: desktop ? undefined : wide ? '46%' : '100%', flex: desktop ? 1 : undefined } as const;

  return (
    <View ref={bleedRef} style={[styles.footer, bleedStyle]} accessibilityRole="contentinfo">
      <View style={[styles.inner, { paddingHorizontal: gutter }]}>
        {/* Marquee: the brand, big */}
        <View style={[styles.brandRow, !wide && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <LogoMark size={wide ? 56 : 44} />
            <View>
              <Display size={wide ? 40 : 30} black>
                Savannah Cinemas
              </Display>
              <Mono size={11} color={colors.dust}>
                {cinemas.length ? cinemas.map(locationName).join(' · ').toUpperCase() : 'ACCRA, GHANA'}
              </Mono>
            </View>
          </View>
          <Body size={14} color={colors.dust} style={{ maxWidth: 380 }}>
            Big screens, good seats and popcorn waiting at the counter. Book online in a minute, no account needed.
          </Body>
        </View>

        <View style={[styles.cols, { gap: desktop ? 40 : 28 }]}>
          <View style={[col, { gap: 14 }]}>
            <Label color={colors.laterite}>OUR CINEMAS</Label>
            {cinemas.length ? (
              cinemas.map((c) => (
                <View key={c.cinemaId} style={{ gap: 3 }}>
                  <Body size={15} weight="semi" color={colors.bone}>
                    {locationName(c)}
                  </Body>
                  {c.address ? (
                    <Body size={13} color={colors.dust}>
                      {[c.address, c.city].filter(Boolean).join(', ')}
                    </Body>
                  ) : null}
                  {c.phoneNumber ? (
                    <Mono size={12} color={colors.dust} bold={false}>
                      {c.phoneNumber}
                    </Mono>
                  ) : null}
                </View>
              ))
            ) : (
              <Body size={13} color={colors.dust}>
                Accra Mall and West Hills Mall, Accra
              </Body>
            )}
          </View>

          <LinkColumn title="EXPLORE" links={explore} go={go} style={col} />
          <LinkColumn title="YOUR VISIT" links={visit} go={go} style={col} />

          <View style={[col, { gap: 10 }]}>
            <Label color={colors.laterite}>ON YOUR PHONE</Label>
            <Body size={14} color={colors.boneSoft}>
              The Savannah Cinemas app keeps your tickets, points and reminders in your pocket. Sign in with the same account you use here.
            </Body>
            <Mono size={11} color={colors.dust}>
              IPHONE · ANDROID
            </Mono>
          </View>
        </View>

        <View style={[styles.base, !wide && { flexDirection: 'column', alignItems: 'flex-start', gap: 6 }]}>
          <Mono size={11} color={colors.dust} bold={false}>
            © {new Date().getFullYear()} SAVANNAH CINEMAS · ACCRA, GHANA
          </Mono>
          <Mono size={11} color={colors.dust} bold={false}>
            PRICES IN GHS · TICKETS SENT BY EMAIL
          </Mono>
        </View>
      </View>
    </View>
  );
}

function LinkColumn({ title, links, go, style }: { title: string; links: [string, Href][]; go: (h: Href) => () => void; style: object }) {
  return (
    <View style={[style, { gap: 4 }]}>
      <Label color={colors.laterite} style={{ marginBottom: 6 }}>
        {title}
      </Label>
      {links.map(([label, href]) => (
        <Pressable
          key={label}
          accessibilityRole="link"
          onPress={go(href)}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.link, (pressed || hovered) && { opacity: 0.7 }]}>
          {(state) => {
            const hovered = (state as { hovered?: boolean }).hovered;
            return (
              <Body size={15} color={hovered ? colors.bone : colors.boneSoft} style={hovered ? { textDecorationLine: 'underline' } : null}>
                {label}
              </Body>
            );
          }}
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Pages centre their content in a column; the footer should still run
 * edge to edge. Measure the column against the scrolling page and pull
 * the footer out to its edges (web only).
 */
function useFullBleed() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const measure = () => {
      const el = ref.current as unknown as HTMLElement | null;
      if (!el || typeof el.getBoundingClientRect !== 'function') return;
      // The nearest scrolling ancestor is the page
      let scroller: HTMLElement | null = el.parentElement;
      while (scroller) {
        const s = getComputedStyle(scroller);
        if (/(auto|scroll)/.test(s.overflowY) && scroller.clientHeight > 0) break;
        scroller = scroller.parentElement;
      }
      const page = scroller ?? document.documentElement;
      const parent = el.parentElement;
      if (!parent) return;
      const pr = parent.getBoundingClientRect();
      const ps = getComputedStyle(parent);
      const columnLeft = pr.left + parseFloat(ps.paddingLeft || '0');
      const pageLeft = page.getBoundingClientRect().left;
      const next = { left: Math.round(pageLeft - columnLeft), width: page.clientWidth };
      setBox((b) => (b && b.left === next.left && b.width === next.width ? b : next));
    };
    measure();
    const t = setTimeout(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const style = box ? { width: box.width, marginLeft: box.left, alignSelf: 'flex-start' as const } : null;
  return [ref, style] as const;
}

const styles = StyleSheet.create({
  footer: { backgroundColor: colors.booth, borderTopWidth: 1.5, borderTopColor: colors.bone, marginTop: 48 },
  inner: { width: '100%', maxWidth: 1240, alignSelf: 'center', paddingTop: 44, paddingBottom: 28, gap: 36 },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18 },
  cols: { flexDirection: 'row', flexWrap: 'wrap' },
  link: { minHeight: 32, justifyContent: 'center' },
  base: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    paddingTop: 18,
  },
});
