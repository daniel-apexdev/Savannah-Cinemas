import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field } from '@/components/controls';
import { Body, Display, Label, Mono } from '@/components/type';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';
import { SiteFooter } from '@/components/site-footer';

/**
 * Opened from the "choose a new password" email (Supabase). The link
 * signs them in for a moment; here they pick the new password.
 */
export default function ResetPassword() {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, 480);
  const { adoptSession } = useAuth();
  const [ready, setReady] = useState<'checking' | 'yes' | 'no'>('checking');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The link's session arrives a moment after the page opens
  useEffect(() => {
    if (!supabase) {
      setTimeout(() => setReady('no'), 0);
      return;
    }
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (alive && session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) setReady('yes');
    });
    const t = setTimeout(async () => {
      const s = (await supabase!.auth.getSession()).data.session;
      if (alive) setReady(s ? 'yes' : 'no');
    }, 1500);
    return () => {
      alive = false;
      clearTimeout(t);
      data.subscription.unsubscribe();
    };
  }, []);

  const save = async () => {
    setError(null);
    if (password.length < 8) return setError('Choose at least 8 characters.');
    if (password !== again) return setError('The two passwords don’t match.');
    setBusy(true);
    const { error: e } = (await supabase?.auth.updateUser({ password })) ?? { error: null };
    if (e) {
      setBusy(false);
      return setError(friendlyAuthError(e.message));
    }
    await adoptSession().catch(() => false);
    setBusy(false);
    router.replace('/');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.night }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ width, alignSelf: 'center', paddingHorizontal: space.gutter, paddingTop: insets.top + 24, paddingBottom: 40, gap: 18 }}>
      <View style={{ gap: 6 }}>
        <Label color={colors.laterite}>SAVANNAH CINEMAS</Label>
        <Display size={36} black>
          Choose a new password
        </Display>
      </View>

      {ready === 'checking' ? (
        <Body color={colors.dust}>Checking your link…</Body>
      ) : ready === 'no' ? (
        <>
          <Body color={colors.boneSoft}>This link has expired or was already used. Ask for a new one from the sign-in screen.</Body>
          <Button label="Go to sign in" onPress={() => router.replace({ pathname: '/sign-in', params: { mode: 'in' } })} />
        </>
      ) : (
        <>
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
          <Field label="New password again" value={again} onChangeText={setAgain} secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={save} />
          {error ? (
            <View style={{ borderLeftWidth: 4, borderLeftColor: colors.laterite, paddingLeft: 12 }} accessibilityLiveRegion="assertive">
              <Mono size={13} color={colors.lateriteSoft}>
                {error}
              </Mono>
            </View>
          ) : null}
          <Button label="Save and sign in" busy={busy} onPress={save} />
        </>
      )}
      <SiteFooter />
    </ScrollView>
  );
}
