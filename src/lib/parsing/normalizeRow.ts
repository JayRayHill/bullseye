// Turns raw parsed rows (string-keyed by original headers) into the normalized
// Customer objects the map and filters consume. Every validation failure is
// captured as an UploadError; the user sees aggregate counts and (optionally) a
// list of the first N skipped rows in the upload summary.
//
// Deal classification (new rules):
//   1. Row has a parseable deal_close_date → 'closed' (won)
//   2. Else deal_status normalizes to 'lost' → 'lost'
//   3. Else                                  → 'not_closed' (open lead)
// deal_status is optional. If absent, rows without a close date default to lead.

import type {
  ColumnMapping,
  Customer,
  Dataset,
  DealStatus,
  RawRow,
  UploadError,
} from '../../types';
import type { ZipCoordMap } from '../../hooks/useZipCoords';
import { jitterCoord } from '../geo/jitterCoord';
import { isLostStatus } from './normalizeStatus';
import { stableHash } from '../../utils/fuzzyMatch';

function readField(row: RawRow, mapping: ColumnMapping, key: keyof ColumnMapping): string {
  const header = mapping[key];
  if (!header) return '';
  return (row[header] ?? '').toString();
}

function cleanZip(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, '');
  if (!digits) return null;
  if (digits.length === 5) return digits;
  if (digits.length === 4 || digits.length === 3) return digits.padStart(5, '0');
  if (digits.length === 9) return digits.slice(0, 5);
  return null;
}

function parseDealValue(input: string): number | undefined {
  if (!input) return undefined;
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!cleaned) return undefined;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Parse a free-form date. Returns ISO string if Date can parse it; original
 *  string if not; undefined if the cell is empty/whitespace. */
function parseDate(input: string): { iso?: string; raw?: string } {
  if (!input) return {};
  const trimmed = input.trim();
  if (!trimmed) return {};
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return { raw: trimmed };
  return { iso: d.toISOString(), raw: trimmed };
}

export interface NormalizeResult {
  dataset: Dataset;
  errors: UploadError[];
}

export function normalizeRows(
  rows: RawRow[],
  headers: string[],
  mapping: ColumnMapping,
  zipCoords: ZipCoordMap,
  sourceFilename: string
): NormalizeResult {
  const customers: Customer[] = [];
  const errors: UploadError[] = [];
  const sameZipCounter = new Map<string, number>();
  let closed = 0;
  let lost = 0;
  let notClosed = 0;

  rows.forEach((row, rowIndex) => {
    const businessName = readField(row, mapping, 'business_name').trim();
    if (!businessName) {
      errors.push({
        rowIndex,
        reason: 'missing_business_name',
        message: 'Business name is empty.',
      });
      return;
    }

    const rawZip = readField(row, mapping, 'zip');
    const zip = cleanZip(rawZip);
    if (!zip) {
      errors.push({
        rowIndex,
        reason: 'invalid_zip',
        message: `Zip "${rawZip}" is not a 5-digit US zip code.`,
      });
      return;
    }
    const coord = zipCoords[zip];
    if (!coord) {
      errors.push({
        rowIndex,
        reason: 'unknown_zip',
        message: `Zip "${zip}" is not in the US zip database.`,
      });
      return;
    }

    // Classification: close date wins, then lost flag, else open lead.
    const closeDateParsed = parseDate(readField(row, mapping, 'deal_close_date'));
    const rawStatus = readField(row, mapping, 'deal_status');
    let status: DealStatus;
    if (closeDateParsed.iso || closeDateParsed.raw) {
      // Any non-empty close-date value counts as "won" even if unparseable —
      // the presence of a date is the signal, parsing failures shouldn't downgrade.
      status = 'closed';
    } else if (isLostStatus(rawStatus)) {
      status = 'lost';
    } else {
      status = 'not_closed';
    }

    const occurrence = sameZipCounter.get(zip) ?? 0;
    const [lat, lng] = jitterCoord(coord[0], coord[1], occurrence);
    sameZipCounter.set(zip, occurrence + 1);

    const dealValue = parseDealValue(readField(row, mapping, 'deal_value'));
    const state = readField(row, mapping, 'state').trim().toUpperCase().slice(0, 2) || undefined;
    const city = readField(row, mapping, 'city').trim() || undefined;
    const contactName = readField(row, mapping, 'contact_name').trim() || undefined;
    const email = readField(row, mapping, 'email').trim() || undefined;
    const phone = readField(row, mapping, 'phone').trim() || undefined;
    const address = readField(row, mapping, 'address').trim() || undefined;
    const lastContact = parseDate(readField(row, mapping, 'last_contact_date'));

    const id = stableHash(`${rowIndex}|${zip}|${businessName.toLowerCase()}`);

    customers.push({
      id,
      rowIndex,
      business_name: businessName,
      zip,
      deal_status: status,
      deal_close_date: closeDateParsed.iso ?? closeDateParsed.raw,
      contact_name: contactName,
      email,
      phone,
      address,
      city,
      state,
      deal_value: dealValue,
      last_contact_date: lastContact.iso ?? lastContact.raw,
      lat,
      lng,
      raw: row,
    });

    if (status === 'closed') closed += 1;
    else if (status === 'lost') lost += 1;
    else notClosed += 1;
  });

  return {
    dataset: {
      customers,
      totals: { closed, lost, notClosed, invalid: errors.length },
      uploadedAt: new Date().toISOString(),
      sourceFilename,
      headers,
    },
    errors,
  };
}
