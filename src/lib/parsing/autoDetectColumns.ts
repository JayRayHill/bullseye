// Auto-detect the column mapping for an uploaded file. For each canonical field
// we walk the list of aliases and return the first matching original header. Users
// can override the result in the mapping UI; this just makes the common case zero
// friction.

import type { CanonicalField, ColumnMapping } from '../../types';
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

export function autoDetectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const field of Object.keys(ALIASES) as CanonicalField[]) {
    const aliases = ALIASES[field].map(normalizeHeader);
    const aliasSet = new Set(aliases);
    // Prefer exact alias match in header order.
    const exact = normalized.find((h) => aliasSet.has(h.norm));
    if (exact) {
      mapping[field] = exact.raw;
      continue;
    }
    // Fallback: substring match (e.g. "Account Name (Primary)" → business_name).
    const contains = normalized.find((h) => aliases.some((a) => h.norm.includes(a)));
    if (contains) {
      mapping[field] = contains.raw;
    } else {
      mapping[field] = null;
    }
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
