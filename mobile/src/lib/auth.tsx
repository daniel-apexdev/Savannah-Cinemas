import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { storage } from './storage';
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
    await storage.remove(TOKEN_KEY);
    await storage.remove(USER_KEY);
  }, []);

  // Restore session on launch; validate in the background.
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await storage.get(TOKEN_KEY);
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
        const r = await api.login(email.trim().toLowerCase(), password);
        await persist(r.token, r.user);
      },
      register: async (p) => {
        const r = await api.register({ ...p, email: p.email.trim().toLowerCase() });
        await persist(r.token, r.user);
      },
      signOut,
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
