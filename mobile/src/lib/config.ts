import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the Savannah Cinemas backend lives.
 *
 * 1. EXPO_PUBLIC_API_URL wins if set (e.g. http://192.168.1.10:5000/api
 *    or your hosted server). Put it in mobile/.env.
 * 2. In development, the phone already talks to your computer's Expo
 *    server, so we reuse that computer's LAN address on port 5000.
 * 3. Otherwise fall back to localhost (web / emulator on same machine).
 */
const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '5000';

function devHostAddress(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // older manifests
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return host || null;
}

function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}/api`;
  }

  const host = devHostAddress();
  if (host) return `http://${host}:${API_PORT}/api`;

  // Android emulator reaches the host machine on 10.0.2.2
  if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}/api`;
  return `http://localhost:${API_PORT}/api`;
}

export const API_BASE = resolveApiBase();

/**
 * The backend's payment controller currently simulates the charge
 * (see paymentController.js: mockTransactionReference). While that is
 * true the checkout says so, so nobody thinks real money moved.
 * Set EXPO_PUBLIC_PAYMENTS_LIVE=true once a real provider is wired in.
 */
export const PAYMENTS_LIVE = process.env.EXPO_PUBLIC_PAYMENTS_LIVE === 'true';

/** Booking holds created by POST /bookings last this long (bookingController). */
export const HOLD_MINUTES = 15;
