// File-drop + native picker. Detects file kind, parses it, kicks off the column
// mapping step. Heavy lifting is delegated to the parsing layer; this component
// owns only the UI state of the drag and the in-flight parse.

import { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { detectFileType, MAX_FILE_BYTES } from '../../lib/parsing/detectFileType';
import { parseCsvFile } from '../../lib/parsing/parseCsv';
import { parseXlsxFile } from '../../lib/parsing/parseXlsx';
import { autoDetectColumns } from '../../lib/parsing/autoDetectColumns';
import { useToast } from '../common/ToastProvider';
import { useUpload } from './UploadContext';

export function UploadDropzone() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { startMapping } = useUpload();

  const processFile = useCallback(
    async (file: File) => {
      const kind = detectFileType(file);
      if (kind === 'unknown') {
        toast.show('error', 'Unsupported file type. Please upload a .csv or .xlsx file.');
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        const confirmed = window.confirm(
          `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Large files may be slow to process. Continue?`
        );
        if (!confirmed) return;
      }
      setBusy(true);
      try {
        const parsed = kind === 'csv' ? await parseCsvFile(file) : await parseXlsxFile(file);
        if (!parsed.headers.length || !parsed.rows.length) {
          toast.show('error', 'The file looks empty or has no header row.');
          return;
        }
        const autoMapping = autoDetectColumns(parsed.headers);
        startMapping({
          filename: file.name,
          headers: parsed.headers,
          rows: parsed.rows,
          autoMapping,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to parse the file.';
        toast.show('error', message);
      } finally {
        setBusy(false);
      }
    },
    [toast, startMapping]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void processFile(file);
      }}
      className={clsx(
        'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors',
        dragOver
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-300 bg-white hover:border-slate-400'
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-10 w-10 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 6l-4-4m0 0L8 6m4-4v12"
        />
      </svg>
      <p className="text-sm text-slate-700">
        {busy ? 'Parsing…' : 'Drag and drop a .csv or .xlsx file here, or'}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
      >
        Choose a file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void processFile(file);
          // Reset so re-selecting the same file fires onChange.
          e.target.value = '';
        }}
      />
      <p className="text-xs text-slate-500">Up to 50 MB. Larger files prompt for confirmation.</p>
    </div>
  );
}
