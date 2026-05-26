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
  /** Breakdown of `invalid` by skip reason — surfaced in the upload summary
   *  so the rep can see at a glance WHY rows were dropped, not just how many.
   *  These three sum to `invalid` (each skipped row is counted once). */
  missingBusinessName: number;
  invalidZip: number;
  unknownZip: number;
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

// ---------------------------------------------------------------------------
// Phase 2: Outreach Campaign types
// ---------------------------------------------------------------------------

/** Rep settings persisted in IndexedDB. Used to fill {{rep_first_name}} and
 *  {{rep_signature}} merge fields in outbound campaign emails. */
export interface RepSettings {
  firstName: string;
  /** Free-text signature block. Newlines preserved verbatim in email body. */
  signature: string;
  /** Which template the drawer pre-selects. Defaults to the first template
   *  when empty. */
  defaultTemplateId: string;
}

export const DEFAULT_REP_SETTINGS: RepSettings = {
  firstName: '',
  signature: '',
  defaultTemplateId: 'warm-neighbor',
};

/** A baked-in email template the rep can pick from. Tokens like
 *  {{lead_first_name}} are resolved by fillMergeFields at render time. */
export interface EmailTemplate {
  id: string;
  /** Short display label for the template tab. */
  name: string;
  /** One-line description shown under the tab name. */
  blurb: string;
  subject: string;
  body: string;
}

/** Per-session campaign state. NOT persisted — campaigns are ephemeral. */
export interface CampaignState {
  selectedLeadIds: Set<string>;
  activeTemplateId: string;
  /** Optional overrides if the rep tweaked the template in the drawer. */
  customizedSubject: string | null;
  customizedBody: string | null;
}

/** Methods by which a rep can record having contacted a lead. The first two
 *  are auto-recorded when the campaign drawer fires; the rest are recorded
 *  via the "Mark contacted" UI on a lead row (for phone/text/in-person
 *  follow-ups that happen outside the email flow). */
export type SendMethod = 'gmail' | 'mailto' | 'phone' | 'text' | 'in_person' | 'other';

/** Persisted record that a given lead has been contacted. Used to hard-block
 *  re-contacting within the cooldown window. Identity is computed by
 *  leadIdentity(customer) — see src/lib/email/leadIdentity.ts.
 *
 *  Stored locally per-browser when Supabase isn't configured, or shared
 *  across the team via Supabase when configured. Same shape either way. */
export interface SentHistoryEntry {
  identity: string;
  /** ISO timestamp of when the contact happened. */
  emailedAt: string;
  /** Closed customer this lead was contacted about — for display in
   *  Settings. Optional for manual contacts (phone/text/in-person) where
   *  there's no anchor-driven campaign. */
  anchorCustomerName?: string;
  /** Lead's business name at the time of contact — for display in Settings. */
  leadBusinessName: string;
  /** Template id used at the time of contact. Empty for manual contacts. */
  templateId?: string;
  sendMethod: SendMethod;
  /** Name of the rep who recorded this contact, sourced from RepSettings.
   *  Required in team mode so the Settings → sent history view can show
   *  who did what. */
  recordedBy?: string;
}

/** Sent-history map, keyed by stable lead identity. Holds only the MOST
 *  RECENT entry per lead — older entries are dropped on insert/replace,
 *  since cooldown checks only care about the latest contact. */
export type SentHistory = Record<string, SentHistoryEntry>;
