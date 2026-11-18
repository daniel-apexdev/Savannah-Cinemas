import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Field } from '@/components/controls';
import { Notice, SettingsScreen } from '@/components/settings-ui';
import { Body, Display, Label } from '@/components/type';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

const GOES = [
  'Your name, phone number and date of birth',
  'Your watchlist, saved films and preferences',
  'Unpaid seat holds and snack orders',
];
const STAYS = ['A record of past purchases, without your name on it (the cinema needs this for its accounts)'];

export default function DeleteAccount() {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; tickets?: boolean } | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <SettingsScreen title="Account deleted" footer={<Button label="Done" onPress={() => router.replace('/')} />}>
        <Display size={34} black>
          Your account has been deleted
        </Display>
        <Body>You’ve been signed out. Thanks for coming to the pictures with us.</Body>
      </SettingsScreen>
    );
  }

  if (!user) {
    return (
      <SettingsScreen title="Delete account">
        <Body>Sign in to manage your account.</Body>
      </SettingsScreen>
    );
  }

  const submit = async () => {
    if (!password) {
      setError({ text: 'Enter your password to confirm.' });
      return;
    }
    if (!armed) {
      setArmed(true);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      await signOut();
      setDone(true);
    } catch (e) {
      const err = e as ApiError;
      setArmed(false);
      setError({ text: err.message, tickets: err.status === 409 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsScreen
      title="Delete account"
      subtitle={user.email.toUpperCase()}
      footer={
        <>
          {armed ? (
            <Body size={13} color={colors.lateriteSoft} style={{ textAlign: 'center' }}>
              This can’t be undone. Tap again to delete.
            </Body>
          ) : null}
          <Button label={armed ? 'Yes, delete my account' : 'Delete my account'} busy={busy} onPress={submit} />
        </>
      }>
      <Body>
        Deleting your account signs you out everywhere and stops the email and password from working. If you want to come back later, you can
        sign up again with the same email.
      </Body>

      <View style={{ gap: 8 }}>
        <Label>DELETED</Label>
        {GOES.map((t) => (
          <Body key={t} size={14}>
            – {t}
          </Body>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Label>KEPT</Label>
        {STAYS.map((t) => (
          <Body key={t} size={14}>
            – {t}
          </Body>
        ))}
      </View>
      <Body size={13} color={colors.dust}>
        If you have paid tickets for shows that haven’t happened yet, cancel them first or wait until after the show.
      </Body>

      <Field
        label="Password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setArmed(false);
        }}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />

      {error ? <Notice tone="error">{error.text}</Notice> : null}
      {error?.tickets ? <Button label="See my tickets" variant="outline" onPress={() => router.navigate('/account')} /> : null}
    </SettingsScreen>
  );
}
