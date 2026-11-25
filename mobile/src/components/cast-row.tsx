import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { CastMember } from '@/lib/types';
import { colors, space } from '@/theme';

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
  if (!cast.length && !director) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <View style={[styles.head, { marginHorizontal: gutter }]}>
        <Display size={24}>Cast</Display>
        {director ? (
          <Body size={13} color={colors.dust} numberOfLines={1} style={{ flexShrink: 1 }}>
            Directed by{' '}
            <Body size={13} weight="bold" color={colors.bone}>
              {director}
            </Body>
          </Body>
        ) : null}
      </View>
      {cast.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
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

const styles = StyleSheet.create({
  head: {
    marginHorizontal: space.gutter,
    paddingTop: 14,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
    flexDirection: 'row',
    alignItems: 'baseline',
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
