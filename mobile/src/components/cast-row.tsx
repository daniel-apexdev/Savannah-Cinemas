import { Image } from 'expo-image';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useWide } from '@/lib/layout';

import type { CastMember } from '@/lib/types';
import { colors, space } from '@/theme';

import { BackIcon, NextIcon } from './icons';
import { Body, Display, Mono } from './type';

const SIZE = 76;

/** TMDB gives w500 portraits; w185 is plenty for a 76 pt circle. */
function small(url?: string | null) {
  return url ? url.replace('/w500/', '/w185/').replace('/original/', '/w185/') : null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Face({ person }: { person: CastMember }) {
  const [failed, setFailed] = useState(false);
  const url = small(person.profileUrl);
  return (
    <View style={styles.face}>
      {url && !failed ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Mono size={20} color={colors.dust}>
          {initials(person.name)}
        </Mono>
      )}
    </View>
  );
}

/** Horizontal strip of cast portraits with names and roles. */
export function CastRow({ cast, director, gutter = space.gutter }: { cast: CastMember[]; director?: string | null; gutter?: number }) {
  // Website (tablet and up): arrows to page through the cast
  const wide = useWide();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [pos, setPos] = useState({ x: 0, view: 0, content: 0 });
  const canBack = pos.x > 4;
  const canNext = pos.x + pos.view < pos.content - 4;
  const page = (dir: 1 | -1) => scroller.current?.scrollTo({ x: Math.max(0, pos.x + dir * Math.max(200, pos.view * 0.8)), animated: true });

  if (!cast.length && !director) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <View style={[styles.head, { marginHorizontal: gutter }]}>
        <Display size={24}>Cast</Display>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 }}>
          {director ? (
            <Body size={13} color={colors.dust} numberOfLines={1} style={{ flexShrink: 1 }}>
              Directed by{' '}
              <Body size={13} weight="bold" color={colors.bone}>
                {director}
              </Body>
            </Body>
          ) : null}
          {wide && cast.length && (canBack || canNext) ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Arrow label="Earlier cast" disabled={!canBack} onPress={() => page(-1)}>
                <BackIcon size={18} color={canBack ? colors.bone : colors.disabled} />
              </Arrow>
              <Arrow label="More cast" disabled={!canNext} onPress={() => page(1)}>
                <NextIcon size={18} color={canNext ? colors.bone : colors.disabled} />
              </Arrow>
            </View>
          ) : null}
        </View>
      </View>
      {cast.length ? (
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            setPos((p) => (Math.abs(p.x - x) < 2 ? p : { ...p, x }));
          }}
          onLayout={(e) => {
            const view = e.nativeEvent.layout.width;
            setPos((p) => (p.view === view ? p : { ...p, view }));
          }}
          onContentSizeChange={(content) => setPos((p) => (p.content === content ? p : { ...p, content }))}
          contentContainerStyle={{
            paddingHorizontal: gutter,
            gap: 14,
            paddingTop: 12,
          }}>
          {cast.slice(0, 15).map((p) => (
            <View
              key={`${p.personId}-${p.characterName ?? ''}`}
              style={styles.person}
              accessible
              accessibilityLabel={p.characterName ? `${p.name} as ${p.characterName}` : p.name}>
              <Face person={p} />
              <Body size={12.5} weight="bold" numberOfLines={2} style={styles.center}>
                {p.name}
              </Body>
              {p.characterName ? (
                <Body size={11.5} color={colors.dust} numberOfLines={2} style={styles.center}>
                  {p.characterName}
                </Body>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Arrow({ label, disabled, onPress, children }: { label: string; disabled: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.arrow,
        hovered && !disabled && { borderColor: colors.bone },
        pressed && { opacity: 0.7 },
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  arrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.rule, borderRadius: 3 },
  head: {
    marginHorizontal: space.gutter,
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  person: { width: SIZE + 8, alignItems: 'center', gap: 6 },
  face: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
