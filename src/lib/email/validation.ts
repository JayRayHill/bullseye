// Email format validation for the campaign pre-flight check. We're not
// trying to be RFC-5322 strict here — that regex is famously a page long
// and accepts plenty of strings that no mail server would actually deliver
// to. The goal is to flag the obvious garbage that sneaks in from CRM
// exports: empty cells masquerading as emails, leftovers like "info@",
// "no-email", "n/a", URLs pasted into the wrong column, etc.
//
// The regex below requires: local part (no spaces / @), an @, a domain
// label (no spaces / @), a literal dot, and a TLD label. That's the floor
// for anything Gmail or mailto: would accept.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Obvious "placeholder" patterns that pass the structural regex but are
// definitely not deliverable. Easy to extend if more patterns surface in
// real-world data.
const PLACEHOLDER_RE = /^(n\/a|none|noemail|no-email|unknown|n@a|test@test\.\w+)$/i;

export function isValidEmail(input: string | undefined | null): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (PLACEHOLDER_RE.test(trimmed)) return false;
  return EMAIL_RE.test(trimmed);
}
