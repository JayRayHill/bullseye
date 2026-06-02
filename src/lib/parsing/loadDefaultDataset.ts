// Load the bundled seed dataset (public/seed-data.xlsx) without going
// through the upload dropzone or the column-mapping form. Used by the
// empty state's "Use default dataset" CTA so SDRs can get straight into
// the app without dealing with the upload + mapping ritual.
//
// Pipeline: fetch the bundled XLSX → wrap in a File so the existing
// parseXlsxFile + autoDetectColumns + normalizeRows pipeline runs
// untouched → return the final Dataset and any per-row errors.
//
// Auto-detect handles HubSpot's standard column names well (we've
// tuned it on this exact file), so we skip the mapping confirmation
// step entirely. If a rep later needs to remap, they can replace the
// file and the upload flow shows the mapping form as usual.

import type { Dataset, UploadError } from '../../types';
import { parseXlsxFile } from './parseXlsx';
import { autoDetectColumns } from './autoDetectColumns';
import { normalizeRows } from './normalizeRow';
import { loadZipCoords } from '../../hooks/useZipCoords';
import { loadVerifiedEmails } from '../../hooks/useVerifiedEmails';

const SEED_URL = '/seed-data.xlsx';
const SEED_FILENAME = 'Bullseye Customer List.xlsx';

export interface LoadDefaultResult {
  dataset: Dataset;
  errors: UploadError[];
}

export async function loadDefaultDataset(): Promise<LoadDefaultResult> {
  // Fetch the bundled XLSX. Vercel/static hosts serve this with
  // long-lived caching headers, so re-clicks within a session are
  // effectively free.
  const response = await fetch(SEED_URL);
  if (!response.ok) {
    throw new Error(
      `Could not load the default dataset (${response.status}). Try uploading your own file instead.`
    );
  }
  const blob = await response.blob();
  // Wrap as a File so parseXlsxFile (which takes a File) works
  // unchanged. The filename here is what the rep sees in the header
  // "from <filename>" line.
  const file = new File([blob], SEED_FILENAME, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // Same pipeline as the upload flow: parse → auto-detect → normalize.
  // Zip coords + verified-email set loaded in parallel with parsing so the
  // normalize step doesn't block on either network fetch. The verified-email
  // set is only applied to this seed-data flow — custom uploads don't run
  // through MillionVerifier so they pass undefined and skip the gate.
  const [parsed, coords, verifiedEmails] = await Promise.all([
    parseXlsxFile(file),
    loadZipCoords(),
    loadVerifiedEmails(),
  ]);
  if (!parsed.headers.length || !parsed.rows.length) {
    throw new Error('The default file is empty or has no header row.');
  }
  const { mapping, alternates } = autoDetectColumns(parsed.headers, parsed.rows);
  const { dataset, errors } = normalizeRows(
    parsed.rows,
    parsed.headers,
    mapping,
    coords,
    SEED_FILENAME,
    alternates,
    verifiedEmails
  );
  return { dataset, errors };
}
