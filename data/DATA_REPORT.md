# Data Report: Jeddah districts & facilities (OpenStreetMap)

| | |
|---|---|
| **OSM snapshot** | `2026-11-15T10:20:51Z` (districts) · `2026-11-15T10:28:51Z` (schools) · `2026-11-15T10:29:49Z` (health, parks). Values are Overpass `timestamp_osm_base`. |
| **Fetched** | 2026-11-15 via Overpass API (`overpass-api.de`), raw responses in `data/raw/*_2026-11-15.json` |
| **CRS** | WGS84, EPSG:4326, coordinates `[lon, lat]` |
| **Ring orientation** | RFC 7946: exterior rings **counter-clockwise**, holes **clockwise** (the same convention Oracle Spatial expects) |
| **Attribution** | © OpenStreetMap contributors. Data licensed under the **Open Database License (ODbL)**: https://www.openstreetmap.org/copyright |

No geometry or name in `data/processed/` was invented, hand-drawn, or transliterated. Every value comes from OSM tags.
Machine-readable numbers behind this report: `data/processed/stats/*.json`.

## Summary

| Layer | File | Count |
|---|---|---|
| Districts | `jeddah_districts.geojson` | **147** (143 residential + 4 non-residential) |
| Schools | `facilities_school.geojson` | **215** |
| Health | `facilities_health.geojson` | **122** (84 hospital, 36 clinic, 2 doctors) |
| Parks | `facilities_park.geojson` | **364** |

> ⚠️ **Main limitation: OSM completeness.** Jeddah is a city of several million people, yet OSM has only ~220 schools
> and ~120 health facilities mapped there. 97 of 143 residential districts have **no** school in OSM, and 102 have no
> health facility. Coverage results therefore measure **coverage of what is mapped in OSM**, not the real situation
> on the ground. Every result screen and the README must say so. Gaps are **not** filled from other sources (project rule).

---

## 1. Districts

### 1.1 How Jeddah is tagged in OSM (inspection)

- There is **no city-level boundary** for Jeddah. The container is **محافظة جدة / Governorate of Jeddah**, `boundary=administrative`, `admin_level=6`, relation **12429519**, area 3,341 km².
- Inside it the only other admin level is **`admin_level=10`**: 156 relations, all `type=boundary`, all with `name`, `name:ar`, and `name:en`. There is nothing at levels 7, 8, or 9.
- Spot-check from the brief: الروضة, السلامة, النعيم, and الحمراء are found with the exact name. «الصفا» is spelled **«الصفاء»** in OSM, and we keep the OSM spelling.
- The relations come from three id ranges (19268xxx: 33, 20039xxx: 118, 20040xxx: 5). They look like separate mapping batches.

### 1.2 Selection rules (approved 2026-11-15)

| Rule | Effect |
|---|---|
| Keep a district when **> 50 % of its area** is inside the governorate. Geometry is kept **whole, not clipped**, because clipping would change the district's area and its coverage %. | 8 excluded |
| Drop exact duplicates (same member ways) | 1 excluded |
| Flag non-residential units `NON_RESIDENTIAL = 1`. They stay on the map and are left out of ranking and KPIs. | 4 flagged |

The district boundaries and the governorate boundary in OSM come from different sources and do not line up,
so several districts cross into **محافظة بحرة** or **محافظة الجموم**.

**Excluded (9):**

| OSM relation | Name | Reason |
|---|---|---|
| 19268636 | الشراع | Duplicate of 20039305 (identical member ways; only `name:en` differs: "Ash Sheraa" vs "Al Shiraa") |
| 19268639 | الصفوة | 44.2 % inside (rest in الجموم) |
| 20039258 | العسيلة | 18.2 % inside (rest in بحرة) |
| 20039318 | الرواسي | 4.8 % inside (rest in الجموم) |
| 20039337 | الحجاز | 20.5 % inside (rest in الجموم) |
| 20039340 | الأثير | 42.6 % inside (rest in بحرة) |
| 20039341 | المرسلات | 19.5 % inside (rest in بحرة) |
| 20039342 | أبو جعالة | 48.5 % inside (rest in بحرة) |
| 20039344 | المستقبل | 5.9 % inside (rest in بحرة) |

Also not included: four `admin_level=10` relations from the same batch that lie **100 % outside** the governorate.
They are كتانة and السهل (in بحرة), and أم حبلين الشرقية and البدور (in الجموم).

**Kept although partly outside the governorate (10):** الحمدانية 97.3 %, بريمان 86.2 %, المحاميد 82.9 %, الكرامة 82.0 %,
التضامن 78.2 %, أم حبلين الغربية 68.4 %, الشفاء 51.7 %, الصالحية 97.8 %, التلال 97.0 %, المروج 98.2 %.

**Non-residential (4):** مطار الملك عبد العزيز (87.6 km², the largest unit), ميناء جدة الاسلامي, جامعة الملك عبدالعزيز, الجامعة.

### 1.3 Processing

1. `osmtogeojson` builds (Multi)Polygons from the relations. All 156 relations built successfully.
2. **Topology-preserving simplification** with `mapshaper -simplify dp interval=5 keep-shapes`. Mapshaper builds a shared-arc
   topology, so each border between two neighbours is one arc and is simplified once. Neighbours stay snapped together, and no new gaps or slivers appear.
   Vertices went from 17,699 to 8,749. The largest area change for any district is **0.24 %**.
3. Properties: `DISTRICT_CODE` (`JED-<osm_id>`), `OSM_ID`, `NAME_AR` / `NAME_EN` (same name rule as facilities, see 2.2; all 147 districts have both `name:ar` and `name:en`),
   `NON_RESIDENTIAL` (0/1), `SHARE_INSIDE_GOV_PCT`.

### 1.4 Validation

| Check | Result |
|---|---|
| Rings closed, ≥ 4 points, correct orientation | 147 / 147 OK |
| Self-intersections (`turf.kinks`) | 0 |
| Overlaps between districts after simplification (> 1 m²) | **0** (sum of areas = area of union = 1,781.1 km²) |
| Interior gaps (holes enclosed by districts) | **0** |
| Districts without Arabic name / without English name | 0 / 0 |
| Multi-part districts | الأندلس (2 parts), أبحر الجنوبية (3), المروج (3), البحيرات (2) |
| Extent (min lon, min lat, max lon, max lat) | `38.94686, 21.05161, 39.42693, 21.99678` |

The districts form **3 main clusters**: the central city (1,245 km²), the south (456 km²), and the north coast around Obhur (78 km²).
They are separated by land that is not inside any district, plus a few small detached parts of the multi-part districts above.
The districts cover ~53 % of the governorate. The rest has no district boundary in OSM (desert / outskirts).
Validity and overlaps were checked again in Oracle (section 3): same result.

---

## 2. Facilities

### 2.1 Tags used

| Service | Included tags | Not included (count in the search box), and why |
|---|---|---|
| **school** | `amenity=school` | `amenity=kindergarten` (6): pre-school is a different service with a different walking catchment. `amenity=college` / `university` (40): not neighbourhood walk-to services. |
| **health** | `amenity=hospital\|clinic\|doctors`, `healthcare=hospital\|clinic\|doctor\|centre` | `amenity/healthcare=pharmacy` (~230): retail, and it would dominate the layer. `dentist` (7), `laboratory` (2), `dialysis` (1): specialised, not general care. In this snapshot every `healthcare=*` object that matched was also tagged with one of the `amenity` values. |
| **park** | `leisure=park` | `leisure=garden` (25): often private or decorative (1 is `access=private`). `leisure=playground` (43): usually small, inside compounds or inside parks already counted. |

Search area: the bounding box of the 147 districts plus a **1.2 km** margin.

### 2.2 Processing

1. `osmtogeojson` with full geometry (`out geom`).
2. **Open ways excluded (10)**: 2-node lines tagged as a school or park. They are mapping errors, not areas.
   - Schools: way 405638561 and way 405638562 («مدارس التعاون الأهلية»), way 405783000 ("8"), way 405783136 ("136"), way 409048054 (unnamed)
   - Parks: way 405783042 ("49"), way 405783097 ("112"), way 407182581, way 407502888, way 409083987 (unnamed)
3. **Point-on-surface** for areas (`turf.pointOnFeature`), so each area becomes one point that is guaranteed to lie inside the shape.
   For **22 parks the centroid falls outside the park** (concave shapes), which is exactly the case point-on-surface handles.
4. **Deduplication**: a node or smaller area that lies inside a larger area of the same service, with the same name (or with one side unnamed), is the same facility mapped twice. The larger area is kept.
   When the area had no name, it takes the node's OSM name (e.g. way 905286962 gets «ثانوية صقلية للبنين» from node 5101777025).
   Removed: schools 2, health 2, parks 5. Full list in `stats/facilities.json`.
5. **Edge effect**: a facility just outside a district can still cover part of it within walking distance. We keep facilities that are inside a district **or within 1,000 m** of one (the maximum analysis distance).
   `IN_DISTRICT` is a preliminary flag. The authoritative spatial join is done in Oracle (phase 3).
6. Properties: `FACILITY_ID` (`<service>-<n|w|r><osm_id>`), `OSM_ID`, `OSM_TYPE`, `SERVICE_TYPE`, `SUBTYPE` (the OSM tag value), `NAME_AR`, `NAME_EN`,
   `GEOM_ORIGIN` (`node` / `point_on_surface`), `IN_DISTRICT`.
7. **Names (small deviation from the brief):** `name:ar` and `name:en` are used when present. The plain `name` tag fills **whichever slot matches its script**:
   Arabic script goes to `NAME_AR`, anything else goes to `NAME_EN`. Using `name` blindly as the Arabic name put English text such as
   "Pakistan International School Jeddah" into `NAME_AR`. Nothing is translated or transliterated. The UI shows `NAME_AR`, then `NAME_EN`, then «بدون اسم».

### 2.3 Counts

| | Schools | Health | Parks |
|---|---|---|---|
| Raw OSM objects | 224 | 125 | 381 |
| Open ways excluded | 5 | 0 | 5 |
| Duplicates removed | 2 | 2 | 5 |
| Dropped: more than 1 km from every district | 2 | 1 | 7 |
| **Final** | **215** | **122** | **364** |
| …of which outside all districts but within 1 km | 11 | 1 | 0 |
| From areas (point-on-surface) / from nodes | 170 / 45 | 45 / 77 | 351 / 13 |
| **No name at all** | 110 (51 %) | 2 (2 %) | 310 (85 %) |
| No Arabic name (`NAME_AR` empty) | 135 | 28 | 329 |
| No English name (`NAME_EN` empty) | 169 | 36 | 331 |
| Residential districts with **0** facilities of this type | 97 / 143 | 102 / 143 | 90 / 143 |

Unnamed facilities stay in the data (they are real mapped objects) and are labelled «بدون اسم» in the UI.

---

## 3. Oracle load (phase 3)

Loaded into schema `GIS_COVERAGE` with `backend/CoverageAnalysis.DataLoader` (`SDO_UTIL.FROM_GEOJSON`, SRID 4326, one transaction, 0.8 s).
Checks come from `backend/database/03_post_load.sql` and `04_verify.sql`.

| Check | Result |
|---|---|
| Row counts (districts / school / health / park) | 147 / 215 / 122 / 364, matching section 2 |
| `VALIDATE_GEOMETRY_WITH_CONTEXT` (tolerance 0.05 m) | 848 / 848 `TRUE`. `RECTIFY_GEOMETRY` was not needed (0 rows) |
| District overlaps (`SDO_RELATE`, any interior relation) | **0**. 406 neighbour pairs only `TOUCH` |
| Spatial join `FACILITIES.DISTRICT_ID` (`mask=CONTAINS+COVERS`) | 689 in a district, **12 outside all districts** (11 schools, 1 health) at 400–972 m. Same as the preliminary JS flag. 0 points lie exactly on a boundary |
| `AREA_KM2` (WGS84 ellipsoid) | Total **1,776.35 km²**, min 0.88, max 87.38, no zero or null |
| Spatial index used | `DOMAIN INDEX` on `DISTRICTS_GEOM_SIDX` (point-in-polygon) and `FACILITIES_GEOM_SIDX` (`SDO_WITHIN_DISTANCE`) |

Areas: Oracle's ellipsoidal total (1,776.35 km²) is **0.27 % smaller** than turf's spherical total (1,781.1 km²) in section 1.
The ellipsoid is the more accurate model, so all reported areas use Oracle's `AREA_KM2`.

## 4. Reproduce

```bash
cd data/scripts
npm install
npm run inspect     # optional: tagging inspection
npm run all         # fetch + process districts and facilities, then checks
```

Re-running fetches a **new** OSM snapshot, so counts may change. Update this report when you do.
