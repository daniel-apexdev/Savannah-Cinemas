import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

import { ApiError } from './api';

export interface RequestState<T> {
  data: T | undefined;
  error: ApiError | null;
  loading: boolean; // first load, nothing to show yet
  refreshing: boolean; // reload with data already on screen
  reload: () => Promise<void>;
}

type Settled<T> = { key: string; data: T | undefined; error: ApiError | null };

/**
 * Minimal data loader. Keeps the last good data on screen while
 * refreshing and exposes failures as ApiError. `deps` must be
 * serialisable (ids, strings). Pass `enabled: false` to wait.
 */
export function useRequest<T>(
  fn: () => Promise<T>,
  deps: (string | number | boolean | null | undefined)[],
  { enabled = true }: { enabled?: boolean } = {},
): RequestState<T> {
  const depsKey = JSON.stringify(deps);
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ key: '', data: undefined, error: null });
  const waiters = useRef<(() => void)[]>([]);
  const currentKey = `${depsKey}#${nonce}`;

  // Always runs the latest `fn` without re-triggering the effect.
  const load = useEffectEvent(() => fn());

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load()
      .then((data) => {
        if (alive) setSettled({ key: currentKey, data, error: null });
      })
      .catch((e) => {
        if (!alive) return;
        const err = e instanceof ApiError ? e : new ApiError(String((e as Error)?.message ?? e), 0);
        setSettled((prev) => ({ key: currentKey, data: prev.key.split('#')[0] === currentKey.split('#')[0] ? prev.data : undefined, error: err }));
      })
      .finally(() => {
        if (!alive) return;
        const w = waiters.current;
        waiters.current = [];
        w.forEach((r) => r());
      });
    return () => {
      alive = false;
    };
  }, [enabled, currentKey]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiters.current.push(resolve);
        setNonce((n) => n + 1);
      }),
    [],
  );

  // A change of deps means old data belongs to something else.
  const sameDeps = settled.key.split('#')[0] === depsKey;
  const data = sameDeps ? settled.data : undefined;
  const pending = enabled && settled.key !== currentKey;

  return {
    data,
    error: sameDeps && !pending ? settled.error : null,
    loading: pending && data === undefined,
    refreshing: pending && data !== undefined,
    reload,
  };
}
