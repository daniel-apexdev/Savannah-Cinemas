import { useSyncExternalStore } from 'react';

import { storage } from './storage';

/**
 * Whether this device has seen the welcome slides. Loaded before the
 * first screen shows (see app/_layout.tsx), so there's no flash.
 */
const KEY = 'savannah.welcomed';

let state: 'unknown' | 'yes' | 'no' = 'unknown';
const listeners = new Set<() => void>();

export async function loadWelcomed() {
  state = (await storage.get(KEY)) === '1' ? 'yes' : 'no';
  listeners.forEach((l) => l());
}

export function markWelcomed() {
  state = 'yes';
  storage.set(KEY, '1');
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useWelcomed() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
