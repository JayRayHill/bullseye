/** Normalize a header string for alias matching: lowercase + drop non-alphanumerics.
 *  Example: "Business Name " → "businessname"; "ZIP / Postal" → "zippostal". */
export function normalizeHeader(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Stable, fast hash for building Customer.id. We do not need cryptographic strength;
 *  we need deterministic short ids from `${rowIndex}|${zip}|${business_name}`. */
export function stableHash(input: string): string {
  // FNV-1a 32-bit, formatted as base36 for a short readable id.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
