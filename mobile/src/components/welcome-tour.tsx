import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, IconButton } from '@/components/controls';
import { CloseIcon } from '@/components/icons';
import { Body, Display, Label, Mono } from '@/components/type';
import { WEB_SLIDES } from '@/components/welcome-slides';
import { useScreen } from '@/lib/layout';
import { markWelcomed } from '@/lib/welcome';
import { colors, radius, space } from '@/theme';

/**
 * Website, first visit: a short tour that pops up over the home page
 * (the phone app has a full-screen welcome instead). Closing it, or
 * finishing it, means it won't show again on this browser.
 */
export function WelcomeTour({ visible }: { visible: boolean }) {
  const { width, wide } = useScreen();
  const [dismissed, setDismissed] = useState(false);
  const open = visible && !dismissed;
  const [index, setIndex] = useState(0);
  const slide = WEB_SLIDES[index];
  const last = index === WEB_SLIDES.length - 1;

  const close = (then?: 'up') => {
    markWelcomed();
    setDismissed(true);
    if (then) router.push({ pathname: '/sign-in', params: { mode: then } });
  };

  // Keyboard: arrows to move, Escape to close
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(WEB_SLIDES.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const cardW = Math.min(width - (wide ? 64 : 24), wide ? 880 : 520);
  const artW = wide ? Math.round(cardW * 0.44) : cardW;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close()}>
      <View style={styles.scrim}>
        {/* Clicking outside the card closes it */}
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close the tour" onPress={() => close()} />
        <View
          style={[styles.card, { width: cardW, flexDirection: wide ? 'row' : 'column' }]}
          accessibilityViewIsModal
          accessibilityRole="none"
          accessibilityLabel="Welcome to Savannah Cinemas">
          <View style={[styles.art, { width: wide ? artW : '100%', minHeight: wide ? 420 : 210 }]}>{slide.art(artW)}</View>

          <View style={[styles.text, { padding: wide ? 36 : space.gutter }]}>
            <View style={styles.top}>
              <Mono size={11.5} color={colors.dust}>
                {`${index + 1} / ${WEB_SLIDES.length}`}
              </Mono>
              <IconButton label="Close" onPress={() => close()} style={{ borderWidth: 1.5, borderColor: colors.rule }}>
                <CloseIcon />
              </IconButton>
            </View>

            <View style={{ gap: 10, flexGrow: 1, justifyContent: 'center', paddingVertical: wide ? 10 : 4 }} accessibilityLiveRegion="polite">
              <Label color={colors.laterite}>{slide.kicker}</Label>
              <Display size={wide ? 44 : 34} black>
                {slide.title}
              </Display>
              <Body size={16} color={colors.boneSoft}>
                {slide.body}
              </Body>
            </View>

            <View style={styles.dots} accessibilityRole="tablist">
              {WEB_SLIDES.map((s, i) => (
                <Pressable
                  key={s.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: i === index }}
                  accessibilityLabel={`Step ${i + 1}: ${s.title}`}
                  hitSlop={8}
                  onPress={() => setIndex(i)}>
                  <View style={[styles.dot, i === index && styles.dotOn]} />
                </Pressable>
              ))}
            </View>

            {last ? (
              <View style={[styles.actions, !wide && { flexDirection: 'column' }]}>
                <Button style={wide ? { flex: 1 } : undefined} label="Start browsing" onPress={() => close()} />
                <Button style={wide ? { flex: 1 } : undefined} variant="outline" label="Create a free account" onPress={() => close('up')} />
              </View>
            ) : (
              <View style={styles.actions}>
                {index > 0 ? <Button style={{ width: 120 }} variant="outline" label="Back" onPress={() => setIndex(index - 1)} /> : null}
                <Button style={{ flex: 1 }} label="Next" onPress={() => setIndex(index + 1)} />
              </View>
            )}
            {!last ? (
              <Pressable accessibilityRole="button" onPress={() => close()} style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}>
                <Mono size={12} color={colors.dust}>
                  SKIP THE TOUR
                </Mono>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,7,5,0.78)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { backgroundColor: colors.night, borderWidth: 1.5, borderColor: colors.bone, borderRadius: radius.paper, overflow: 'hidden', maxHeight: '94%' },
  art: { backgroundColor: colors.booth, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { flex: 1, gap: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.rule },
  dotOn: { width: 24, backgroundColor: colors.laterite },
  actions: { flexDirection: 'row', gap: 10 },
  skip: { alignSelf: 'center', height: 32, justifyContent: 'center' },
});
