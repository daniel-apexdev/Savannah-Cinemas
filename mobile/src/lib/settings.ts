import { useSyncExternalStore } from 'react';

import { storage } from './storage';

/**
 * Small app-level settings kept on the device (not the account).
 * Loaded once at start-up; read with useSetting(), change with setSetting().
 */
export type FilmsLayout = 'wall' | 'grid' | 'index';

export interface AppSettings {
  haptics: boolean;
  filmsLayout: FilmsLayout;
}

const KEY = 'savannah.settings';
const defaults: AppSettings = { haptics: true, filmsLayout: 'wall' };

let current: AppSettings = defaults;
const listeners = new Set<() => void>();

export async function loadSettings() {
  const raw = await storage.get(KEY);
  if (!raw) return;
  try {
    current = { ...defaults, ...JSON.parse(raw) };
    listeners.forEach((l) => l());
  } catch {
    // ignore a corrupt value; defaults stand
  }
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return current[key];
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  current = { ...current, [key]: value };
  listeners.forEach((l) => l());
  storage.set(KEY, JSON.stringify(current));
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return useSyncExternalStore(subscribe, () => current[key], () => current[key]);
}
