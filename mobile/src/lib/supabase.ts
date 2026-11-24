import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Supabase handles sign-in (email + password). The access token it
 * gives us is sent to the Savannah API, which checks it with Supabase.
 *
 * Only set up when EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
 * are set; without them the app uses the old local server's sign-in.
 */
export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          // localStorage on the web; AsyncStorage on phones (sessions
          // are too big for the secure store's 2 KB limit)
          storage: Platform.OS === 'web' ? undefined : AsyncStorage,
          storageKey: 'savannah.supabase.auth',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === 'web',
        },
      })
    : null;

// Refresh tokens only while the app is in the foreground (Supabase's advice for React Native)
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
