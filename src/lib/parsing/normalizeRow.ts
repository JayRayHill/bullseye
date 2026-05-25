// Turns raw parsed rows (string-keyed by original headers) into the normalized
// Customer objects the map and filters consume. Every validation failure is
// captured as an UploadError; the user sees aggregate counts and (optionally) a
// list of the first N skipped rows in the upload summary.
//
// Deal classification — binary rule:
//   - Row has a positive deal_value / REAL LTV → 'closed' (won customer)
//   - Else                                     → 'not_closed' (open deal —
//     a form fill / prospect we haven't converted yet)
//
// deal_close_date is still parsed and displayed in the detail panel, but it
// does NOT drive classification — too unreliable in real CRM exports.
//
// The 'lost' status is retained in the type system so historical data with
// explicit lost markings can still be represented if a future classifier
// change brings it back, but no rule here currently produces 'lost'.

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

    // Read classification signals up front. Only deal_value drives status;
    // close date and deal_status are parsed for display in the detail panel
    // but don't change the pin color.
    const dealValue = parseDealValue(readField(row, mapping, 'deal_value'));
    const closeDateParsed = parseDate(readField(row, mapping, 'deal_close_date'));

    // Binary classification: has REAL LTV → closed, else open deal.
    const hasPositiveLTV = dealValue !== undefined && dealValue > 0;
    const status: DealStatus = hasPositiveLTV ? 'closed' : 'not_closed';

    const occurrence = sameZipCounter.get(zip) ?? 0;
    const [lat, lng] = jitterCoord(coord[0], coord[1], occurrence);
    sameZipCounter.set(zip, occurrence + 1);
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
    else notClosed += 1;
    // `lost` counter intentionally left at 0 — current classifier never
    // produces 'lost'. Retained on the type so future rules can.
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
