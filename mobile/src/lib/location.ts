import { useEffect, useSyncExternalStore } from 'react';

import { api } from './api';
import { storage } from './storage';
import type { Cinema } from './types';

/**
 * Which Savannah Cinemas location the user is browsing (Accra Mall or
 * West Hills Mall). Kept on the device; Tonight, film pages and the
 * Films index show that location's shows.
 */
const KEY = 'savannah.location';

let cinemas: Cinema[] = [];
let chosen: number | null = null;
let loading: Promise<void> | null = null;
let snapshot = { cinemas, cinemaId: chosen as number | null };
const listeners = new Set<() => void>();

function emit() {
  const id = chosen != null && cinemas.some((c) => c.cinemaId === chosen) ? chosen : defaultId();
  snapshot = { cinemas, cinemaId: id };
  listeners.forEach((l) => l());
}

function defaultId() {
  return (cinemas.find((c) => /accra mall/i.test(c.cinemaName)) ?? cinemas[0])?.cinemaId ?? null;
}

/** "Savannah Cinemas - West Hills Mall" → "West Hills Mall" */
export function locationName(c?: { cinemaName?: string | null; name?: string | null } | null) {
  const n = c?.cinemaName ?? c?.name ?? '';
  return n.replace(/^Savannah Cinemas\s*[-–·]\s*/i, '').trim() || 'Savannah Cinemas';
}

export function loadLocations() {
  if (!loading) {
    loading = (async () => {
      const saved = await storage.get(KEY);
      if (saved && Number.isFinite(Number(saved))) chosen = Number(saved);
      try {
        const list = await api.cinemas();
        cinemas = list.filter((c) => c.isActive !== false).map((c) => ({ ...c, cinemaId: Number(c.cinemaId) }));
      } catch {
        loading = null; // try again next time someone asks
      }
      emit();
    })();
  }
  return loading;
}

export function setLocation(cinemaId: number) {
  chosen = cinemaId;
  storage.set(KEY, String(cinemaId));
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useLocation() {
  const s = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  useEffect(() => {
    if (!s.cinemas.length) loadLocations();
  }, [s.cinemas.length]);
  const cinema = s.cinemas.find((c) => c.cinemaId === s.cinemaId) ?? null;
  return { cinemas: s.cinemas, cinemaId: s.cinemaId, cinema, name: cinema ? locationName(cinema) : null };
}
