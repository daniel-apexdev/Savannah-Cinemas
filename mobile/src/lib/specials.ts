import { useEffect, useSyncExternalStore } from 'react';

import { api } from './api';
import type { SpecialProgramme, SpecialScreening } from './types';

/**
 * Special nights (Throwback Thursday, Bargain Tuesday...): older films
 * from the catalogue, discounted. Loaded once and shared, so Tonight,
 * film pages and Events can all badge the same showtimes.
 */
type State = {
  programmes: SpecialProgramme[];
  screenings: SpecialScreening[];
  byShowtime: Map<number, SpecialScreening>;
  loaded: boolean;
};

let state: State = { programmes: [], screenings: [], byShowtime: new Map(), loaded: false };
let loading: Promise<void> | null = null;
let fetchedAt = 0;
const listeners = new Set<() => void>();

export function loadSpecials(force = false) {
  if (loading) return loading;
  if (!force && state.loaded && Date.now() - fetchedAt < 10 * 60 * 1000) return Promise.resolve();
  loading = api
    .specials()
    .then(({ programmes, screenings }) => {
      state = { programmes, screenings, byShowtime: new Map(screenings.map((s) => [s.showtimeId, s])), loaded: true };
      fetchedAt = Date.now();
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* not set up on the server, or offline: no badges */
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSpecials() {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => {
    loadSpecials();
  }, []);
  const programme = (code: string) => s.programmes.find((p) => p.code === code) ?? null;
  return { ...s, programme };
}

/** "THROWBACK THURSDAY · 30% OFF" */
export function specialLabel(name: string | null | undefined, percent: number) {
  return `${(name ?? 'Special').toUpperCase()}${percent > 0 ? ` · ${Math.round(percent)}% OFF` : ''}`;
}
