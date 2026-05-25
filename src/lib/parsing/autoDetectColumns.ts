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

export function autoDetectColumns(headers: string[], rows: RawRow[] = []): ColumnMapping {
  const mapping: ColumnMapping = {};
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
    // name, period. Substring matches are LAST-RESORT only, because they're
    // too permissive ("First Name" substring-matches the alias 'name' for
    // business_name, "Contact owner" matches 'owner', etc.). We try exact
    // first, fall back to substring only when no exact matches exist at all.
    const exactMatches = normalized.filter((h) => aliasSet.has(h.norm));
    let candidates: typeof normalized;
    if (exactMatches.length > 0) {
      candidates = exactMatches;
    } else {
      candidates = normalized.filter((h) =>
        aliases.some((a) => h.norm.includes(a))
      );
    }

    if (candidates.length === 0) {
      mapping[field] = null;
      continue;
    }
    if (candidates.length === 1 || sample.length === 0) {
      mapping[field] = candidates[0].raw;
      continue;
    }
    // Multiple candidates of the SAME kind (all exact, or all substring) —
    // score each by how many of the sampled rows have a value, pick the
    // highest. Ties keep the earlier candidate (matches header order).
    // This is what saves us from HubSpot's duplicate "Postal Code" columns:
    // both exact-match, fill rate distinguishes the populated one.
    let bestRaw = candidates[0].raw;
    let bestFill = fillRate(bestRaw);
    for (let i = 1; i < candidates.length; i++) {
      const f = fillRate(candidates[i].raw);
      if (f > bestFill) {
        bestFill = f;
        bestRaw = candidates[i].raw;
      }
    }
    mapping[field] = bestRaw;
  }
  return mapping;
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
