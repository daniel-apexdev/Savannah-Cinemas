import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Button, Field } from '@/components/controls';
import { goBack } from '@/components/header';
import { Notice, SettingsScreen } from '@/components/settings-ui';
import { Body, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { success } from '@/lib/feel';
import { colors } from '@/theme';

export default function ChangePassword() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const nextRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  if (!user) {
    return (
      <SettingsScreen title="Password">
        <Body>Sign in to change your password.</Body>
      </SettingsScreen>
    );
  }

  const errors = {
    current: touched && !current ? 'Required' : null,
    next: touched && next.length < 8 ? 'At least 8 characters' : touched && next === current && next ? 'Choose a different password' : null,
    confirm: touched && confirm !== next ? 'Passwords don’t match' : null,
  };

  const submit = async () => {
    setTouched(true);
    setResult(null);
    if (!current || next.length < 8 || next !== confirm || next === current) return;
    setBusy(true);
    try {
      await api.changePassword(current, next);
      success();
      setCurrent('');
      setNext('');
      setConfirm('');
      setTouched(false);
      setResult({ tone: 'ok', text: 'Password changed. Use it next time you sign in.' });
      setTimeout(() => goBack('/account'), 1200);
    } catch (e: any) {
      setResult({ tone: 'error', text: e?.message ?? 'Could not change your password.' });
    } finally {
      setBusy(false);
    }
  };

  const secure = !show;

  return (
    <SettingsScreen
      title="Password"
      subtitle="CHANGE PASSWORD"
      footer={<Button label="Change password" busy={busy} onPress={submit} />}>
      <View style={{ gap: 16 }}>
        <Field
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry={secure}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()}
          error={errors.current}
        />
        <Field
          ref={nextRef}
          label="New password"
          value={next}
          onChangeText={setNext}
          secureTextEntry={secure}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          error={errors.next}
        />
        <Field
          ref={confirmRef}
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry={secure}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={errors.confirm}
        />
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: show }}
          onPress={() => setShow((v) => !v)}
          style={{ height: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Mono size={12.5} color={colors.lateriteSoft}>
            {show ? 'HIDE PASSWORDS' : 'SHOW PASSWORDS'}
          </Mono>
        </Pressable>
        <Body size={12.5} color={colors.dust}>
          At least 8 characters. You’ll stay signed in on this phone.
        </Body>
      </View>
      {result ? <Notice tone={result.tone}>{result.text}</Notice> : null}
    </SettingsScreen>
  );
}
