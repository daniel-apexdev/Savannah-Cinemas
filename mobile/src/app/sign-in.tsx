import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, IconButton } from '@/components/controls';
import { goBack } from '@/components/header';
import { CloseIcon } from '@/components/icons';
import { Body, Display, Label, Mono } from '@/components/type';
import { api } from '@/lib/api';
import { ConfirmEmailError, SIGN_IN_WITH_SUPABASE, useAuth } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDING_REFERRAL = 'savannah.pendingReferral';

/** Where the "choose a new password" email link opens: the website's /reset-password page. */
function resetRedirect() {
  const site = process.env.EXPO_PUBLIC_SITE_URL;
  if (site) return `${site.replace(/\/+$/, '')}/reset-password`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/reset-password`;
  return undefined;
}
const MAX_W = 480;

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const width = Math.min(winW, MAX_W);
  const { signIn, register } = useAuth();
  const params = useLocalSearchParams<{ mode?: 'in' | 'up' }>();
  const [mode, setMode] = useState<'in' | 'up'>(params.mode === 'up' ? 'up' : 'in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forenames, setForenames] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [referral, setReferral] = useState('');
  // Account made, but the referral code didn't take: let them carry on
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Good news that isn't an error: "check your email", "reset link sent"
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const pwRef = useRef<ComponentRef<typeof TextInput>>(null);

  const emailErr = touched && !EMAIL.test(email.trim()) ? 'Enter a valid email' : null;
  const pwErr = touched && mode === 'up' && password.length < 8 ? 'At least 8 characters' : touched && !password ? 'Required' : null;
  const nameErr = touched && mode === 'up' && (!forenames.trim() || !surname.trim()) ? 'Required' : null;

  const submit = async () => {
    if (joined) {
      router.replace({ pathname: '/profile-setup', params: { fresh: '1' } });
      return;
    }
    setTouched(true);
    setError(null);
    setNotice(null);
    if (!EMAIL.test(email.trim()) || !password || (mode === 'up' && (password.length < 8 || !forenames.trim() || !surname.trim()))) return;
    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(email, password);
        // A referral code from a sign-up that had to confirm its email first
        const pending = await storage.get(PENDING_REFERRAL);
        if (pending) {
          storage.remove(PENDING_REFERRAL);
          await api.claimReferral(pending).catch(() => {});
        }
      } else {
        await register({ forenames: forenames.trim(), surname: surname.trim(), email, password, phoneNumber: phone.trim() || undefined });
        if (referral.trim()) {
          try {
            await api.claimReferral(referral.trim());
          } catch (e: any) {
            setJoined(true);
            setError(`Your account is ready, but the referral code didn’t work: ${e?.message ?? 'please check it'}. You can add it in Account › Rewards before your first booking.`);
            return;
          }
        }
        // New account: pick a username, avatar and backdrop next
        router.replace({ pathname: '/profile-setup', params: { fresh: '1' } });
        return;
      }
      goBack('/');
    } catch (e: any) {
      if (e instanceof ConfirmEmailError) {
        // Supabase sends a confirmation link first; they sign in after
        if (referral.trim()) await storage.set(PENDING_REFERRAL, referral.trim());
        setMode('in');
        setPassword('');
        setTouched(false);
        setNotice(e.message);
        return;
      }
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.night }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ width, alignSelf: 'center', paddingHorizontal: space.gutter, paddingTop: insets.top + 12, paddingBottom: 40, gap: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Display size={26} black>
            Savannah
          </Display>
          <IconButton label="Close" onPress={() => goBack('/')} style={{ borderWidth: 1.5, borderColor: colors.rule }}>
            <CloseIcon />
          </IconButton>
        </View>

        <View style={{ gap: 8, marginTop: 24 }}>
          <Display size={46} black>
            {mode === 'in' ? 'Welcome back' : 'Get a seat'}
          </Display>
          <Body>{mode === 'in' ? 'Sign in to book seats and keep your tickets in one place.' : 'One account for booking, tickets and your watchlist.'}</Body>
        </View>

        {mode === 'up' ? (
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Field label="First name" value={forenames} onChangeText={setForenames} autoComplete="given-name" textContentType="givenName" error={!forenames.trim() ? nameErr : null} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Surname" value={surname} onChangeText={setSurname} autoComplete="family-name" textContentType="familyName" error={!surname.trim() ? nameErr : null} />
            </View>
          </View>
        ) : null}

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => pwRef.current?.focus()}
          error={emailErr}
        />
        <Field
          ref={pwRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          textContentType={mode === 'in' ? 'password' : 'newPassword'}
          returnKeyType="go"
          onSubmitEditing={submit}
          error={pwErr}
        />
        {mode === 'up' ? (
          <>
            <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="+233" />
            <Field
              label="Friend’s referral code (optional)"
              value={referral}
              onChangeText={(t) => setReferral(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="e.g. EFUA7455"
            />
            <Body size={12.5} color={colors.dust} style={{ marginTop: -8 }}>
              Joining with a friend’s code gives you 100 bonus points on top of your 100 welcome points.
            </Body>
          </>
        ) : null}

        {mode === 'in' && SIGN_IN_WITH_SUPABASE ? (
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              setError(null);
              if (!EMAIL.test(email.trim())) {
                setTouched(true);
                setError('Enter your email above, then tap “Forgot password?” again.');
                return;
              }
              const { error: e } = (await supabase?.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
                redirectTo: resetRedirect(),
              })) ?? { error: null };
              if (e) setError(e.message);
              else setNotice(`If ${email.trim()} has an account, we’ve emailed a link to choose a new password.`);
            }}
            style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: -8 }}>
            <Label color={colors.dust}>FORGOT PASSWORD?</Label>
          </Pressable>
        ) : null}

        {notice ? (
          <View style={{ borderLeftWidth: 4, borderLeftColor: colors.vip, paddingLeft: 12 }} accessibilityLiveRegion="polite">
            <Body size={14} color={colors.bone}>
              {notice}
            </Body>
          </View>
        ) : null}

        {error ? (
          <View style={{ borderLeftWidth: 4, borderLeftColor: colors.laterite, paddingLeft: 12 }} accessibilityLiveRegion="assertive">
            <Mono size={13} color={colors.lateriteSoft}>
              {error}
            </Mono>
          </View>
        ) : null}

        <Button label={joined ? 'Continue' : mode === 'in' ? 'Sign in' : 'Create account'} busy={busy} onPress={submit} />

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setError(null);
            setNotice(null);
            setTouched(false);
          }}
          style={{ height: 44, justifyContent: 'center', alignItems: 'center' }}>
          <Label color={colors.bone}>{mode === 'in' ? 'NEW HERE? CREATE AN ACCOUNT' : 'ALREADY HAVE AN ACCOUNT? SIGN IN'}</Label>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
