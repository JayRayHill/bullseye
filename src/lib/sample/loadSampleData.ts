// Loads /public/sample-data.csv via fetch + parseCsvString. Bypasses the column
// mapping form by supplying a known mapping since we control the sample headers.

import type { ColumnMapping } from '../../types';
import { parseCsvString } from '../parsing/parseCsv';

export const SAMPLE_MAPPING: ColumnMapping = {
  business_name: 'business_name',
  zip: 'zip',
  deal_status: 'deal_status',
  deal_close_date: 'recent_deal_close_date',
  contact_name: 'contact_name',
  email: 'email',
  city: 'city',
  state: 'state',
  deal_value: 'deal_value',
  last_contact_date: 'last_contact_date',
};

export async function loadSampleData(): Promise<{
  headers: string[];
  rows: ReturnType<typeof parseCsvString>['rows'];
}> {
  const res = await fetch('/sample-data.csv');
  if (!res.ok) throw new Error('Failed to load sample data.');
  const text = await res.text();
  return parseCsvString(text);
}
