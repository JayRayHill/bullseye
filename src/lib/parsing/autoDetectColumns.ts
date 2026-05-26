// Auto-detect the column mapping for an uploaded file. For each canonical field
// we walk the list of aliases and find candidate headers. When the uploaded
// data has multiple columns matching the same alias set (common in HubSpot
// CRM exports that join contact ↔ company — "Postal Code" + "Postal Code_1",
// "Company Name" + "Company name", etc.), we sample a few hundred rows and
// pick the column with the highest fill rate. Otherwise users see rows
// silently skipped because auto-detect picked the mostly-empty column.

import type { CanonicalField, ColumnMapping, RawRow } from '../../types';
import { normalizeHeader } from '../../utils/fuzzyMatch';

const ALIASES: Record<CanonicalField, string[]> = {
  business_name: [
    'businessname',
    'companyname',
    'accountname',
    'customer',
    'customername',
    'company',
    'account',
    'name',
    'client',
    'clientname',
    'organization',
    'org',
  ],
  zip: ['zip', 'zipcode', 'postalcode', 'postcode', 'zip5', 'postal'],
  deal_status: [
    'dealstatus',
    'status',
    'stage',
    'pipeline',
    'dealstage',
    'opportunitystatus',
    'state',
  ],
  deal_close_date: [
    'dealclosedate',
    'closedate',
    'closeddate',
    'wondate',
    'datewon',
    'dateclosed',
    'closingdate',
    'recentdealclosedate',
    'recentclosedate',
    'lastclosedate',
    'mostrecentclosedate',
  ],
  contact_name: [
    'contactname',
    'contact',
    'primarycontact',
    'fullname',
    'person',
    'pointofcontact',
  ],
  email: ['email', 'emailaddress', 'contactemail', 'mail'],
  phone: ['phone', 'phonenumber', 'telephone', 'mobile', 'cell'],
  address: ['address', 'streetaddress', 'street', 'addressline1', 'address1'],
  city: ['city', 'town', 'locality'],
  state: ['state', 'stateprovince', 'region', 'st', 'province'],
  deal_value: [
    'dealvalue',
    'amount',
    'value',
    'totalvalue',
    'revenue',
    'price',
    'arr',
    'mrr',
    'contractvalue',
    // LTV-style aliases — a positive value here also flags the row as closed
    // (see normalizeRow.ts).
    'ltv',
    'realltv',
    'lifetimevalue',
    'reallifetimevalue',
    'customerltv',
  ],
  last_contact_date: [
    'lastcontact',
    'lastcontacted',
    'lastcontactdate',
    'lastactivity',
    'lastactivitydate',
    'contactdate',
    'updatedat',
  ],
};

// Number of rows we look at when scoring candidate columns by fill rate.
// 200 is more than enough to distinguish a mostly-empty column from a
// mostly-populated one, even on huge exports.
const FILL_RATE_SAMPLE = 200;

/** Per-field list of secondary candidate columns, ranked by fill rate after
 *  the primary winner. normalizeRow tries each in order if the primary is
 *  empty for a specific row — major win for HubSpot's contact-vs-company
 *  joined exports where the company-side column might have data the
 *  contact-side column doesn't. */
export type ColumnAlternates = Partial<Record<CanonicalField, string[]>>;

export interface AutoDetectResult {
  mapping: ColumnMapping;
  alternates: ColumnAlternates;
}

export function autoDetectColumns(
  headers: string[],
  rows: RawRow[] = []
): AutoDetectResult {
  const mapping: ColumnMapping = {};
  const alternates: ColumnAlternates = {};
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  // Sample once and reuse across all fields.
  const sample = rows.slice(0, Math.min(FILL_RATE_SAMPLE, rows.length));

  /** Count non-empty values for a given header across the sample. */
  const fillRate = (header: string): number => {
    if (sample.length === 0) return 0;
    let count = 0;
    for (const row of sample) {
      const v = row[header];
      if (v != null && String(v).trim() !== '') count++;
    }
    return count;
  };

  for (const field of Object.keys(ALIASES) as CanonicalField[]) {
    const aliases = ALIASES[field].map(normalizeHeader);
    const aliasSet = new Set(aliases);

    // Exact matches are semantically reliable — "Company Name" means business
    // name, period.
    const exactMatches = normalized.filter((h) => aliasSet.has(h.norm));

    // Strong substring matches: the alias accounts for ≥70% of the header.
    // This catches HubSpot's dedupe-suffixed duplicates like "Postal Code_1"
    // (alias 'postalcode' is 10 of 11 chars = 91% — strong) without dragging
    // in noise like "First Name" or "Last Name" matching alias 'name'
    // (4 of 9 chars = 44% — weak, rejected).
    const strongSubstring = normalized.filter((h) => {
      if (aliasSet.has(h.norm)) return false; // already covered by exact
      return aliases.some(
        (a) => h.norm.includes(a) && a.length / h.norm.length >= 0.7
      );
    });

    // Weak substring matches: last-resort, only used when no exact matches
    // exist. Keeps the old "Account Name (Primary)" → business_name behavior
    // for files that don't have a clean exact match anywhere.
    const weakSubstring =
      exactMatches.length === 0 && strongSubstring.length === 0
        ? normalized.filter((h) =>
            aliases.some((a) => h.norm.includes(a))
          )
        : [];

    // Build the candidate pool: exact first, then strong substring (dedupe
    // suffixes), then weak substring (legacy fallback).
    const candidates = [...exactMatches, ...strongSubstring, ...weakSubstring];

    if (candidates.length === 0) {
      mapping[field] = null;
      continue;
    }
    if (candidates.length === 1 || sample.length === 0) {
      mapping[field] = candidates[0].raw;
      continue;
    }

    // Rank by fill rate. Exact matches still tend to win the primary slot
    // because they typically have the most populated data — but if a
    // dedupe-suffixed duplicate is more populated for any given row, we'll
    // fall back to it in normalizeRow.
    const ranked = candidates
      .map((c) => ({ raw: c.raw, fill: fillRate(c.raw) }))
      .sort((a, b) => b.fill - a.fill);
    mapping[field] = ranked[0].raw;
    const fallbacks = ranked
      .slice(1)
      .filter((c) => c.fill > 0) // skip alternates with literally zero data
      .map((c) => c.raw);
    if (fallbacks.length > 0) alternates[field] = fallbacks;
  }
  return { mapping, alternates };
}

// Only business_name + zip are required. Whether a deal is "closed" is determined
// by the presence of a parseable deal_close_date; deal_status is consulted only
// to distinguish lost from open when no close date is present. Both are optional.
export const REQUIRED_FIELDS: CanonicalField[] = ['business_name', 'zip'];
export const OPTIONAL_FIELDS: CanonicalField[] = [
  'deal_close_date',
  'deal_status',
  'contact_name',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'deal_value',
  'last_contact_date',
];
