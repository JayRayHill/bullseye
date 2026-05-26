// Token replacement for the campaign templates. Kept intentionally dumb:
// a flat object → String.replaceAll loop. No template engine, no expressions.
//
// Two render modes:
//   - perLead (default): every {{lead_*}} token is filled from the specific lead
//   - genericLead:        {{lead_*}} tokens collapse to generic phrasing for the
//                         Gmail BCC batch send, where one body goes to all recipients
//
// Pipeline order per call:
//   1. applySpintax  — resolve `{a|b|c}` random-choice blocks (deterministic
//                      per-seed; see spintax.ts). Done first so merge values
//                      can never be mis-parsed as spintax.
//   2. fill          — replace `{{merge_field}}` tokens with their values.

import type { Customer, RepSettings } from '../../types';
import { applySpintax } from './spintax';
import { leadIdentity } from './leadIdentity';

export type MergeMode = 'perLead' | 'genericLead';

export interface MergeContext {
  /** The lead to personalize for (perLead mode). Ignored in genericLead mode. */
  lead: Customer;
  /** The closed customer being used as the social-proof anchor. */
  anchor: Customer;
  /** Distance from anchor to lead, in miles. */
  distanceMiles: number;
  /** Rep settings supplying {{rep_first_name}} and {{rep_signature}}. */
  settings: RepSettings;
  /** How to handle lead-specific tokens. */
  mode?: MergeMode;
}

function firstName(fullName: string | undefined): string {
  if (!fullName) return 'there';
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

function buildMap(ctx: MergeContext): Record<string, string> {
  const mode = ctx.mode ?? 'perLead';
  const leadBusiness = mode === 'perLead' ? ctx.lead.business_name : 'your business';
  const leadFirst = mode === 'perLead' ? firstName(ctx.lead.contact_name) : 'there';
  const miles = Math.max(1, Math.round(ctx.distanceMiles));
  return {
    '{{lead_first_name}}': leadFirst,
    '{{lead_business}}': leadBusiness,
    '{{nearby_customer}}': ctx.anchor.business_name,
    '{{nearby_customer_city}}': ctx.anchor.city ?? 'nearby',
    '{{nearby_customer_state}}': ctx.anchor.state ?? '',
    // Raw number — kept for backward compat with any rep-customized
    // templates that hardcode " miles" after it.
    '{{distance}}': String(miles),
    // Full phrase with correct singular/plural. New templates should
    // prefer this so "1 miles" can never happen.
    '{{distance_phrase}}': miles === 1 ? '1 mile' : `${miles} miles`,
    '{{rep_first_name}}': ctx.settings.firstName || 'your sales rep',
    '{{rep_signature}}': ctx.settings.signature || '— Sales Team',
  };
}

function fill(text: string, map: Record<string, string>): string {
  let out = text;
  for (const [token, value] of Object.entries(map)) {
    out = out.split(token).join(value);
  }
  return out;
}

export interface FilledEmail {
  subject: string;
  body: string;
}

/** Spintax seed: lead identity in perLead mode (different lead → different
 *  body in a batch), anchor id in genericLead mode (one body per Gmail
 *  BCC batch but stable across previews of the same anchor). */
function spintaxSeed(ctx: MergeContext): string {
  if ((ctx.mode ?? 'perLead') === 'perLead') return leadIdentity(ctx.lead);
  return ctx.anchor.id;
}

/** Apply spintax (deterministic per-seed) THEN merge fields. */
export function fillMergeFields(
  template: { subject: string; body: string },
  ctx: MergeContext
): FilledEmail {
  const seed = spintaxSeed(ctx);
  const spunSubject = applySpintax(template.subject, seed);
  const spunBody = applySpintax(template.body, seed);
  const map = buildMap(ctx);
  return {
    subject: fill(spunSubject, map),
    body: fill(spunBody, map),
  };
}
