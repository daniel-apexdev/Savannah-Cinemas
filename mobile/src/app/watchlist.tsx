import { useState } from 'react';
import { View } from 'react-native';

import { StackHeader } from '@/components/header';
import { WatchlistBody } from '@/components/watchlist';
import { colors } from '@/theme';

/** Saved films (also a tab in Account). */
export default function Watchlist() {
  const [count, setCount] = useState<number | null>(null);
  return (
    <View style={{ flex: 1, backgroundColor: colors.night }}>
      <StackHeader title="Watchlist" subtitle={count != null ? `${count} ${count === 1 ? 'FILM' : 'FILMS'}` : null} fallback="/account" />
      <WatchlistBody onCount={setCount} />
    </View>
  );
}
