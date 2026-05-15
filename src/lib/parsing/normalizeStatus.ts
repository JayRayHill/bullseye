// Lost-deal detection. Under the close-date-driven classification, we only ever
// consult deal_status to distinguish lost from open — a "won" classification is
// determined by the presence of a parseable close date in normalizeRow.

const LOST_TOKENS = new Set([
  'lost',
  'closedlost',
  'closed lost',
  'lostdeal',
  'deadlost',
  'dead',
  'nogo',
]);

export function isLostStatus(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return false;
  const compact = value.replace(/[\s_\-]+/g, ' ').trim();
  const tight = compact.replace(/\s+/g, '');
  return LOST_TOKENS.has(compact) || LOST_TOKENS.has(tight);
}
