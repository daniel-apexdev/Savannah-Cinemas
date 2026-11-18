import { useState } from 'react';

import { Group, Notice, SettingsScreen, ToggleRow } from '@/components/settings-ui';
import { ErrorState, Shimmer } from '@/components/states';
import { Body } from '@/components/type';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { NotificationPrefs } from '@/lib/types';
import { useRequest } from '@/lib/use-request';
import { colors } from '@/theme';

// The backend creates these rows with everything on, so that's the
// starting point if none exist yet.
const DEFAULTS: NotificationPrefs = {
  bookingConfirmations: true,
  bookingReminders: true,
  newMovies: true,
  movieReleases: true,
  promotions: true,
};

const ROWS: { key: keyof NotificationPrefs; label: string; detail: string; group: 'tickets' | 'films' | 'offers' }[] = [
  { key: 'bookingConfirmations', label: 'Booking confirmations', detail: 'Your booking reference and seats when you pay.', group: 'tickets' },
  { key: 'bookingReminders', label: 'Show reminders', detail: 'A nudge before a film you’ve booked starts.', group: 'tickets' },
  { key: 'newMovies', label: 'New films added', detail: 'When a film joins the programme.', group: 'films' },
  { key: 'movieReleases', label: 'Opening days', detail: 'When a coming-soon film opens or goes on sale.', group: 'films' },
  { key: 'promotions', label: 'Offers and promotions', detail: 'Discount codes and special screenings.', group: 'offers' },
];

export default function Notifications() {
  const { user } = useAuth();
  const req = useRequest(() => api.notificationPrefs(), [user?.userId], { enabled: !!user });
  // Local edits on top of the server copy (optimistic)
  const [edits, setEdits] = useState<Partial<NotificationPrefs>>({});
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <SettingsScreen title="Notifications">
        <Body>Sign in to choose what we send you.</Body>
      </SettingsScreen>
    );
  }

  const prefs: NotificationPrefs = { ...DEFAULTS, ...(req.data ?? {}), ...edits };

  const set = async (key: keyof NotificationPrefs, value: boolean) => {
    setError(null);
    setEdits((e) => ({ ...e, [key]: value }));
    try {
      await api.setNotificationPrefs({ [key]: value });
    } catch (e: any) {
      setEdits((x) => ({ ...x, [key]: !value }));
      setError(e?.message ?? 'Could not save that change.');
    }
  };

  const group = (g: 'tickets' | 'films' | 'offers') =>
    ROWS.filter((r) => r.group === g).map((r) => (
      <ToggleRow key={r.key} label={r.label} detail={r.detail} value={prefs[r.key]} onChange={(v) => set(r.key, v)} />
    ));

  return (
    <SettingsScreen title="Notifications" subtitle="WHAT WE SEND YOU">
      {req.loading ? (
        <>
          <Shimmer style={{ height: 56 }} />
          <Shimmer style={{ height: 56 }} />
          <Shimmer style={{ height: 56 }} />
        </>
      ) : req.error && !req.data ? (
        <ErrorState error={req.error} onRetry={req.reload} />
      ) : (
        <>
          <Group title="Your tickets">{group('tickets')}</Group>
          <Group title="Films">{group('films')}</Group>
          <Group title="Offers">{group('offers')}</Group>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Body size={12.5} color={colors.dust}>
            Saved to your account, so they apply on the website too. Your tickets are always in the app, whatever you choose here.
          </Body>
        </>
      )}
    </SettingsScreen>
  );
}
