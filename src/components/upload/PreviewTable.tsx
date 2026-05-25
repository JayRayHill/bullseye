// Shows the first 5 normalized values under the current column mapping. Used
// inside the ColumnMappingForm so the user can sanity-check their picks before
// committing. We display each canonical field separately, so the user can spot
// "this column is mapped to deal_status but the values look like dates."

import type { ColumnMapping, RawRow } from '../../types';
import type { CanonicalField } from '../../types';
import { REQUIRED_FIELDS, OPTIONAL_FIELDS } from '../../lib/parsing/autoDetectColumns';

export function PreviewTable({
  rows,
  mapping,
}: {
  rows: RawRow[];
  mapping: ColumnMapping;
}) {
  const visibleFields: CanonicalField[] = [
    ...REQUIRED_FIELDS,
    ...OPTIONAL_FIELDS.filter((f) => mapping[f]),
  ];
  const sample = rows.slice(0, 5);
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            {visibleFields.map((f) => (
              <th key={f} className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">
                {f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
          {sample.map((row, i) => (
            <tr key={i}>
              {visibleFields.map((f) => {
                const header = mapping[f];
                const value = header ? row[header] ?? '' : '';
                return (
                  <td key={f} className="px-3 py-2 text-slate-800 dark:text-slate-200">
                    {value || <span className="text-slate-400 dark:text-slate-500">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
