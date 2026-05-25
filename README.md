# Bullseye Offense

> Every closed deal has a neighbor.

A static web app for visualizing closed-deal customers on a US map, surfacing
nearby non-closed leads within a configurable radius, and helping you email
those leads with the closed customer as social proof. Upload your own CSV or
Excel file; all processing stays in your browser.

- **No backend.** Nothing leaves the device.
- **No API keys.** Map tiles come from OpenStreetMap; geocoding is offline from
  a bundled zip-code dataset.
- **Privacy by design.** Your dataset is stored in your browser's IndexedDB so a
  refresh doesn't lose work — and so it's just as easy to delete with one click.

## Quick start

```bash
npm install
npm run build:zip-coords   # one-time: writes public/zip-coords.json (~890 KB)
npm run dev
```

Open http://localhost:5173 and either drop a file on the upload zone or click
**Try sample data** to load the included demo.

## CSV / Excel format

Required columns (header text is flexible — common synonyms are auto-detected):

| Canonical field | Common header names recognized                               |
| --------------- | ------------------------------------------------------------ |
| `business_name` | business name, company, account name, customer, organization |
| `zip`           | zip, zipcode, postal code, postcode, zip5                    |

Optional columns also auto-detected: `deal_close_date`, `deal_status`,
`contact_name`, `email`, `phone`, `address`, `city`, `state`, `deal_value`,
`last_contact_date`. **Every column in the uploaded file is preserved** —
unrecognized columns appear in the **Additional fields** section of the
detail panel.

### Deal classification

The map shows three kinds of customers, classified from two columns:

1. **Closed (green pin)** — row has a value in `deal_close_date` (any
   non-empty cell). The presence of a close date is the signal that the deal
   was won. Header synonyms: "deal close date", "recent deal close date",
   "close date", "won date", "date closed", "closing date".
2. **Lost (gray pin)** — no close date AND `deal_status` matches a lost token
   ("lost", "closed lost", "dead").
3. **Open lead (amber pin)** — everything else.

Both `deal_close_date` and `deal_status` are optional. If neither is mapped,
every row becomes an open lead.

Pins on the map:

- **Green teardrop** = closed deal (your customer)
- **Gray pin with X** = lost deal (visible for territory context; not
  counted as a follow-up lead)
- **Amber teardrop** = nearby open lead (appears only while a customer is selected)

### Sample data

`public/sample-data.csv` contains 10 rows across LA, NYC, Austin, and Seattle
with a mix of statuses and a custom `segment` column to demonstrate the
"Additional fields" feature.

## Architecture overview

- **State management.** Three React Contexts: `DataContext` (the loaded dataset
  + column mapping), `FiltersContext` (search/state/status/value/radius), and
  `SelectionContext` (active and hovered customer). The first two persist via
  IndexedDB; selection is ephemeral. Splitting these reduces re-renders — a
  keystroke in search doesn't disturb 10,000 markers.
- **Geocoding.** Bundled zip→\[lat,lng] dataset (33,791 US zips). No network calls.
  See **Swapping data sources** below.
- **Column mapping.** Headers are normalized (lowercased, alphanumerics only) and
  matched against per-field alias lists. Users can override any guess before
  confirming.
- **Distance.** Inline Haversine with a bounding-box pre-filter. Naive O(n)
  scan per selection is sub-millisecond at typical dataset sizes.
- **Same-zip pin offset.** Deterministic golden-angle spiral keyed by occurrence
  count, so multiple customers in the same zip remain individually clickable.
- **Persistence.** All writes go through `idb-keyval`; each persisted value is
  wrapped with `{ __version, data }` for future-proof migrations.
- **Accessibility.** Detail panel uses `aria-live="polite"`, heading focus
  moves on selection, Escape clears, status chips are `role="switch"`, the
  radius input is a native range with descriptive `aria-valuetext`.

## Swapping data sources

`public/zip-coords.json` is built by `scripts/build-zip-coords.mjs` from the
[`us-zips`](https://github.com/blakek/us-zips) npm package (MIT-licensed). To
switch to a higher-quality dataset like
[SimpleMaps US Zip Codes Free](https://simplemaps.com/data/us-zips) (CC BY 4.0)
or the US Census ZCTA Gazetteer (public domain):

1. Update `scripts/build-zip-coords.mjs` to read your source CSV/JSON.
2. Keep the output shape `{ "<5-digit zip>": [lat, lng] }`.
3. Re-run `npm run build:zip-coords`.

Nothing else has to change — the runtime loader treats the file as the source
of truth.

## Swapping the map tiles

The map uses **MapLibre GL** with vector tiles from
[OpenFreeMap](https://openfreemap.org) — both are free, no API key needed.
Light mode uses the `positron` style; dark mode uses `dark`.

To swap to **MapTiler** (commercial, generous free tier with SLA):

1. Sign up for a free account at [maptiler.com](https://maptiler.com) and copy
   your API key.
2. Add it to `.env.local`: `VITE_MAPTILER_KEY=your_key_here`.
3. In `src/components/map/TerritoryMap.tsx`, replace the `STYLE_LIGHT` /
   `STYLE_DARK` constants with MapTiler style URLs, e.g.
   `https://api.maptiler.com/maps/streets-v2/style.json?key=${import.meta.env.VITE_MAPTILER_KEY}`.

To swap to **Mapbox** with a custom-branded style:

1. Sign up at [mapbox.com](https://mapbox.com), create a style in Mapbox Studio.
2. Add `VITE_MAPBOX_TOKEN` to `.env.local`.
3. Point `STYLE_LIGHT` / `STYLE_DARK` at your Mapbox style URLs.
4. Add `transformRequest` config to the `Map` constructor to inject the token.

## Deployment

The app is fully static — any static host will do. Examples:

### Vercel

```bash
npx vercel --prod
```

Or import the repo in the Vercel dashboard; defaults work (build command
`npm run build`, output directory `dist`).

### Netlify

```bash
npx netlify deploy --build --prod
```

Or drag-and-drop the `dist/` folder. Build command `npm run build`, publish
directory `dist`.

### Cloudflare Pages

```bash
npx wrangler pages deploy dist
```

Or via the dashboard: connect the repo, set build command to `npm run build`
and output directory to `dist`.

## Project structure

```
public/
  sample-data.csv         # demo dataset
  zip-coords.json         # generated; do not edit manually
scripts/
  build-zip-coords.mjs    # regenerate the zip dataset
src/
  types/                  # the shared type model
  context/                # Data, Filters, Selection
  hooks/                  # persistence, debouncing, derived lists
  lib/
    parsing/              # file parsers, header detection, row normalization
    geo/                  # Haversine + same-zip jitter
    storage/              # IndexedDB wrappers, schema version
    sample/               # sample-data loader
  components/             # upload, map, panel, filters, layout, common
  utils/                  # small pure helpers (header normalization, hashing)
```

## License

Application code: MIT (or whatever you choose for your distribution).
Zip dataset: see the source you build from (currently `us-zips` — MIT).
Map tiles: © OpenStreetMap contributors.
