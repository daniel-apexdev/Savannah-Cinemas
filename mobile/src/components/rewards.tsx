import { useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/controls';
import { api } from '@/lib/api';
import { TrophyMedal } from '@/components/trophy';
import { Body, Display, Label, Mono } from '@/components/type';
import { money, shortDate } from '@/lib/format';
import type { RewardsSummary, Trophy } from '@/lib/types';
import { useWide } from '@/lib/layout';
import { colors, radius, space } from '@/theme';

const GROUPS = ['Milestones', 'Genres', 'Collections', 'Habits', 'Social', 'Challenges', 'Hidden'];
const GROUP_NOTE: Record<string, string> = {
  Challenges: 'Seasonal: each one can only be won in its window.',
  Hidden: 'Secret until you earn them.',
};

/** Trophies · Points · Films · Streak, under the member's name. */
export function StatsStrip({ stats }: { stats: RewardsSummary['stats'] | null }) {
  const cells: [string, string][] = [
    ['TROPHIES', stats ? String(stats.trophies) : '–'],
    ['POINTS', stats ? stats.points.toLocaleString('en-GB') : '–'],
    ['FILMS', stats ? String(stats.movies) : '–'],
    ['STREAK', stats ? `${stats.streak} ${stats.streak === 1 ? 'WK' : 'WKS'}` : '–'],
  ];
  return (
    <View style={styles.stats} accessible accessibilityLabel={cells.map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ')}>
      {cells.map(([k, v]) => (
        <View key={k} style={{ flex: 1, gap: 2 }}>
          <Display size={26}>{v}</Display>
          <Label>{k}</Label>
        </View>
      ))}
    </View>
  );
}

/** Savannah Trophies: the medal cabinet. */
export function TrophiesBody({ data, width }: { data: RewardsSummary; width: number }) {
  const [open, setOpen] = useState<Trophy | null>(null);
  const earned = data.trophies.filter((t) => t.earned).length;
  const fresh = data.trophies.filter((t) => t.isNew);
  const cols = width >= 500 ? 4 : 3;
  const cell = Math.floor((width - space.gutter * 2 - (cols - 1) * 12) / cols);

  // Website (tablet and up): a trophy room rather than a phone list
  if (width >= 760) return <TrophyRoom data={data} width={width} open={open} setOpen={setOpen} />;

  return (
    <View style={{ paddingHorizontal: space.gutter, gap: 22 }}>
      <View style={{ gap: 4 }}>
        <Display size={30} black>
          Savannah Trophies
        </Display>
        <Label>WATCH. EXPLORE. COLLECT.</Label>
        <Body size={14} color={colors.dust} style={{ marginTop: 6 }}>
          {`${earned} of ${data.trophies.length} collected. Tap a medal to see how to win it.`}
        </Body>
      </View>

      {fresh.length ? (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Label color={colors.ink}>NEW</Label>
          <Body weight="semi" color={colors.ink}>
            {`You earned ${fresh.map((t) => t.name).join(', ')}.`}
          </Body>
        </View>
      ) : null}

      {GROUPS.map((g) => {
        const list = data.trophies.filter((t) => t.group === g);
        if (list.length === 0) return null;
        const got = list.filter((t) => t.earned).length;
        return (
          <View key={g} style={{ gap: 12 }}>
            <View style={styles.groupHead}>
              <Display size={22}>{g}</Display>
              <Label>{`${got}/${list.length}`}</Label>
            </View>
            {GROUP_NOTE[g] ? (
              <Body size={12.5} color={colors.dust} style={{ marginTop: -6 }}>
                {GROUP_NOTE[g]}
              </Body>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 16 }}>
              {list.map((t) => (
                <Pressable
                  key={t.code}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.name}, ${t.earned ? 'earned' : t.progress ? `${t.progress.current} of ${t.progress.target}` : 'locked'}`}
                  onPress={() => setOpen(t)}
                  style={({ pressed }) => [{ width: cell, alignItems: 'center', gap: 6 }, pressed && { opacity: 0.75 }]}>
                  <TrophyMedal trophy={t} size={Math.min(84, cell - 8)} />
                  <Body
                    size={12.5}
                    weight="semi"
                    color={t.earned ? colors.bone : colors.dust}
                    numberOfLines={2}
                    style={{ textAlign: 'center', lineHeight: 16 }}>
                    {t.name}
                  </Body>
                  {!t.earned && t.progress && t.progress.target > 1 ? (
                    <Mono size={10} color={colors.dust} bold={false}>
                      {`${t.progress.current}/${t.progress.target}`}
                    </Mono>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}

      <TrophySheet trophy={open} onClose={() => setOpen(null)} />
    </View>
  );
}

/** Tablet and desktop: progress, a shelf of the latest wins, then each group as a card. */
function TrophyRoom({ data, width, open, setOpen }: { data: RewardsSummary; width: number; open: Trophy | null; setOpen: (t: Trophy | null) => void }) {
  const inner = width - space.gutter * 2;
  const earned = data.trophies.filter((t) => t.earned);
  const total = data.trophies.length;
  const pct = total ? Math.round((earned.length / total) * 100) : 0;
  const fresh = data.trophies.filter((t) => t.isNew);
  const latest = [...earned].sort((a, b) => String(b.earnedAt ?? '').localeCompare(String(a.earnedAt ?? ''))).slice(0, 5);
  const twoUp = inner >= 960;
  const cardW = twoUp ? Math.floor((inner - 24) / 2) : inner;
  const cellTarget = 112;
  const cardInner = cardW - 40 - 4; // padding and border
  const cols = Math.max(3, Math.floor((cardInner + 12) / (cellTarget + 12)));
  const cell = Math.floor((cardInner - (cols - 1) * 12) / cols);
  const groups = GROUPS.map((g) => ({ g, list: data.trophies.filter((t) => t.group === g) })).filter((x) => x.list.length);

  return (
    <View style={{ paddingHorizontal: space.gutter, gap: 28 }}>
      {/* Progress */}
      <View style={styles.roomHead}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Display size={40} black>
            Savannah Trophies
          </Display>
          <Label>WATCH. EXPLORE. COLLECT.</Label>
          <Body size={14} color={colors.dust} style={{ marginTop: 6 }}>
            Click any medal to see how to win it.
          </Body>
        </View>
        <View style={{ width: Math.min(360, inner * 0.4), gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Display size={48} black>
              {String(earned.length)}
            </Display>
            <Mono size={14} color={colors.dust}>{`/ ${total} COLLECTED`}</Mono>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
        </View>
      </View>

      {fresh.length ? (
        <View style={styles.banner} accessibilityLiveRegion="polite">
          <Label color={colors.ink}>NEW</Label>
          <Body weight="semi" color={colors.ink}>
            {`You earned ${fresh.map((t) => t.name).join(', ')}.`}
          </Body>
        </View>
      ) : null}

      {/* The shelf: latest wins, big */}
      <View style={styles.shelf}>
        <Label color={colors.laterite}>LATEST WINS</Label>
        {latest.length ? (
          <View style={{ flexDirection: 'row', gap: 28, flexWrap: 'wrap' }}>
            {latest.map((t) => (
              <Pressable
                key={t.code}
                accessibilityRole="button"
                accessibilityLabel={`${t.name}, earned`}
                onPress={() => setOpen(t)}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  { width: 132, alignItems: 'center', gap: 8 },
                  hovered && { transform: [{ translateY: -3 }] },
                  pressed && { opacity: 0.8 },
                ]}>
                <TrophyMedal trophy={t} size={112} />
                <Body size={13.5} weight="semi" color={colors.bone} numberOfLines={2} style={{ textAlign: 'center' }}>
                  {t.name}
                </Body>
                {t.earnedAt ? (
                  <Mono size={10.5} color={colors.dust} bold={false}>
                    {shortDate(new Date(t.earnedAt))}
                  </Mono>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <Body color={colors.dust}>Your first trophy is one film away. Book a film to win First Screening.</Body>
        )}
      </View>

      {/* Every group as a card */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        {groups.map(({ g, list }) => {
          const got = list.filter((t) => t.earned).length;
          return (
            <View key={g} style={[styles.groupCard, { width: cardW }]}>
              <View style={[styles.groupHead, { marginTop: 0, borderTopWidth: 0, paddingTop: 0 }]}>
                <Display size={24}>{g}</Display>
                <Label>{`${got}/${list.length}`}</Label>
              </View>
              {GROUP_NOTE[g] ? (
                <Body size={12.5} color={colors.dust}>
                  {GROUP_NOTE[g]}
                </Body>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 18 }}>
                {list.map((t) => (
                  <Pressable
                    key={t.code}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name}, ${t.earned ? 'earned' : t.progress ? `${t.progress.current} of ${t.progress.target}` : 'locked'}`}
                    onPress={() => setOpen(t)}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      { width: cell, alignItems: 'center', gap: 6 },
                      hovered && { transform: [{ translateY: -2 }] },
                      pressed && { opacity: 0.75 },
                    ]}>
                    <TrophyMedal trophy={t} size={Math.min(88, cell - 12)} />
                    <Body
                      size={12.5}
                      weight="semi"
                      color={t.earned ? colors.bone : colors.dust}
                      numberOfLines={2}
                      style={{ textAlign: 'center', lineHeight: 16 }}>
                      {t.name}
                    </Body>
                    {!t.earned && t.progress && t.progress.target > 1 ? (
                      <View style={{ width: '70%', gap: 3 }}>
                        <View style={[styles.bar, { height: 4 }]}>
                          <View style={[styles.barFill, { height: 4, width: `${Math.round((t.progress.current / Math.max(1, t.progress.target)) * 100)}%` }]} />
                        </View>
                        <Mono size={10} color={colors.dust} bold={false} style={{ textAlign: 'center' }}>
                          {`${t.progress.current}/${t.progress.target}`}
                        </Mono>
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <TrophySheet trophy={open} onClose={() => setOpen(null)} />
    </View>
  );
}

function TrophySheet({ trophy: t, onClose }: { trophy: Trophy | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  // Website, tablet and up: a centred card instead of a bottom sheet
  const wide = useWide();
  return (
    <Modal visible={!!t} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.scrim, wide && { justifyContent: 'center', alignItems: 'center' }]}>
        <Pressable style={wide ? StyleSheet.absoluteFill : { flex: 1 }} accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} />
        {t ? (
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
              wide && { width: 460, borderWidth: 1.5, borderColor: colors.bone, borderRadius: radius.paper, padding: 28 },
            ]}
            accessibilityViewIsModal>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <TrophyMedal trophy={{ ...t, isNew: false }} size={120} />
              <Label>{t.group.toUpperCase()}</Label>
              <Display size={32} black style={{ textAlign: 'center' }}>
                {t.name}
              </Display>
              <Body style={{ textAlign: 'center' }}>{t.description}</Body>
              {t.window ? <Mono size={12} color={colors.vip}>{`RUNS ${t.window.toUpperCase()}`}</Mono> : null}
              {t.earned && t.earnedAt ? (
                <Mono size={12} color={colors.lateriteSoft}>{`EARNED ${shortDate(new Date(t.earnedAt))} ${new Date(t.earnedAt).getFullYear()}`}</Mono>
              ) : t.progress ? (
                <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 4 }}>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${Math.round((t.progress.current / Math.max(1, t.progress.target)) * 100)}%` }]} />
                  </View>
                  <Mono size={12} color={colors.dust} style={{ textAlign: 'center' }}>
                    {`${t.progress.current} OF ${t.progress.target}`}
                  </Mono>
                </View>
              ) : null}
            </View>
            <Button label="Close" variant="outline" onPress={onClose} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** Savannah Rewards: points, what they're worth, how to earn, invite a friend, activity. */
export function RewardsBody({ data, onChanged }: { data: RewardsSummary; onChanged?: () => void }) {
  const { width } = useWindowDimensions();
  const v = data.points.value;
  const worth = Math.floor(data.points.balance / v.pointsPerStep) * v.ghsPerStep;
  const toNext = v.pointsPerStep - (data.points.balance % v.pointsPerStep);
  const [shared, setShared] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [claim, setClaim] = useState<{ busy?: boolean; error?: string; ok?: string }>({});

  const useCode = async () => {
    if (!code.trim()) return;
    setClaim({ busy: true });
    try {
      const r = await api.claimReferral(code.trim());
      setClaim({ ok: `Linked to ${r.referrer}. Your ${r.bonus} bonus points are in.` });
      setCode('');
      onChanged?.();
    } catch (e: any) {
      setClaim({ error: e?.message ?? 'That code didn’t work.' });
    }
  };

  const invite = async () => {
    if (!data.referral.code) return;
    const message = `Join me at Savannah Cinemas! Sign up with my code ${data.referral.code} and get 100 bonus points.`;
    try {
      await Share.share({ message });
    } catch {
      setShared(`Your code is ${data.referral.code}. Share it with a friend.`);
    }
  };

  return (
    <View style={{ paddingHorizontal: space.gutter, gap: 22 }}>
      <View style={{ gap: 4 }}>
        <Display size={30} black>
          Savannah Rewards
        </Display>
        <Label>WATCH. EARN. ENJOY.</Label>
      </View>

      {/* Balance card */}
      <View style={styles.card}>
        <View style={{ padding: 18, gap: 4 }}>
          <Label color={colors.inkSoft}>YOUR POINTS</Label>
          <Display size={Math.min(64, width * 0.16)} black color={colors.ink}>
            {data.points.balance.toLocaleString('en-GB')}
          </Display>
          <Body size={14} color={colors.inkSoft}>
            {worth > 0
              ? `Worth ${money(worth)} off your next booking. Use them at checkout.`
              : `${toNext} more points and you can take ${money(v.ghsPerStep)} off a booking.`}
          </Body>
        </View>
        <View style={styles.perf} />
        <View style={{ padding: 14 }}>
          <Mono size={11} color={colors.inkSoft} bold={false}>
            {`${v.pointsPerStep} POINTS = ${money(v.ghsPerStep).toUpperCase()} · UP TO HALF A BOOKING`}
          </Mono>
        </View>
      </View>

      {/* Invite */}
      <View style={styles.invite}>
        <Label color={colors.lateriteSoft}>BRING A FRIEND</Label>
        <Body>
          They get{' '}
          <Body weight="bold" color={colors.bone}>
            100 points
          </Body>{' '}
          when they join with your code, and you get{' '}
          <Body weight="bold" color={colors.bone}>
            250
          </Body>{' '}
          when they make their first booking.
        </Body>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
          <View style={{ gap: 2 }}>
            <Mono size={10} color={colors.dust} bold={false}>
              YOUR CODE
            </Mono>
            <Mono size={22} selectable>
              {data.referral.code ?? '–'}
            </Mono>
          </View>
          <Button label="Invite" style={{ width: 120 }} height={46} onPress={invite} disabled={!data.referral.code} />
        </View>
        <Mono size={11} color={colors.dust} bold={false}>
          {`${data.referral.invited} JOINED · ${data.referral.booked} BOOKED${data.referral.referredBy ? ` · INVITED BY ${data.referral.referredBy.toUpperCase()}` : ''}`}
        </Mono>
        {shared ? (
          <Body size={13} color={colors.dust}>
            {shared}
          </Body>
        ) : null}
      </View>

      {data.referral.canClaim ? (
        <View style={{ gap: 10 }}>
          <Field
            label="Joined because of a friend? Their code"
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase());
              setClaim({});
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="e.g. EFUA7455"
            error={claim.error}
          />
          {claim.ok ? (
            <Body size={13} color={colors.bone}>
              {claim.ok}
            </Body>
          ) : null}
          <Button label="Use code" variant="outline" height={46} busy={claim.busy} disabled={!code.trim()} onPress={useCode} />
        </View>
      ) : claim.ok ? (
        <Body size={13} color={colors.bone}>
          {claim.ok}
        </Body>
      ) : null}

      {/* How to earn */}
      <View>
        <View style={styles.groupHead}>
          <Display size={22}>How to earn</Display>
        </View>
        {data.points.rules.map((r) => (
          <View key={r.label} style={styles.line}>
            <Body color={colors.bone} style={{ flex: 1 }}>
              {r.label}
            </Body>
            <Mono size={14} color={colors.lateriteSoft}>{`+${r.points}`}</Mono>
          </View>
        ))}
      </View>

      {/* Activity */}
      <View>
        <View style={styles.groupHead}>
          <Display size={22}>Activity</Display>
        </View>
        {data.points.entries.length === 0 ? (
          <Body color={colors.dust}>Nothing yet.</Body>
        ) : (
          data.points.entries.map((e, i) => (
            <View key={`${e.reason}-${e.bookingId ?? ''}-${i}`} style={styles.line}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Body color={colors.bone} numberOfLines={2}>
                  {e.description}
                </Body>
                {e.at ? (
                  <Mono size={10.5} color={colors.dust} bold={false}>
                    {`${shortDate(new Date(e.at))} ${new Date(e.at).getFullYear()}`}
                  </Mono>
                ) : null}
              </View>
              <Mono size={15} color={e.points < 0 ? colors.lateriteSoft : colors.bone}>
                {e.points > 0 ? `+${e.points}` : String(e.points)}
              </Mono>
            </View>
          ))
        )}
        <Body size={12.5} color={colors.dust} style={{ marginTop: 10 }}>
          Points come from paid bookings. Cancel a booking and its points go too, and any points you spent on it come back.
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: space.gutter,
    marginTop: 18,
  },
  banner: { backgroundColor: colors.vip, borderRadius: radius.action, padding: 14, gap: 4 },
  groupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1.5,
    borderTopColor: colors.bone,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(6,5,4,0.8)' },
  sheet: { backgroundColor: colors.booth, padding: space.gutter, gap: 18, borderTopWidth: 1.5, borderTopColor: colors.bone },
  bar: { height: 6, backgroundColor: colors.rule, borderRadius: 3, overflow: 'hidden' },
  // Website trophy room
  roomHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 },
  shelf: { backgroundColor: colors.booth, borderRadius: radius.paper, padding: 24, gap: 18, borderWidth: 1, borderColor: colors.rule },
  groupCard: { borderWidth: 1.5, borderColor: colors.rule, borderRadius: radius.paper, padding: 20, gap: 14 },
  barFill: { height: 6, backgroundColor: colors.laterite },
  card: { backgroundColor: colors.bone, borderRadius: radius.paper },
  perf: { marginHorizontal: 14, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#B9AE97' },
  invite: { borderWidth: 1.5, borderColor: colors.rule, borderRadius: radius.action, padding: 16, gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.rule },
});
