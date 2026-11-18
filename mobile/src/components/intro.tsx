import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useReducedMotion } from '@/lib/feel';
import { colors, fonts } from '@/theme';

import { SUN_SVG, TREE_SVG } from './logo';

/**
 * Opening title card, played once per launch over the first screen.
 *   0–700 ms    the sun rises over the horizon
 *   350–900 ms  the acacia and horizon appear in front of it
 *   650–1100 ms SAVANNAH and CINEMAS settle in under the mark
 *   1700 ms     the card lifts away
 * Tap anywhere to skip. With "reduce motion" it's a short still card.
 * The native splash shows the same mark, so the hand-off is seamless.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [sun] = useState(() => new Animated.Value(0));
  const [tree] = useState(() => new Animated.Value(0));
  const [word] = useState(() => new Animated.Value(0));
  const [out] = useState(() => new Animated.Value(0));

  const mark = Math.min(170, Math.round(width * 0.42));
  const wordSize = Math.round(mark * 0.36);

  useEffect(() => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      onDone();
    };

    if (reduced) {
      sun.setValue(1);
      tree.setValue(1);
      word.setValue(1);
      const t = setTimeout(() => {
        Animated.timing(out, { toValue: 1, duration: 180, useNativeDriver: true }).start(finish);
      }, 800);
      return () => clearTimeout(t);
    }

    const ease = Easing.out(Easing.cubic);
    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(sun, { toValue: 1, duration: 700, easing: ease, useNativeDriver: true }),
        Animated.timing(tree, { toValue: 1, duration: 500, delay: 350, easing: ease, useNativeDriver: true }),
        Animated.timing(word, { toValue: 1, duration: 450, delay: 650, easing: ease, useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.timing(out, { toValue: 1, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    seq.start(finish);
    return () => seq.stop();
  }, [reduced, sun, tree, word, out, onDone]);

  const skip = () => {
    Animated.timing(out, { toValue: 1, duration: 160, useNativeDriver: true }).start(() => onDone());
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.card,
        {
          opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ translateY: out.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
        },
      ]}>
      <Pressable style={styles.fill} onPress={skip} accessibilityRole="button" accessibilityLabel="Savannah Cinemas. Tap to skip">
        <View style={{ width: mark, height: mark }}>
          {/* The sun rises from behind the horizon line */}
          <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', height: mark * 0.86 }]}>
            <Animated.View
              style={{
                opacity: sun,
                transform: [{ translateY: sun.interpolate({ inputRange: [0, 1], outputRange: [mark * 0.5, 0] }) }],
              }}>
              <SvgXml xml={SUN_SVG} width={mark} height={mark} />
            </Animated.View>
          </View>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: tree, transform: [{ scale: tree.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
            ]}>
            <SvgXml xml={TREE_SVG} width={mark} height={mark} />
          </Animated.View>
        </View>

        <Animated.View
          style={{
            alignItems: 'center',
            marginTop: 6,
            opacity: word,
            transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}
          accessibilityElementsHidden>
          <Text style={[styles.word, { fontSize: wordSize, lineHeight: Math.ceil(wordSize * 1.2) }]} numberOfLines={1}>
            SAVANNAH
          </Text>
          <Text style={styles.sub}>CINEMAS</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.night, zIndex: 100 },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  word: { fontFamily: fonts.displayBlack, color: colors.bone, letterSpacing: 1.5 },
  sub: { fontFamily: fonts.monoBold, color: colors.dust, fontSize: 13, letterSpacing: 7, marginTop: 4, marginLeft: 7 },
});
