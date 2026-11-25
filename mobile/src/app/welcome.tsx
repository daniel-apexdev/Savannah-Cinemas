import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/controls';
import { APP_SLIDES } from '@/components/welcome-slides';
import { Body, Display, Label, Mono } from '@/components/type';
import { tick } from '@/lib/feel';
import { markWelcomed } from '@/lib/welcome';
import { colors, space } from '@/theme';
import { GUESTS_ALLOWED } from '@/lib/guest';

const MAX_W = 560;

const SLIDES = APP_SLIDES;

/**
 * First-open welcome: what the app does, then create an account or sign
 * in. Shown once per device to signed-out users. On the website they
 * can also look around first; the phone app needs an account.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const last = index === SLIDES.length - 1;
  const artH = Math.max(170, Math.min(260, winH * 0.3));

  const go = (i: number) => {
    const next = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIndex(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };

  const leave = (then?: 'up' | 'in') => {
    markWelcomed();
    if (!GUESTS_ALLOWED) {
      // Phone app: straight to the account screen, no browsing first
      router.replace({ pathname: '/sign-in', params: { mode: then ?? 'in' } });
      return;
    }
    router.replace('/');
    if (then) setTimeout(() => router.push({ pathname: '/sign-in', params: { mode: then } }), 0);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <View style={[styles.top, { paddingTop: insets.top + 8, width, alignSelf: 'center' }]}>
        <Mono size={11.5} color={colors.dust}>
          {`${index + 1} / ${SLIDES.length}`}
        </Mono>
        {GUESTS_ALLOWED ? (
          <Pressable accessibilityRole="button" onPress={() => leave()} hitSlop={10} style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}>
            <Mono size={12} color={colors.bone}>
              LOOK AROUND FIRST
            </Mono>
          </Pressable>
        ) : !last ? (
          // Phone app: skip the tour, not the account
          <Pressable
            accessibilityRole="button"
            onPress={() => go(SLIDES.length - 1)}
            hitSlop={10}
            style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}>
            <Mono size={12} color={colors.bone}>
              SKIP
            </Mono>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width, alignSelf: 'center', flexGrow: 1 }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        onScroll={(e) => {
          // Web has no momentum end event: follow the scroll position
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== index) setIndex(i);
        }}
        scrollEventThrottle={64}>
        {SLIDES.map((s) => (
          <View
            key={s.key}
            style={{ width, paddingHorizontal: space.gutter + 4, justifyContent: 'center' }}
            accessible
            accessibilityLabel={`${s.title}. ${s.body}`}>
            <View style={{ height: artH, alignItems: 'center', justifyContent: 'center' }}>{s.art(width)}</View>
            <View style={{ gap: 10, marginTop: 18 }}>
              <Label color={colors.laterite}>{s.kicker}</Label>
              <Display size={38} black>
                {s.title}
              </Display>
              <Body size={16} color={colors.boneSoft}>
                {s.body}
              </Body>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 6, width, alignSelf: 'center' }]}>
        <View style={styles.dots} accessibilityRole="tablist">
          {SLIDES.map((s, i) => (
            <Pressable
              key={s.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={`Slide ${i + 1}: ${s.title}`}
              hitSlop={8}
              onPress={() => {
                tick();
                go(i);
              }}>
              <View style={[styles.dot, i === index && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        {last ? (
          <>
            <Button label="Create account" onPress={() => leave('up')} />
            <Button label="I have an account · Sign in" variant="outline" onPress={() => leave('in')} />
          </>
        ) : (
          <>
            <Button
              label="Next"
              onPress={() => {
                tick();
                go(index + 1);
              }}
            />
            <Button label="Sign in" variant="outline" onPress={() => leave('in')} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 6 },
  skip: { height: 36, justifyContent: 'center' },
  bottom: { paddingHorizontal: space.gutter, gap: 10, paddingTop: 10 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rule },
  dotOn: { width: 24, backgroundColor: colors.laterite },
});
