// Loader for the bundled set of MillionVerifier-confirmed "good" email
// addresses. When normalizing the SEED dataset (the bundled HubSpot
// export served by the "Use the default list" CTA), we filter to rows
// whose email is in this set so the team can't accidentally send to
// bounce-risk addresses.
//
// Custom uploads (the rep brings their own CSV/XLSX) don't go through
// this filter — they're the rep's responsibility to verify.
//
// Same singleton-promise pattern as useZipCoords: module-level cache,
// in-flight dedup so concurrent callers share the fetch.

import { useEffect, useState } from 'react';

/** Lowercased, trimmed verified emails. Set for O(1) membership checks. */
export type VerifiedEmailSet = Set<string>;

let cache: VerifiedEmailSet | null = null;
let inFlight: Promise<VerifiedEmailSet> | null = null;

export async function loadVerifiedEmails(): Promise<VerifiedEmailSet> {
  if (cache) return cache;
  if (!inFlight) {
    inFlight = fetch('/verified-emails.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load verified emails (${r.status})`);
        return r.json() as Promise<string[]>;
      })
      .then((arr) => {
        const set = new Set(arr);
        cache = set;
        return set;
      })
      .catch((err) => {
        inFlight = null;
        throw err;
      });
  }
  return inFlight;
}

/** React hook that mirrors loadVerifiedEmails for use inside components.
 *  Not currently used (the seed loader awaits the promise directly), but
 *  kept for symmetry with useZipCoords in case a future flow needs it
 *  declaratively. */
export function useVerifiedEmails(): {
  verified: VerifiedEmailSet | null;
  loading: boolean;
  error: string | null;
} {
  const [verified, setVerified] = useState<VerifiedEmailSet | null>(cache);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    setLoading(true);
    loadVerifiedEmails()
      .then((data) => {
        if (!cancelled) {
          setVerified(data);
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

  return { verified, loading, error };
}
