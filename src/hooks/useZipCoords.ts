// One-shot loader for the bundled zip → [lat,lng] dataset. We deliberately keep this
// outside React state — the file is static, large-ish, and shared across every
// component that needs to geocode. A module-level promise singleton means concurrent
// callers all await the same fetch; subsequent callers resolve synchronously from cache.

import { useEffect, useState } from 'react';

export type ZipCoordMap = Record<string, [number, number]>;

let cache: ZipCoordMap | null = null;
let inFlight: Promise<ZipCoordMap> | null = null;

export async function loadZipCoords(): Promise<ZipCoordMap> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = fetch('/zip-coords.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load zip coordinates (${r.status})`);
        return r.json() as Promise<ZipCoordMap>;
      })
      .then((data) => {
        cache = data;
        return data;
      })
      .catch((err) => {
        inFlight = null; // allow retry on next call
        throw err;
      });
  }
  return inFlight;
}

export function useZipCoords(): {
  zipCoords: ZipCoordMap | null;
  loading: boolean;
  error: string | null;
} {
  const [zipCoords, setZipCoords] = useState<ZipCoordMap | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    setLoading(true);
    loadZipCoords()
      .then((data) => {
        if (!cancelled) {
          setZipCoords(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { zipCoords, loading, error };
}
