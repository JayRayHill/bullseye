// CSV parser thin-wrapper around PapaParse. We use a Web Worker (`worker: true`)
// so large files do not jank the UI thread. Headers are kept verbatim (no toLowerCase)
// because we need to match them against the user's mapping later.

import Papa from 'papaparse';
import type { RawRow } from '../../types';

export interface CsvParseResult {
  headers: string[];
  rows: RawRow[];
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      worker: true,
      complete: (result) => {
        const headers = (result.meta.fields ?? []).filter((h) => h !== '');
        const rows = result.data
          .filter((r): r is RawRow => r !== null && typeof r === 'object')
          .map((r) => {
            // PapaParse may set undefined cells; normalize to empty strings so
            // downstream readers can treat values uniformly.
            const out: RawRow = {};
            for (const h of headers) {
              const v = (r as Record<string, unknown>)[h];
              out[h] = v == null ? '' : String(v);
            }
            return out;
          });
        resolve({ headers, rows });
      },
      error: (err) => reject(err),
    });
  });
}

/** Parse a CSV string (e.g. fetched sample data) using the same configuration. */
export function parseCsvString(text: string): CsvParseResult {
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
  });
  const headers = (result.meta.fields ?? []).filter((h) => h !== '');
  const rows = result.data
    .filter((r): r is RawRow => r !== null && typeof r === 'object')
    .map((r) => {
      const out: RawRow = {};
      for (const h of headers) {
        const v = (r as Record<string, unknown>)[h];
        out[h] = v == null ? '' : String(v);
      }
      return out;
    });
  return { headers, rows };
}
