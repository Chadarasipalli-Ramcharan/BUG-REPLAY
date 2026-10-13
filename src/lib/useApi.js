"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal data-fetching hook with loading / error state, manual refresh,
 * and retry. Never fabricates data: on error, data stays null.
 */
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const reqId = useRef(0);

  useEffect(() => {
    let alive = true;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(() => fn())
      .then((result) => {
        if (!alive || id !== reqId.current) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive || id !== reqId.current) return;
        setData(null);
        setError(err);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refresh };
}

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
