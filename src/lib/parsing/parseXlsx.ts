// XLSX parsing via SheetJS. We force `raw: false` so cells come back as formatted
// strings — uniform with the CSV path, and avoiding the divergence between Date
// objects and strings that SheetJS would otherwise return for date-typed cells.
//
// SheetJS is ~700 KB; lazy-loading it keeps the initial bundle small for users
// who only ever upload CSVs (the common case).

import type { RawRow } from '../../types';
import type { CsvParseResult } from './parseCsv';

/** Disambiguate duplicate header strings by suffixing the 2nd, 3rd, … occurrence
 *  with `_1`, `_2`, etc. — matches PapaParse's CSV behavior. HubSpot exports
 *  routinely have duplicate column names ("Postal Code" appearing twice: once
 *  for the contact, once for the company), and without this our row-builder
 *  would overwrite earlier values when the later column is empty. */
function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    if (!h) return h;
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h}_${count}`;
  });
}

export async function parseXlsxFile(file: File): Promise<CsvParseResult> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const sheet = wb.Sheets[sheetName];
  // header: 1 returns array-of-arrays so we can grab headers verbatim.
  // We then suffix duplicates ourselves (vs. relying on sheet_to_json's
  // header:true behavior) so the exact-vs-suffixed semantics are consistent
  // with the CSV path.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  if (aoa.length === 0) return { headers: [], rows: [] };
  const rawHeaders = aoa[0].map((h) => (h == null ? '' : String(h)));
  const headers = dedupeHeaders(rawHeaders);
  const rows: RawRow[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    const obj: RawRow = {};
    headers.forEach((h, j) => {
      if (!h) return;
      const v = row[j];
      obj[h] = v == null ? '' : String(v);
    });
    // Skip rows that are fully empty (every recognized header is blank).
    if (headers.some((h) => obj[h] && obj[h].trim() !== '')) {
      rows.push(obj);
    }
  }
  return { headers: headers.filter((h) => h !== ''), rows };
}
