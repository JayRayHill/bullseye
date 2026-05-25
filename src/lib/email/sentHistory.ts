// Cooldown rules for the sent-history dedup. Kept here (not in settings) so
// the constant is a single source of truth; the UI imports the formatted
// "30 days" text rather than hardcoding it twice.

import type { SentHistoryEntry } from '../../types';

export const SENT_COOLDOWN_DAYS = 30;
export const SENT_COOLDOWN_MS = SENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

/** Has this lead been emailed within the cooldown window? */
export function isInCooldown(entry: SentHistoryEntry, now: number = Date.now()): boolean {
  return now - new Date(entry.emailedAt).getTime() < SENT_COOLDOWN_MS;
}

/** Whole days since the given ISO timestamp. Floor — "0d" for sub-24h. */
export function daysSince(iso: string, now: number = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

/** When does the cooldown end for this entry? Returns a Date. */
export function cooldownExpiry(entry: SentHistoryEntry): Date {
  return new Date(new Date(entry.emailedAt).getTime() + SENT_COOLDOWN_MS);
}
