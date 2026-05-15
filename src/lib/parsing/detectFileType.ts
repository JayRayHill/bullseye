export type FileKind = 'csv' | 'xlsx' | 'unknown';

export function detectFileType(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.xlsx')) return 'xlsx';
  // MIME fallback — Excel often labels CSV as application/vnd.ms-excel.
  if (file.type === 'text/csv' || file.type === 'application/vnd.ms-excel') return 'csv';
  if (
    file.type ===
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'xlsx';
  }
  return 'unknown';
}

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB warn threshold
