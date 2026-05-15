// One-time builder for public/zip-coords.json.
//
// Source: the `us-zips` npm package (MIT-licensed; data derived from public US
// postal/geographic sources). We collapse its `{ zip: { latitude, longitude } }`
// shape down to `{ zip: [lat, lng] }` to keep the JSON as small as possible —
// every byte counts because the file is fetched at runtime by every visitor.
//
// Run with: `npm run build:zip-coords` (or `node scripts/build-zip-coords.mjs`).

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const data = require('us-zips');

const out = {};
for (const [zip, coord] of Object.entries(data)) {
  // Coerce to 4 decimals — that is ~11 m precision, far better than zip centroids
  // actually carry, and cuts file size by ~25%.
  const lat = Number(coord.latitude.toFixed(4));
  const lng = Number(coord.longitude.toFixed(4));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  out[zip] = [lat, lng];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '..', 'public', 'zip-coords.json');
writeFileSync(target, JSON.stringify(out));

const bytes = Buffer.byteLength(JSON.stringify(out));
console.log(`Wrote ${Object.keys(out).length} zip codes → ${target}`);
console.log(`Size: ${(bytes / 1024).toFixed(0)} KB raw (CDN serves gzipped).`);
