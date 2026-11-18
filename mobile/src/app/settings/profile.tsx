import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field } from '@/components/controls';
import { goBack } from '@/components/header';
import { Group, InfoRow, NavRow, Notice, SettingsScreen } from '@/components/settings-ui';
import { Body } from '@/components/type';
import { api } from '@/lib/api';
import { birthDate, useAuth } from '@/lib/auth';
import { success } from '@/lib/feel';
import { colors } from '@/theme';

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
const toDisplay = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

/** Typing digits fills in the slashes: 12061994 -> 12/06/1994 */
function maskDate(text: string) {
  const d = text.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** 'DD/MM/YYYY' -> 'YYYY-MM-DD', or 'invalid' */
function toIso(display: string): string | null | 'invalid' {
  if (!display.trim()) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return 'invalid';
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
  if (d.getUTCFullYear() !== +yyyy || d.getUTCMonth() !== +mm - 1 || d.getUTCDate() !== +dd) return 'invalid';
  if (+yyyy < 1900 || d.getTime() > Date.now()) return 'invalid';
  return `${yyyy}-${mm}-${dd}`;
}

export default function EditProfile() {
  const { user, updateUser } = useAuth();
  const startDob = birthDate(user);

  const [forenames, setForenames] = useState(user?.forenames ?? '');
  const [surname, setSurname] = useState(user?.surname ?? '');
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [dob, setDob] = useState(toDisplay(startDob));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  if (!user) {
    return (
      <SettingsScreen title="Edit profile">
        <Body>Sign in to edit your profile.</Body>
      </SettingsScreen>
    );
  }

  const dobIso = toIso(dob);
  const errors = {
    forenames: touched && !forenames.trim() ? 'Required' : null,
    surname: touched && !surname.trim() ? 'Required' : null,
    phone: touched && phone.trim() && !/^\+?[\d\s()-]{7,20}$/.test(phone.trim()) ? 'Enter a valid phone number' : null,
    dob: touched && dobIso === 'invalid' ? 'Use DD/MM/YYYY, a date in the past' : null,
  };

  const changes: Parameters<typeof api.updateProfile>[0] = {};
  if (forenames.trim() !== user.forenames) changes.forenames = forenames.trim();
  if (surname.trim() !== user.surname) changes.surname = surname.trim();
  if (phone.trim() !== (user.phoneNumber ?? '')) changes.phoneNumber = phone.trim() || null;
  if (dobIso !== 'invalid' && dobIso !== startDob) changes.dateOfBirth = dobIso;
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    setTouched(true);
    setResult(null);
    if (!forenames.trim() || !surname.trim() || dobIso === 'invalid' || (phone.trim() && !/^\+?[\d\s()-]{7,20}$/.test(phone.trim()))) return;
    if (!dirty) return;
    setBusy(true);
    try {
      const fresh = await api.updateProfile(changes);
      updateUser({
        forenames: fresh.forenames,
        surname: fresh.surname,
        phoneNumber: fresh.phoneNumber ?? null,
        dateOfBirth: fresh.dateOfBirth ?? null,
      });
      success();
      setResult({ tone: 'ok', text: 'Saved.' });
      setTimeout(() => goBack('/account'), 600);
    } catch (e: any) {
      setResult({ tone: 'error', text: e?.message ?? 'Could not save your changes.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsScreen
      title="Edit profile"
      subtitle="PERSONAL DETAILS"
      footer={<Button label={dirty ? 'Save changes' : 'No changes'} disabled={!dirty} busy={busy} onPress={save} />}>
      <Group title="Profile look">
        <NavRow
          label="Username, avatar and backdrop"
          value={user.username ? `@${user.username}` : null}
          onPress={() => router.push('/profile-setup')}
        />
      </Group>
      <View style={{ gap: 16 }}>
        <Field label="First names" value={forenames} onChangeText={setForenames} autoComplete="given-name" textContentType="givenName" error={errors.forenames} />
        <Field label="Surname" value={surname} onChangeText={setSurname} autoComplete="family-name" textContentType="familyName" error={errors.surname} />
        <Field
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="+233 24 000 0000"
          error={errors.phone}
        />
        <Field
          label="Date of birth"
          value={dob}
          onChangeText={(t) => setDob(maskDate(t))}
          keyboardType="number-pad"
          placeholder="DD/MM/YYYY"
          maxLength={10}
          error={errors.dob}
        />
        <Body size={12.5} color={colors.dust} style={{ marginTop: -8 }}>
          Optional. Staff may still ask for ID at the door for age-rated films.
        </Body>
      </View>

      <Group title="Sign-in email" note="Your email is how you sign in, so it can't be changed in the app yet.">
        <InfoRow label="Email" value={user.email} selectable />
      </Group>

      {result ? <Notice tone={result.tone}>{result.text}</Notice> : null}
    </SettingsScreen>
  );
}
