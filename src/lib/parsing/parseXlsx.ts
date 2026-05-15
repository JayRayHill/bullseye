// XLSX parsing via SheetJS. We force `raw: false` so cells come back as formatted
// strings — uniform with the CSV path, and avoiding the divergence between Date
// objects and strings that SheetJS would otherwise return for date-typed cells.
//
// SheetJS is ~700 KB; lazy-loading it keeps the initial bundle small for users
// who only ever upload CSVs (the common case).

import type { RawRow } from '../../types';
import type { CsvParseResult } from './parseCsv';

export async function parseXlsxFile(file: File): Promise<CsvParseResult> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const sheet = wb.Sheets[sheetName];
  // header: 1 returns array-of-arrays so we can grab headers verbatim, including
  // duplicates and whitespace — XLSX.utils.sheet_to_json with header: true would
  // silently rename duplicate headers, breaking the user's mapping.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  if (aoa.length === 0) return { headers: [], rows: [] };
  const headers = aoa[0].map((h) => (h == null ? '' : String(h)));
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
