// Builds public/zip-coords.json from the `us-zips` npm package.
//
// us-zips ships lat/lng per zip but NOT state — we derive the state from
// the zip's first-3-digit prefix using the standard USPS sectional-center
// prefix table below. The mapping is ~99.9% accurate for normal US zips;
// edge-case overlaps (military APO/FPO, some Caribbean territories) are
// either left without a state or assigned their primary territory.
//
// Output shape: { "85018": [lat, lng, "AZ"], ... }
// (Was previously [lat, lng] — the optional third tuple element is what's
//  new. Old consumers that destructure only the first two values still
//  work.)
//
// Run with: `npm run build:zip-coords` (or `node scripts/build-zip-coords.mjs`).

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const data = require('us-zips');

// USPS sectional-center prefix → state. Each entry is [startPrefix,
// endPrefix, state] using inclusive 3-digit string prefixes. Sourced
// from the standard ZIP-by-state ranges published by USPS.
const STATE_PREFIX_RANGES = [
  ['006', '009', 'PR'],
  ['010', '027', 'MA'],
  ['028', '029', 'RI'],
  ['030', '038', 'NH'],
  ['039', '049', 'ME'],
  ['050', '054', 'VT'],
  ['055', '055', 'MA'], // Massachusetts exclave inside Vermont's range
  ['056', '059', 'VT'],
  ['060', '069', 'CT'],
  ['070', '089', 'NJ'],
  ['100', '149', 'NY'],
  ['150', '196', 'PA'],
  ['197', '199', 'DE'],
  ['200', '200', 'DC'],
  ['201', '201', 'VA'], // Northern Virginia spillover
  ['202', '205', 'DC'],
  ['206', '219', 'MD'],
  ['220', '246', 'VA'],
  ['247', '268', 'WV'],
  ['270', '289', 'NC'],
  ['290', '299', 'SC'],
  ['300', '319', 'GA'],
  ['320', '349', 'FL'],
  ['350', '369', 'AL'],
  ['370', '385', 'TN'],
  ['386', '397', 'MS'],
  ['398', '399', 'GA'],
  ['400', '427', 'KY'],
  ['430', '459', 'OH'],
  ['460', '479', 'IN'],
  ['480', '499', 'MI'],
  ['500', '528', 'IA'],
  ['530', '549', 'WI'],
  ['550', '567', 'MN'],
  ['569', '569', 'DC'],
  ['570', '577', 'SD'],
  ['580', '588', 'ND'],
  ['590', '599', 'MT'],
  ['600', '629', 'IL'],
  ['630', '658', 'MO'],
  ['660', '679', 'KS'],
  ['680', '693', 'NE'],
  ['700', '714', 'LA'],
  ['716', '729', 'AR'],
  ['730', '749', 'OK'],
  ['750', '799', 'TX'],
  ['800', '816', 'CO'],
  ['820', '831', 'WY'],
  ['832', '838', 'ID'],
  ['840', '847', 'UT'],
  ['850', '865', 'AZ'],
  ['870', '884', 'NM'],
  ['885', '885', 'TX'],
  ['889', '898', 'NV'],
  ['900', '961', 'CA'],
  ['967', '968', 'HI'],
  ['970', '979', 'OR'],
  ['980', '994', 'WA'],
  ['995', '999', 'AK'],
];

// Expand ranges into a flat { prefix: state } lookup for O(1) access in
// the per-zip loop. 1000 entries max — negligible memory.
const PREFIX_TO_STATE = {};
for (const [start, end, state] of STATE_PREFIX_RANGES) {
  const s = parseInt(start, 10);
  const e = parseInt(end, 10);
  for (let p = s; p <= e; p++) {
    PREFIX_TO_STATE[String(p).padStart(3, '0')] = state;
  }
}

const out = {};
let withState = 0;
let withoutState = 0;
for (const [zip, coord] of Object.entries(data)) {
  // Coerce to 4 decimals — that is ~11 m precision, far better than zip centroids
  // actually carry, and cuts file size by ~25%.
  const lat = Number(coord.latitude.toFixed(4));
  const lng = Number(coord.longitude.toFixed(4));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  const prefix = zip.slice(0, 3);
  const state = PREFIX_TO_STATE[prefix];
  if (state) {
    out[zip] = [lat, lng, state];
    withState++;
  } else {
    // No prefix match (military APO/FPO, unusual territories). Keep the
    // entry so the lat/lng lookup still works; the state slot stays
    // undefined and the app falls back to the mapped CSV column.
    out[zip] = [lat, lng];
    withoutState++;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '..', 'public', 'zip-coords.json');
writeFileSync(target, JSON.stringify(out));

const bytes = Buffer.byteLength(JSON.stringify(out));
console.log(`Wrote ${Object.keys(out).length} zip codes → ${target}`);
console.log(`  ${withState} with state, ${withoutState} without`);
console.log(`Size: ${(bytes / 1024).toFixed(0)} KB raw (CDN serves gzipped).`);
