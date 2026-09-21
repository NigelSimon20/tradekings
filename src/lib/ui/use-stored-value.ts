"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Reads and writes one `localStorage` key as a React store.
 *
 * `localStorage` is an external system, so it is subscribed to rather than
 * copied into state in an effect. It is also unavailable in private windows and
 * during server rendering, so every access is guarded and the server snapshot
 * is always `null`.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useStoredValue(key: string): [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );

  const set = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Blocked storage costs the preference, not the feature.
      }
      // `storage` does not fire in the tab that wrote the value.
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, set];
}
