// One-shot exporter: reads public/seed-data.xlsx, runs it through the
// same normalize + email-validation pipeline the app uses, and writes
// bullseye-email-list.xlsx with two sheets ("Closed customers", "Open
// deals") containing only rows that passed every filter:
//   - business name present
//   - 5-digit US zip
//   - email is structurally valid (not blank / not a placeholder like
//     "n/a", "info@", etc.) per src/lib/email/validation.ts
//
// Closed bucket = REAL LTV > 0. Open bucket = everything else.
//
// Run with: `node scripts/build-email-list.mjs`

import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(__dirname, '..', 'public', 'seed-data.xlsx');
const TARGET_XLSX = resolve(__dirname, '..', 'bullseye-email-list.xlsx');
const TARGET_CLOSED_CSV = resolve(__dirname, '..', 'bullseye-emails-closed.csv');
const TARGET_OPEN_CSV = resolve(__dirname, '..', 'bullseye-emails-open.csv');
const TARGET_ALL_CSV = resolve(__dirname, '..', 'bullseye-emails-all.csv');

// ---- Email validation (mirror of src/lib/email/validation.ts) ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_RE = /^(n\/a|none|noemail|no-email|unknown|n@a|test@test\.\w+)$/i;
function isValidEmail(input) {
  if (!input) return false;
  const t = String(input).trim();
  if (!t) return false;
  if (PLACEHOLDER_RE.test(t)) return false;
  return EMAIL_RE.test(t);
}

// ---- HubSpot-style dedupe of duplicate headers (same as parseXlsx) ----
function dedupeHeaders(headers) {
  const seen = new Map();
  return headers.map((h) => {
    if (!h) return h;
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h}_${count}`;
  });
}

// ---- Read the XLSX ----
const wb = XLSX.read(readFileSync(SOURCE), { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];
// First pass: get the raw header row + rows with formatted strings.
const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
const rawHeaders = aoa[0].map((h) => (h == null ? '' : String(h)));
const headers = dedupeHeaders(rawHeaders);
const dataRows = aoa.slice(1).map((row) => {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i] == null ? '' : String(row[i]);
  }
  return obj;
});

console.log(`Read ${dataRows.length} rows × ${headers.length} columns.`);

// ---- Identify the fields we need ----
// Mirror autoDetectColumns' alias logic, simplified — for the HubSpot
// seed file the field names are known. Includes per-row fallback for
// fields that have a primary + alternate column (e.g. contact-side vs
// company-side postal code).
function pickHeaders(predicates) {
  return headers.filter((h) =>
    predicates.some((p) => p.test(h.toLowerCase().replace(/[^a-z0-9]/g, '')))
  );
}
const bizHeaders = pickHeaders([
  /^companyname$/,
  /^accountname$/,
  /^businessname$/,
  /^associatedcompany$/,
  /^company$/,
]);
const zipHeaders = pickHeaders([/^postalcode/, /^zipcode/, /^zip$/, /^zip5/]);
const emailHeaders = pickHeaders([/^email$/, /^emailaddress/, /^contactemail/]);
const phoneHeaders = pickHeaders([/^phone/, /^mobile/, /^cell/]);
const contactHeaders = pickHeaders([
  /^contactname/,
  /^fullname/,
  /^primarycontact/,
  /^pointofcontact/,
]);
const firstNameHeaders = pickHeaders([/^firstname/]);
const lastNameHeaders = pickHeaders([/^lastname/]);
const cityHeaders = pickHeaders([/^city$/, /^town$/, /^locality$/]);
const stateHeaders = pickHeaders([/^state$/, /^region$/, /^province$/]);
const ltvHeaders = headers.filter((h) => /real\s*ltv/i.test(h));

console.log('Field → column(s):');
console.log(`  business: ${bizHeaders.join(' | ')}`);
console.log(`  zip:      ${zipHeaders.join(' | ')}`);
console.log(`  email:    ${emailHeaders.join(' | ')}`);
console.log(`  phone:    ${phoneHeaders.join(' | ')}`);
console.log(`  contact:  ${contactHeaders.join(' | ') || '—'}`);
console.log(`  city:     ${cityHeaders.join(' | ')}`);
console.log(`  state:    ${stateHeaders.join(' | ')}`);
console.log(`  ltv:      ${ltvHeaders.join(' | ')}`);

// ---- Helpers ----
function readField(row, headerList) {
  for (const h of headerList) {
    const v = row[h];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}
function readFieldNoFallback(row, headerList) {
  // For deal_value (REAL LTV) we intentionally only honor the primary
  // mapped column — matches the app's NO_FALLBACK_FIELDS rule.
  if (headerList.length === 0) return '';
  const v = row[headerList[0]];
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}
function cleanZip(s) {
  if (!s) return null;
  const d = String(s).replace(/[^0-9]/g, '');
  if (!d) return null;
  if (d.length === 5) return d;
  if (d.length === 3 || d.length === 4) return d.padStart(5, '0');
  if (d.length === 9) return d.slice(0, 5);
  return null;
}
function parseDealValue(s) {
  const cleaned = String(s).replace(/[$,\s]/g, '');
  if (!cleaned) return undefined;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
function buildContactName(row) {
  const direct = readField(row, contactHeaders);
  if (direct) return direct;
  const first = readField(row, firstNameHeaders);
  const last = readField(row, lastNameHeaders);
  return [first, last].filter(Boolean).join(' ').trim();
}

// ---- Normalize ----
const closed = [];
const open = [];
let skippedNoBiz = 0;
let skippedBadZip = 0;
let skippedNoEmail = 0;

for (const row of dataRows) {
  const businessName = readField(row, bizHeaders);
  if (!businessName) { skippedNoBiz++; continue; }
  const zip = cleanZip(readField(row, zipHeaders));
  if (!zip) { skippedBadZip++; continue; }

  // Apply the email validation gate — only "passable" rows make the cut.
  const email = readField(row, emailHeaders);
  if (!isValidEmail(email)) { skippedNoEmail++; continue; }

  const ltvRaw = readFieldNoFallback(row, ltvHeaders);
  const ltv = parseDealValue(ltvRaw);
  const isClosed = ltv !== undefined && ltv > 0;

  const record = {
    'Business name': businessName,
    'Contact name': buildContactName(row),
    'Email': email.trim(),
    'Phone': readField(row, phoneHeaders),
    'City': readField(row, cityHeaders),
    'State': readField(row, stateHeaders).toUpperCase().slice(0, 2),
    'Zip': zip,
  };
  if (isClosed) {
    closed.push({ ...record, 'REAL LTV': ltv });
  } else {
    open.push(record);
  }
}

console.log('\nResult:');
console.log(`  Closed with valid email: ${closed.length}`);
console.log(`  Open with valid email:   ${open.length}`);
console.log(`  Skipped — no biz name:   ${skippedNoBiz}`);
console.log(`  Skipped — bad zip:       ${skippedBadZip}`);
console.log(`  Skipped — no valid email: ${skippedNoEmail}`);

// ---- Write XLSX (two sheets, for use in Excel / Sheets) ----
const outBook = XLSX.utils.book_new();
const closedSheet = XLSX.utils.json_to_sheet(closed);
const openSheet = XLSX.utils.json_to_sheet(open);
XLSX.utils.book_append_sheet(outBook, closedSheet, 'Closed customers');
XLSX.utils.book_append_sheet(outBook, openSheet, 'Open deals');
writeFileSync(TARGET_XLSX, XLSX.write(outBook, { type: 'buffer', bookType: 'xlsx' }));

// ---- Write CSVs (more portable; verification services + mail-merge tools
// almost always prefer CSV). We use SheetJS's CSV writer so the
// quoting/escaping is correct, but a CSV is just text — no XML, nothing
// for a strict third-party parser to choke on. ----
writeFileSync(TARGET_CLOSED_CSV, XLSX.utils.sheet_to_csv(closedSheet));
writeFileSync(TARGET_OPEN_CSV, XLSX.utils.sheet_to_csv(openSheet));
// Single email-only CSV (one column, one address per line) for batch
// email verification tools like MillionVerifier, NeverBounce, ZeroBounce
// etc., which often want exactly one column with no header noise.
const allEmails = [...closed, ...open].map((r) => r.Email);
writeFileSync(TARGET_ALL_CSV, 'email\n' + allEmails.join('\n') + '\n');

console.log(`\nWrote:`);
console.log(`  XLSX (two sheets):     ${TARGET_XLSX}`);
console.log(`  CSV closed customers:  ${TARGET_CLOSED_CSV}`);
console.log(`  CSV open deals:        ${TARGET_OPEN_CSV}`);
console.log(`  CSV all emails (1 col): ${TARGET_ALL_CSV}`);
