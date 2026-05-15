// Computes the filter-passing subset of the dataset. Memoized to avoid recomputing
// when unrelated state changes. Search is matched against business_name and city,
// case-insensitive. Empty filter arrays mean "no constraint."

import { useMemo } from 'react';
import type { Customer, Filters } from '../types';
import { useDebouncedValue } from './useDebouncedValue';

export function useFilteredCustomers(customers: Customer[], filters: Filters): Customer[] {
  const debouncedSearch = useDebouncedValue(filters.search, 200);
  return useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const [min, max] = filters.dealValueRange;
    const valueFilterActive = min !== null || max !== null;
    return customers.filter((c) => {
      if (q) {
        const inName = c.business_name.toLowerCase().includes(q);
        const inCity = c.city ? c.city.toLowerCase().includes(q) : false;
        if (!inName && !inCity) return false;
      }
      if (filters.states.length && (!c.state || !filters.states.includes(c.state))) {
        return false;
      }
      if (filters.statuses.length && !filters.statuses.includes(c.deal_status)) {
        return false;
      }
      if (valueFilterActive) {
        if (c.deal_value === undefined) return false;
        if (min !== null && c.deal_value < min) return false;
        if (max !== null && c.deal_value > max) return false;
      }
      return true;
    });
  }, [customers, debouncedSearch, filters.states, filters.statuses, filters.dealValueRange]);
}
