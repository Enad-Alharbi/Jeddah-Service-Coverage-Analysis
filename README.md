# مرصد تغطية الخدمات · جدة (Jeddah Service Coverage Analysis)

A planning tool for a municipal planner. It answers:
*"Which parts of each Jeddah district are not within walking distance of a school, health facility, or park, and where should the next one go?"*

It is a multi-layer spatial analysis on **real OpenStreetMap data**. Buffers, unions, intersections, differences, true areas, and spatial joins run in **Oracle Spatial**. An instant **what-if** runs in the browser with ArcGIS geometry operators and is re-checked by Oracle.

> ⚠️ **Read this first.** Results measure coverage by facilities **mapped in OpenStreetMap**. OSM is far from complete for
> Jeddah's schools and health facilities (≈215 schools mapped for a city of millions; see [`data/DATA_REPORT.md`](data/DATA_REPORT.md)).
> Low coverage often means "not mapped", not "not there". No data was invented to fill the gaps.

## Features

| | |
|---|---|
| **Map** | All 147 districts and 701 facilities (schools ■, health ◆, parks ▲) on a dark basemap, with Arabic labels, popups, and clustering |
| **Analysis** | Pick a service (مدارس / صحة / حدائق) and a walking distance (500 / 800 / 1000 m), then «تحليل التغطية» |
| **Result** | Districts colored by coverage % (< 50 coral, 50–80 amber, ≥ 80 cyan), the covered area (cyan), and the uncovered area (coral hatch) |
| **KPIs** | City coverage (area-weighted), under-served districts, uncovered km², facility count |
| **Ranking** | Bottom drawer, worst → best, sortable and resizable. A row click zooms to the district |
| **District card** | The three services side by side (donut gauges), facility counts, uncovered km² |
| **What-if** | «اقتراح موقع جديد»: click inside a district and get an instant before → after («+12.9%», «+1.14 كم²»). Save keeps the site and Oracle re-checks it |
| **Priority** | Districts under 50 % in two or more services, highlighted on the map with a `FeatureEffect` |

## Stack

| Layer | Tech |
|---|---|
| Frontend | Angular 22 (standalone components, Signals, `inject()`, reactive forms, lazy route), RTL Arabic UI, SCSS design system |
| Map | ArcGIS Maps SDK for JavaScript **5.2** (map components + core API, client-side `FeatureLayer`s, geometry operators) |
| Backend | ASP.NET Core Web API (.NET 10): controllers → services → repositories, ProblemDetails, OpenAPI + Swagger UI, response compression |
| Data access | Dapper + Oracle.ManagedDataAccess.Core, hand-written parameterized SQL |
| Database | Oracle AI Database 26ai Free, Oracle Spatial (`SDO_GEOMETRY`), schema `GIS_COVERAGE` |
| Data | OpenStreetMap via the Overpass API, `osmtogeojson`, `mapshaper`, `turf` |

## Architecture

```
 OpenStreetMap ──Overpass──▶ data/scripts (Node) ──▶ data/processed/*.geojson ──DataLoader──▶ Oracle (GIS_COVERAGE)
                               osmtogeojson                                     FROM_GEOJSON       DISTRICTS, FACILITIES
                               mapshaper (topology-preserving)                                     spatial indexes (R-tree)
                               point-on-surface, dedupe                                            COVERAGE_PKG ──▶ COVERAGE_RESULTS (cache)

 Angular + ArcGIS ◀──GeoJSON── ASP.NET Core API ◀──Dapper── Oracle
   client-side FeatureLayers      /api/districts, /api/facilities, /api/coverage[...], /api/proposals
   class-breaks / unique-value    validation, ProblemDetails, compression
   what-if: geodesic operators ──POST /api/proposals──▶ COVERAGE_PKG.EVALUATE_SITE (server re-check)
```

**Where the spatial work runs:**

- **Oracle (server).** The full analysis is 3 services × 3 distances × 147 districts = 1,323 results, about 31 s. It is computed once and cached in `COVERAGE_RESULTS`. Oracle is the source of truth.
- **Browser.** The what-if is one site in one district. Geodesic operators answer in milliseconds without a request. On save, Oracle recomputes the same site with the server method and both values are stored.

## Measurement: true meters and km²

- **Geometry operations** (buffer, union, intersection, difference) run in **UTM zone 37N (SRID 32637)**.
  Jeddah (lon 38.9–39.4) sits right on that zone's central meridian (39°E), so distortion is tiny.
- **Areas** come from `AREA_KM2`, the district's area on the **WGS84 ellipsoid** (`SDO_GEOM.SDO_AREA` on SRID 4326).
  Covered km² = (covered ÷ district area, both in UTM) × `AREA_KM2`. The ratio is distortion-free, and this removes UTM's −0.08 % area scale (k0² = 0.9992).
- **Checked:** [`05_measurement_comparison.sql`](backend/database/05_measurement_comparison.sql) runs both methods on real districts.
  The geodetic (4326) and UTM coverage % agree within **0.04 percentage points**, and UTM is **1.3–5× faster**.
- **Not Web Mercator.** At Jeddah's latitude it inflates areas by about 16 %. The map uses it only for display.

## Setup

Requirements: Node 24, .NET 10 SDK, Angular CLI 22, Oracle Database 26ai Free (`localhost:1521/FREEPDB1`), and an ArcGIS Location Platform API key with the Basemaps privilege, referrer-restricted to `http://localhost:4200`.

### 1. Oracle schema (once, as `SYSTEM`)

Run [`backend/database/00_create_user.sql`](backend/database/00_create_user.sql) after replacing `<YOUR_PASSWORD>`. Don't commit the password.

### 2. Secrets (never in git)

```bash
dotnet user-secrets set "ConnectionStrings:Oracle" "User Id=GIS_COVERAGE;Password=<YOUR_PASSWORD>;Data Source=localhost:1521/FREEPDB1" --project backend/CoverageAnalysis.Api
```

```bash
copy frontend\src\environments\app-config.example.ts frontend\src\environments\app-config.ts
```

Then put your ArcGIS key in `app-config.ts` (the file is gitignored). The DataLoader shares the API's user-secrets.

### 3. Data (optional: `data/processed/` is committed)

```bash
cd data/scripts
npm install
npm run all
```

This fetches a **new** OSM snapshot and re-processes it. Update `DATA_REPORT.md` if the counts change.

### 4. Database (as `GIS_COVERAGE`, in order)

| Script | What it does |
|---|---|
| `01_create_tables.sql` | `DISTRICTS`, `FACILITIES`, `COVERAGE_RESULTS` (cache), `PROPOSED_SITES` + B-tree indexes |
| `02_spatial_metadata_indexes.sql` | `USER_SDO_GEOM_METADATA` (SRID 4326, 5 cm tolerance) + `SPATIAL_INDEX_V2` indexes |
| `dotnet run --project backend/CoverageAnalysis.DataLoader -- --data data/processed` | Loads the GeoJSON (`SDO_UTIL.FROM_GEOJSON`). It refuses to load into non-empty tables |
| `03_post_load.sql` | Validate / rectify, ellipsoidal `AREA_KM2`, spatial join `FACILITIES.DISTRICT_ID` |
| `04_verify.sql` | Counts, validity, overlap check, facilities outside districts, `EXPLAIN PLAN` (DOMAIN INDEX). Read-only |
| `05_measurement_comparison.sql` | Geodetic vs UTM on real districts. Read-only |
| `06_coverage_pkg.sql` | `COVERAGE_PKG`: `COMPUTE`, `ENSURE` (on-demand cache), `EVALUATE_SITE` (what-if) |
| `07_compute_all.sql` | Optional: fill the whole cache up front (~31 s) + sanity checks |
| `08_proposals.sql` | Adds `CLIENT_COVERAGE_AFTER` for the browser vs server check |

### 5. Run

```bash
dotnet run --project backend/CoverageAnalysis.Api
```

```bash
cd frontend
npm install
npm start
```

| URL | |
|---|---|
| `http://localhost:4200` | The app (only one project may use port 4200 at a time, because of the API key referrer) |
| `http://localhost:5090/swagger` | Swagger UI (Development only) |

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/districts` | All 147 districts as GeoJSON (WGS84) |
| GET | `/api/facilities?serviceType=` | Facilities as GeoJSON points (all services if omitted) |
| GET | `/api/coverage?serviceType=&distance=` | Per-district coverage + covered / uncovered GeoJSON (display-simplified 2 m) + city KPIs. Computes and caches on first request |
| GET | `/api/coverage/district/{code}?distance=` | One district, all three services |
| GET | `/api/coverage/priority?distance=&threshold=50` | Residential districts under the threshold in two or more services |
| POST | `/api/coverage/recompute?serviceType=&distance=` | Development only: refresh the cache |
| POST | `/api/proposals` | Save a what-if site. Validates the bounding box (from config) and point-in-district (`SDO_RELATE`); Oracle re-computes "after" |
| GET | `/api/proposals?serviceType=&distance=` | Saved what-if sites with browser value, server value, and difference |

Inputs are validated against configuration (`Coverage` section in `appsettings.json`). Errors are returned as ProblemDetails.

## Data pipeline (summary)

1. **Inspect** the tagging: Jeddah = governorate relation 12429519 (`admin_level=6`); districts = `admin_level=10` (156 found).
2. **Select:** keep districts with > 50 % of their area inside the governorate (geometry not clipped), drop one exact duplicate, flag 4 non-residential units. Result: **147**.
3. **Simplify** topology-preserving with `mapshaper -simplify keep-shapes` (5 m). There are no gaps or overlaps between neighbours, and the largest area change is 0.24 %.
4. **Facilities:** `amenity=school`; hospital / clinic / doctors (`amenity` + `healthcare`); `leisure=park`. Areas become one point via **point-on-surface** (22 parks have their centroid outside the park). Node-inside-own-area duplicates are removed. Facilities within 1 km of a district are kept (edge effect).
5. **Validate** in Node and again in Oracle (`VALIDATE_GEOMETRY_WITH_CONTEXT`, overlap check with `SDO_RELATE`).

Full details, counts, and every decision: [`data/DATA_REPORT.md`](data/DATA_REPORT.md).

## Tests

```bash
cd frontend
npx ng test --watch=false
```

8 tests: coverage classes, GeoJSON → Esri ring orientation, and the what-if engine with the real geodesic operators.

```bash
dotnet test backend/CoverageAnalysis.Tests
```

18 tests: input validation, point outside the bounding box, the 422 not-in-district case, and the browser − server difference.

## Known limitations

- **OSM completeness** (see the warning at the top). Districts with 0 % coverage are mostly districts with no mapped facility.
- **Straight-line walking distance.** Coverage uses buffers (as the crow flies), not the street network. A network service area is a possible future enhancement.
- **District boundaries vs governorate boundary** don't match in OSM. The rule used is documented in `DATA_REPORT.md`.
- **Non-residential units** (airport, seaport, universities) stay on the map but are excluded from the ranking and the KPIs.

## Docs

- [`data/DATA_REPORT.md`](data/DATA_REPORT.md): data quality, counts, decisions, OSM snapshot date.

## Data & attribution

All district boundaries, facility locations, and names come from **OpenStreetMap** (snapshot of 2026-11-15).

**© OpenStreetMap contributors.** The data is available under the [Open Database License (ODbL)](https://www.openstreetmap.org/copyright).
The attribution is shown in the map's attribution bar and permanently in the legend.

Basemap: Esri (ArcGIS basemap styles), with its own attribution on the map.
