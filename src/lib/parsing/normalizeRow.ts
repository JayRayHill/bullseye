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
  CanonicalField,
  ColumnMapping,
  Customer,
  Dataset,
  DealStatus,
  RawRow,
  UploadError,
} from '../../types';
import type { ZipCoordMap } from '../../hooks/useZipCoords';
import type { ColumnAlternates } from './autoDetectColumns';
import { jitterCoord } from '../geo/jitterCoord';
import { stableHash } from '../../utils/fuzzyMatch';

/** Read a field from a row using the primary mapped column first; if that
 *  cell is empty, fall back through the alternates (in priority order). This
 *  recovers values when a HubSpot contact-side column is empty but the
 *  company-side column has the data, without affecting rows where the
 *  primary column has its expected value.
 *
 *  IMPORTANT: deal_value is excluded from the per-row fallback. REAL LTV is
 *  the user's authoritative closed-deal signal — and HubSpot exports often
 *  carry several "amount"/"value"/"revenue" columns alongside it that are
 *  forecasted figures on OPEN deals, not closed-deal LTV. Letting the
 *  fallback pick those up inflated the closed count by ~300 in real-world
 *  data. For deal_value we honor only the explicitly mapped column. */
const NO_FALLBACK_FIELDS = new Set<CanonicalField>(['deal_value']);

function readField(
  row: RawRow,
  mapping: ColumnMapping,
  alternates: ColumnAlternates | undefined,
  key: CanonicalField
): string {
  const primary = mapping[key];
  if (primary) {
    const v = row[primary];
    if (v != null && String(v).trim() !== '') return String(v);
  }
  if (NO_FALLBACK_FIELDS.has(key)) return '';
  const alts = alternates?.[key];
  if (alts) {
    for (const alt of alts) {
      const v = row[alt];
      if (v != null && String(v).trim() !== '') return String(v);
    }
  }
  return '';
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
  sourceFilename: string,
  alternates?: ColumnAlternates
): NormalizeResult {
  const customers: Customer[] = [];
  const errors: UploadError[] = [];
  const sameZipCounter = new Map<string, number>();
  let closed = 0;
  let lost = 0;
  let notClosed = 0;
  // Categorical skip counters so the upload summary can show WHY rows got
  // dropped, not just how many. Survives reloads because they live on
  // dataset.totals (which is persisted to IndexedDB).
  let missingBusinessName = 0;
  let invalidZip = 0;
  let unknownZip = 0;

  rows.forEach((row, rowIndex) => {
    const businessName = readField(row, mapping, alternates, 'business_name').trim();
    if (!businessName) {
      missingBusinessName += 1;
      errors.push({
        rowIndex,
        reason: 'missing_business_name',
        message: 'Business name is empty.',
      });
      return;
    }

    const rawZip = readField(row, mapping, alternates, 'zip');
    const zip = cleanZip(rawZip);
    if (!zip) {
      invalidZip += 1;
      errors.push({
        rowIndex,
        reason: 'invalid_zip',
        message: `Zip "${rawZip}" is not a 5-digit US zip code.`,
      });
      return;
    }
    const coord = zipCoords[zip];
    if (!coord) {
      unknownZip += 1;
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
    const dealValue = parseDealValue(readField(row, mapping, alternates, 'deal_value'));
    const closeDateParsed = parseDate(readField(row, mapping, alternates, 'deal_close_date'));

    // Binary classification: has REAL LTV → closed, else open deal.
    const hasPositiveLTV = dealValue !== undefined && dealValue > 0;
    const status: DealStatus = hasPositiveLTV ? 'closed' : 'not_closed';

    const occurrence = sameZipCounter.get(zip) ?? 0;
    const [lat, lng] = jitterCoord(coord[0], coord[1], occurrence);
    sameZipCounter.set(zip, occurrence + 1);
    // State source-of-truth: the zip code's canonical state (third element
    // of the coord tuple). HubSpot exports often have a separately-mapped
    // "State" column that holds the contact's state of residence, while
    // the zip belongs to the company's billing address — they don't always
    // agree (e.g. an Idaho contact attached to a Phoenix AZ company). The
    // map pins from the zip, so the displayed state should match the pin.
    // Fall back to the CSV column for the small handful of zips outside
    // the prefix table (military APO/FPO, edge territories).
    const zipState = coord[2];
    const mappedState = readField(row, mapping, alternates, 'state').trim().toUpperCase().slice(0, 2) || undefined;
    const state = zipState ?? mappedState;
    const city = readField(row, mapping, alternates, 'city').trim() || undefined;
    const contactName = readField(row, mapping, alternates, 'contact_name').trim() || undefined;
    const email = readField(row, mapping, alternates, 'email').trim() || undefined;
    const phone = readField(row, mapping, alternates, 'phone').trim() || undefined;
    const address = readField(row, mapping, alternates, 'address').trim() || undefined;
    const lastContact = parseDate(readField(row, mapping, alternates, 'last_contact_date'));

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
      totals: {
        closed,
        lost,
        notClosed,
        invalid: errors.length,
        missingBusinessName,
        invalidZip,
        unknownZip,
      },
      uploadedAt: new Date().toISOString(),
      sourceFilename,
      headers,
    },
    errors,
  };
}
