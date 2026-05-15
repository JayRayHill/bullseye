// Shared type model. Imported by every layer; treat as the contract that locks
// parsing, persistence, and presentation together.

export type DealStatus = 'closed' | 'lost' | 'not_closed';

/** Raw row exactly as it came out of the file parser. Keys are the user's original headers. */
export type RawRow = Record<string, string>;

/** Canonical fields the app understands. Anything outside this list is preserved in `raw`. */
export type CanonicalField =
  | 'business_name'
  | 'zip'
  | 'deal_status'
  | 'deal_close_date'
  | 'contact_name'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'deal_value'
  | 'last_contact_date';

/** User-confirmed mapping from canonical field → header name in the uploaded file. */
export type ColumnMapping = Partial<Record<CanonicalField, string | null>>;

/** A normalized customer row, ready for the map and filters. */
export interface Customer {
  id: string;
  rowIndex: number;
  business_name: string;
  zip: string;
  deal_status: DealStatus;
  /** Parsed close date (ISO string) if the row had a parseable close-date value.
   *  Presence of this field is what classifies a row as 'closed'. */
  deal_close_date?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  deal_value?: number;
  last_contact_date?: string;
  /** Coordinates after deterministic same-zip jitter. */
  lat: number;
  lng: number;
  /** Full original cells keyed by original headers, including unrecognized columns. */
  raw: RawRow;
}

export type UploadErrorReason =
  | 'missing_business_name'
  | 'invalid_zip'
  | 'unknown_zip'
  | 'other';

export interface UploadError {
  rowIndex: number;
  reason: UploadErrorReason;
  message: string;
}

export interface DatasetTotals {
  closed: number;
  lost: number;
  notClosed: number;
  invalid: number;
}

export interface Dataset {
  customers: Customer[];
  totals: DatasetTotals;
  uploadedAt: string;
  sourceFilename: string;
  /** Original header order, used to render the "Additional fields" section consistently. */
  headers: string[];
}

export interface Filters {
  search: string;
  states: string[];
  statuses: DealStatus[];
  dealValueRange: [number | null, number | null];
  radiusMiles: number;
}

export interface PersistedShape<T> {
  __version: number;
  data: T;
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  states: [],
  statuses: [],
  dealValueRange: [null, null],
  radiusMiles: 50,
};
