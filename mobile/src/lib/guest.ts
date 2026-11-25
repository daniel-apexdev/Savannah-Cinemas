import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

/**
 * Website guests: people who book on the website without an account.
 *
 * The first time they pick seats, the API gives this browser a guest
 * token ("guest_..."). It's kept in localStorage and sent with booking
 * requests, so they can hold seats, pay and reopen their tickets on this
 * browser. Their tickets are also emailed to the address given at
 * checkout. The phone app never uses this: it needs an account.
 */
const KEY = 'savannah.guest';

// EXPO_PUBLIC_REQUIRE_ACCOUNT=1 makes the website behave like the app
// (handy for checking the app's sign-in-first flow in a browser).
export const GUESTS_ALLOWED = Platform.OS === 'web' && process.env.EXPO_PUBLIC_REQUIRE_ACCOUNT !== '1';

let token: string | null = null;
if (GUESTS_ALLOWED) {
  try {
    token = globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    token = null;
  }
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function guestToken() {
  return token;
}

export function setGuestToken(next: string | null) {
  token = next;
  try {
    if (next) globalThis.localStorage?.setItem(KEY, next);
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // private browsing: works for this visit only
  }
  emit();
}

/** True when this browser has booked as a guest before. */
export function useHasGuest() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => !!token,
    () => !!token,
  );
}
