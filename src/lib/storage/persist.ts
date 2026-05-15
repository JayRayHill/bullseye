// IndexedDB-backed persistence via idb-keyval. We wrap every value in PersistedShape
// so the on-disk format is self-describing: the schema version is stored alongside
// the data, which lets us detect (and later migrate) older payloads on read.

import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { PersistedShape } from '../../types';

export interface ReadResult<T> {
  value: T | null;
  staleVersion?: number;
}

/** Read a persisted value. Returns null if absent or if the version does not match
 *  the current version and no migrator is supplied. A migrator transforms an older
 *  shape into the current one; return null from the migrator to drop the record. */
export async function safeGet<T>(
  key: string,
  currentVersion: number,
  migrate?: (oldData: unknown, oldVersion: number) => T | null
): Promise<ReadResult<T>> {
  try {
    const raw = (await idbGet(key)) as PersistedShape<T> | undefined;
    if (!raw || typeof raw !== 'object') return { value: null };
    if (raw.__version === currentVersion) return { value: raw.data };
    if (migrate) {
      const migrated = migrate(raw.data, raw.__version);
      return { value: migrated, staleVersion: raw.__version };
    }
    // Unmigrated old data: drop it so we do not keep reading stale state.
    await idbDel(key);
    return { value: null, staleVersion: raw.__version };
  } catch {
    return { value: null };
  }
}

/** Write a persisted value wrapped with its version. Returns success boolean.
 *  IndexedDB caps are large (hundreds of MB+) so a true failure here is rare. */
export async function safeSet<T>(
  key: string,
  value: T,
  version: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: PersistedShape<T> = { __version: version, data: value };
    await idbSet(key, payload);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

export async function safeDelete(key: string): Promise<void> {
  try {
    await idbDel(key);
  } catch {
    /* swallow — best-effort cleanup */
  }
}
