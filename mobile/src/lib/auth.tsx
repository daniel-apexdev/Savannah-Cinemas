import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setAuthToken, setUnauthorizedHandler } from './api';
import { USE_SUPABASE } from './config';
import { storage } from './storage';
import { supabase } from './supabase';
import type { User } from './types';

const TOKEN_KEY = 'savannah.token';
const USER_KEY = 'savannah.user';

interface AuthState {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (p: { forenames: string; surname: string; email: string; password: string; phoneNumber?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Merge fresh profile fields into the signed-in user (and the cache). */
  updateUser: (patch: Partial<User>) => void;
  /** Supabase: load the account for the current session (e.g. after a password-reset link). */
  adoptSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const persist = useCallback(async (token: string, u: User) => {
    setAuthToken(token);
    setUser(u);
    await storage.set(TOKEN_KEY, token);
    await storage.set(USER_KEY, JSON.stringify(u));
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    if (supabase) await supabase.auth.signOut().catch(() => {});
    await storage.remove(TOKEN_KEY);
    await storage.remove(USER_KEY);
  }, []);

  // Supabase: keep the API token in step with the session (refreshes, sign-out elsewhere)
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthToken(session?.access_token ?? null);
      if (event === 'SIGNED_OUT') {
        setUser(null);
        storage.remove(USER_KEY);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Restore session on launch; validate in the background.
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = supabase
        ? ((await supabase.auth.getSession()).data.session?.access_token ?? null)
        : await storage.get(TOKEN_KEY);
      const cached = await storage.get(USER_KEY);
      if (token) {
        setAuthToken(token);
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch {
            /* ignore */
          }
        }
      }
      if (alive) setReady(true);
      if (token) {
        try {
          const fresh = await api.me();
          if (alive) {
            setUser(fresh);
            storage.set(USER_KEY, JSON.stringify(fresh));
          }
        } catch (e: any) {
          if (e?.status === 401 && alive) signOut();
          // offline: keep the cached user
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [signOut]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      signIn: async (email, password) => {
        if (supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
          if (error || !data.session) throw new ApiError(friendlyAuthError(error?.message), error?.status ?? 401);
          setAuthToken(data.session.access_token);
          const me = await api.me();
          await persist(data.session.access_token, me);
          return;
        }
        const r = await api.login(email.trim().toLowerCase(), password);
        await persist(r.token, r.user);
      },
      register: async (p) => {
        if (supabase) {
          const { data, error } = await supabase.auth.signUp({
            email: p.email.trim().toLowerCase(),
            password: p.password,
            options: { data: { forenames: p.forenames.trim(), surname: p.surname.trim(), phoneNumber: p.phoneNumber || null } },
          });
          if (error) throw new ApiError(friendlyAuthError(error.message), error.status ?? 400);
          // Email confirmation is switched on in Supabase: no session until they click the link
          if (!data.session) throw new ConfirmEmailError(p.email.trim().toLowerCase());
          setAuthToken(data.session.access_token);
          const me = await api.me(); // creates the Savannah account on first sign-in
          await persist(data.session.access_token, me);
          return;
        }
        const r = await api.register({ ...p, email: p.email.trim().toLowerCase() });
        await persist(r.token, r.user);
      },
      signOut,
      adoptSession: async () => {
        if (!supabase) return false;
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) return false;
        setAuthToken(session.access_token);
        const me = await api.me();
        await persist(session.access_token, me);
        return true;
      },
      updateUser: (patch) => {
        setUser((prev) => {
          if (!prev) return prev;
          const next = { ...prev, ...patch };
          storage.set(USER_KEY, JSON.stringify(next));
          return next;
        });
      },
    }),
    [ready, user, persist, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Thrown by register() when Supabase wants the email address confirmed first. */
export class ConfirmEmailError extends Error {
  email: string;
  constructor(email: string) {
    super(`We've sent a link to ${email}. Open it to confirm your email, then sign in.`);
    this.email = email;
  }
}

/** Supabase's sign-in messages, in the app's words. */
export function friendlyAuthError(message?: string | null) {
  const m = String(message ?? '');
  if (/invalid login credentials/i.test(m)) return 'That email and password don’t match an account.';
  if (/already registered|already been registered|already exists/i.test(m)) return 'An account with this email already exists. Sign in instead.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (/password should be at least|weak password/i.test(m)) return 'Choose a longer password (at least 8 characters).';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
  if (/fetch|network/i.test(m)) return "Can't reach Savannah Cinemas. Check your connection.";
  return m || 'Sign-in failed. Try again.';
}

/** Whether sign-in goes through Supabase (hosted) or the local server. */
export const SIGN_IN_WITH_SUPABASE = USE_SUPABASE;

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Date of birth as 'YYYY-MM-DD', from either profile shape. */
export function birthDate(u: User | null): string | null {
  // A top-level dateOfBirth (even null) is newer than the /auth/me shape
  const raw = u && 'dateOfBirth' in u ? u.dateOfBirth : u?.customerProfile?.dateOfBirth;
  return raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
}

export function initials(u: User | null) {
  if (!u) return '';
  return `${u.forenames?.[0] ?? ''}${u.surname?.[0] ?? ''}`.toUpperCase();
}
