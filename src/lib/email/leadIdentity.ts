// Stable lead identity for dedup. Survives CSV re-uploads where row order or
// other columns may change — what matters is "is this the same business".
//
// Email is the strongest signal; if it's present we use the lowercased,
// trimmed form. If a lead doesn't have an email on record (and therefore
// can't even be emailed) we fall back to zip + lowercased business name so
// dedup still works once an email gets added later.

import type { Customer } from '../../types';

export function leadIdentity(customer: Pick<Customer, 'email' | 'zip' | 'business_name'>): string {
  const email = customer.email?.trim().toLowerCase();
  if (email) return email;
  const name = customer.business_name.trim().toLowerCase();
  return `${customer.zip}|${name}`;
}
