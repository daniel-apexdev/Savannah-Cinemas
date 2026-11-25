import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sized } from '@/components/artwork';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/controls';
import { goBack, StackHeader } from '@/components/header';
import { ProfileBanner } from '@/components/profile-banner';
import { Shimmer } from '@/components/states';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AVATARS } from '@/lib/avatars';
import { success, tick } from '@/lib/feel';
import { useRequest } from '@/lib/use-request';
import { colors, fonts, radius, space } from '@/theme';
import { SiteFooter } from '@/components/site-footer';

const MAX_W = 560;
const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;

type Check = { name: string; state: 'checking' | 'ok' | 'bad'; reason?: string | null };

/**
 * Username, avatar and profile backdrop. Shown straight after sign-up
 * (?fresh=1, with "Skip for now") and from Edit profile.
 */
export default function ProfileSetup() {
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const isFresh = fresh === '1';
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const { user, updateUser } = useAuth();

  const [username, setUsername] = useState(user?.username ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [backdrop, setBackdrop] = useState<{ movieId: number | null; url: string } | null>(
    user?.backdrop ? { movieId: user.backdrop.movieId ?? null, url: user.backdrop.url } : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useRequest(() => api.suggestUsernames(user?.forenames), [user?.forenames]);
  // Stills from the whole catalogue, searchable by film title
  const [stillQuery, setStillQuery] = useState('');
  const [stillSearch, setStillSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setStillSearch(stillQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [stillQuery]);
  const stills = useRequest(() => api.backdrops(stillSearch), [stillSearch]);

  // Live availability, a moment after typing stops
  const trimmed = username.trim();
  const unchanged = trimmed.toLowerCase() === (user?.username ?? '').toLowerCase();
  const [check, setCheck] = useState<Check | null>(null);
  useEffect(() => {
    if (!trimmed || unchanged) return;
    let alive = true;
    const t = setTimeout(() => {
      if (!alive) return;
      setCheck({ name: trimmed, state: 'checking' });
      api
        .checkUsername(trimmed)
        .then((r) => alive && setCheck({ name: trimmed, state: r.available ? 'ok' : 'bad', reason: r.reason }))
        .catch(() => alive && setCheck(null));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [trimmed, unchanged]);

  const formatProblem = !trimmed
    ? 'Pick a username.'
    : !USERNAME_RE.test(trimmed)
      ? 'Use 3 to 20 letters, numbers, dots or underscores.'
      : !/[A-Za-z]/.test(trimmed)
        ? 'Include at least one letter.'
        : null;
  const current = check?.name === trimmed ? check : null;
  const status: { text: string; tone: 'ok' | 'bad' | 'quiet' } = unchanged
    ? { text: isFresh ? 'We made this one up for you. Keep it or change it.' : 'Your current username.', tone: 'quiet' }
    : formatProblem
      ? { text: formatProblem, tone: 'bad' }
      : !current || current.state === 'checking'
        ? { text: 'Checking…', tone: 'quiet' }
        : current.state === 'ok'
          ? { text: `@${trimmed} is available`, tone: 'ok' }
          : { text: current.reason ?? 'That username is taken.', tone: 'bad' };
  const usernameOk = unchanged || (!formatProblem && current?.state === 'ok');

  const roll = () => {
    tick();
    const list = (suggestions.data ?? []).filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
    if (list.length) setUsername(list[Math.floor(Math.random() * list.length)]);
    suggestions.reload();
  };

  const finish = () => {
    if (isFresh) router.replace('/');
    else goBack('/account');
  };

  const save = async () => {
    if (!user || !usernameOk) return;
    setSaving(true);
    setError(null);
    try {
      const patch: Parameters<typeof api.updateLook>[0] = {};
      if (!unchanged) patch.username = trimmed;
      if (avatar !== (user.avatar ?? null)) patch.avatar = avatar;
      if ((backdrop?.movieId ?? null) !== (user.backdrop?.movieId ?? null) || (!!backdrop !== !!user.backdrop)) patch.backdropMovieId = backdrop?.movieId ?? null;
      if (Object.keys(patch).length) {
        const look = await api.updateLook(patch);
        updateUser(look);
      }
      success();
      finish();
    } catch (e: any) {
      setError(e?.message ?? 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.night }}>
        <StackHeader title="Profile" />
      </View>
    );
  }

  const cols = width >= 480 ? 6 : 4;
  const cell = Math.floor((width - space.gutter * 2 - 12 * (cols - 1)) / cols);
  const stillW = Math.floor((width - space.gutter * 2 - 12) / 2);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.night }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {isFresh ? (
        <View style={[styles.freshHead, { paddingTop: insets.top + 10 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Label color={colors.laterite}>ACCOUNT CREATED</Label>
            <Display size={30} black>
              Make it yours
            </Display>
          </View>
          <Pressable accessibilityRole="button" onPress={finish} hitSlop={10} style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}>
            <Mono size={12} color={colors.dust}>
              SKIP FOR NOW
            </Mono>
          </Pressable>
        </View>
      ) : (
        <StackHeader title="Profile look" subtitle="USERNAME · AVATAR · BACKDROP" fallback="/account" />
      )}

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ width, alignSelf: 'center', paddingBottom: 130 }}>
        {/* Live preview */}
        <ProfileBanner url={backdrop?.url} width={width} height={150}>
          <View style={styles.previewRow}>
            <Avatar user={user} avatarKey={avatar} size={76} ring={colors.night} />
            <View style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
              <Display size={26} black numberOfLines={1}>
                {`${user.forenames} ${user.surname}`}
              </Display>
              <Mono size={13} color={colors.lateriteSoft} numberOfLines={1}>
                @{trimmed || 'username'}
              </Mono>
            </View>
          </View>
        </ProfileBanner>

        {/* Username */}
        <Section title="Username" />
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          <View style={[styles.input, status.tone === 'bad' && !unchanged && { borderColor: colors.laterite }]}>
            <Mono size={16} color={colors.dust}>
              @
            </Mono>
            <TextInput
              value={username}
              onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              placeholder="username"
              placeholderTextColor={colors.disabled}
              selectionColor={colors.laterite}
              accessibilityLabel="Username"
              style={styles.inputText}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Generate a username" onPress={roll} hitSlop={6} style={({ pressed }) => [styles.dice, pressed && { opacity: 0.7 }]}>
              <DiceIcon />
            </Pressable>
          </View>
          <Body size={13} color={status.tone === 'ok' ? '#7FC08A' : status.tone === 'bad' ? colors.lateriteSoft : colors.dust} accessibilityLiveRegion="polite">
            {status.tone === 'ok' ? '✓ ' : ''}
            {status.text}
          </Body>
          {(suggestions.data ?? []).length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(suggestions.data ?? []).map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${s}`}
                  onPress={() => {
                    tick();
                    setUsername(s);
                  }}
                  style={({ pressed }) => [styles.chip, s === trimmed && { borderColor: colors.bone }, pressed && { opacity: 0.8 }]}>
                  <Mono size={12} color={s === trimmed ? colors.bone : colors.dust} bold={false}>
                    @{s}
                  </Mono>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Avatar */}
        <Section title="Avatar" />
        <View style={{ paddingHorizontal: space.gutter, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} accessibilityRole="radiogroup">
          {AVATARS.map((a) => {
            const on = a.key === avatar;
            return (
              <Pressable
                key={a.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={a.label}
                onPress={() => {
                  tick();
                  setAvatar(on ? null : a.key);
                }}
                style={({ pressed }) => [styles.avatarCell, { width: cell, height: cell, borderRadius: cell / 2 }, on && styles.avatarOn, pressed && { opacity: 0.85 }]}>
                <Avatar avatarKey={a.key} size={cell - 8} />
              </Pressable>
            );
          })}
        </View>

        {/* Backdrop */}
        <Section title="Backdrop" note="A still from any film in our catalogue" />
        <View style={[styles.input, { marginHorizontal: space.gutter, marginBottom: 12 }]}>
          <TextInput
            value={stillQuery}
            onChangeText={setStillQuery}
            placeholder="Search films"
            placeholderTextColor={colors.disabled}
            selectionColor={colors.laterite}
            autoCorrect={false}
            accessibilityLabel="Search film stills"
            style={[styles.inputText, { fontFamily: fonts.body }]}
          />
        </View>
        <View style={{ paddingHorizontal: space.gutter, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} accessibilityRole="radiogroup">
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: !backdrop }}
            accessibilityLabel="No backdrop"
            onPress={() => setBackdrop(null)}
            style={[styles.still, { width: stillW, height: Math.round(stillW * 0.5625) }, styles.noStill, !backdrop && styles.stillOn]}>
            <Mono size={12} color={colors.dust}>
              NONE
            </Mono>
          </Pressable>
          {stills.loading
            ? [0, 1, 2].map((i) => <Shimmer key={i} style={{ width: stillW, height: Math.round(stillW * 0.5625) }} />)
            : (stills.data ?? []).map((b) => {
                const on = backdrop?.movieId === b.movieId;
                return (
                  <Pressable
                    key={b.movieId}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${b.title} backdrop`}
                    onPress={() => {
                      tick();
                      setBackdrop({ movieId: b.movieId, url: b.url });
                    }}
                    style={({ pressed }) => [{ width: stillW, gap: 6 }, pressed && { opacity: 0.85 }]}>
                    <View style={[styles.still, { width: stillW, height: Math.round(stillW * 0.5625) }, on && styles.stillOn]}>
                      <Image source={{ uri: sized(b.url, 'w300') ?? b.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
                    </View>
                    <Body size={12.5} color={on ? colors.bone : colors.dust} numberOfLines={1}>
                      {b.title}
                    </Body>
                  </Pressable>
                );
              })}
        </View>
        {!stills.loading && (stills.data ?? []).length === 0 ? (
          <Body size={13} color={colors.dust} style={{ paddingHorizontal: space.gutter, marginTop: 10 }}>
            {stillSearch ? `No film stills match “${stillSearch}”.` : 'Film stills appear here once films have artwork.'}
          </Body>
        ) : null}
        <SiteFooter />
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
        {error ? (
          <Body size={13} color={colors.lateriteSoft} style={{ marginBottom: 8 }}>
            {error}
          </Body>
        ) : null}
        <Button label={isFresh ? 'Save and start' : 'Save'} busy={saving} disabled={!usernameOk} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.section}>
      <Display size={22}>{title}</Display>
      {note ? <Label>{note.toUpperCase()}</Label> : null}
    </View>
  );
}

function DiceIcon() {
  return (
    <View style={styles.die}>
      {[
        [5, 5],
        [13, 5],
        [9, 9],
        [5, 13],
        [13, 13],
      ].map(([l, t]) => (
        <View key={`${l}-${t}`} style={[styles.pip, { left: l - 1.5, top: t - 1.5 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  freshHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: space.gutter,
    paddingBottom: space.md,
  },
  skip: { height: 36, justifyContent: 'center' },
  previewRow: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  section: {
    marginHorizontal: space.gutter,
    marginTop: 22,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 52,
    paddingLeft: 14,
    borderWidth: 1.5,
    borderColor: colors.rule,
    borderRadius: radius.action,
    backgroundColor: colors.booth,
  },
  inputText: { flex: 1, height: '100%', color: colors.bone, fontFamily: fonts.monoBold, fontSize: 16 },
  dice: { width: 48, height: '100%', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1.5, borderLeftColor: colors.rule },
  die: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.8, borderColor: colors.bone },
  pip: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.bone, marginLeft: -1.8, marginTop: -1.8 },
  chip: { height: 34, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1.5, borderColor: colors.rule, borderRadius: 17 },
  avatarCell: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: 'transparent' },
  avatarOn: { borderColor: colors.laterite },
  still: { borderRadius: 3, overflow: 'hidden', backgroundColor: colors.booth, borderWidth: 2, borderColor: 'transparent' },
  stillOn: { borderColor: colors.laterite },
  noStill: { alignItems: 'center', justifyContent: 'center', borderColor: colors.rule, borderStyle: 'dashed' },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.gutter,
    paddingTop: 12,
    backgroundColor: colors.night,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
});
