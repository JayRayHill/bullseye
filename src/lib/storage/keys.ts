// Single source of truth for storage keys and schema version.
// Bump SCHEMA_VERSION and add a migrator in usePersistedState when the persisted
// shape changes incompatibly.

export const STORAGE_KEYS = {
  dataset: 'stm:dataset:v1',
  columnMapping: 'stm:column-mapping:v1',
  filters: 'stm:filters:v1',
} as const;

export const SCHEMA_VERSION = 1;
