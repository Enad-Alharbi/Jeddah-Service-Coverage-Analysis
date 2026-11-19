// Raw Overpass districts -> data/processed/jeddah_districts.geojson
// 1. osmtogeojson  2. selection rules (config)  3. topology-preserving simplification (mapshaper)
// 4. validation (closed rings, orientation, self-intersections, overlaps after simplification)
import osmtogeojson from 'osmtogeojson';
import mapshaper from 'mapshaper';
import * as turf from '@turf/turf';
import { districts as rules } from './config.mjs';
import { km2, latestRaw, osmNames, polygonProblems, writeJson } from './geo-utils.mjs';

const { body, date } = latestRaw('districts');
const all = osmtogeojson(body).features.filter((f) => f.id?.startsWith('relation/') && /Polygon/.test(f.geometry.type));
const gov = all.find((f) => f.properties.id === `relation/${rules.governorateRelId}` || f.id === `relation/${rules.governorateRelId}`);
const candidates = all.filter((f) => f.properties.admin_level === rules.adminLevel);

const kept = [];
const excluded = [];
for (const f of candidates) {
  const osmId = Number(f.id.split('/')[1]);
  const t = f.properties;
  const inter = turf.intersect(turf.featureCollection([f, gov]));
  const share = inter ? turf.area(inter) / turf.area(f) : 0;
  const info = { OSM_ID: osmId, NAME_AR: t['name:ar'] ?? t.name, shareInside: +(share * 100).toFixed(1), areaKm2: +km2(f).toFixed(3) };

  if (rules.dropDuplicateRelIds.includes(osmId)) { excluded.push({ ...info, reason: 'duplicate relation (same member ways)' }); continue; }
  if (share <= rules.minShareInsideGovernorate) { excluded.push({ ...info, reason: `only ${info.shareInside}% inside the governorate` }); continue; }

  kept.push({
    type: 'Feature',
    properties: {
      DISTRICT_CODE: `JED-${osmId}`,
      OSM_ID: osmId,
      NAME_AR: osmNames(t).ar,
      NAME_EN: osmNames(t).en, // OSM tags only, never transliterated by us
      NON_RESIDENTIAL: rules.nonResidentialRelIds.includes(osmId) ? 1 : 0,
      SHARE_INSIDE_GOV_PCT: info.shareInside,
    },
    geometry: f.geometry,
  });
}
console.log(`candidates ${candidates.length}, kept ${kept.length}, excluded ${excluded.length}`);

// Topology-preserving simplification: mapshaper builds a shared-arc topology, so a border between
// two districts is ONE arc simplified once -> neighbours stay snapped, no gaps/slivers are created.
// keep-shapes prevents small polygons from collapsing. rfc7946 -> CCW exterior rings, CW holes.
const input = { 'in.json': turf.featureCollection(kept) };
const out = await mapshaper.applyCommands(
  `-i in.json -simplify dp interval=${rules.simplifyIntervalM} keep-shapes -o out.json format=geojson rfc7946 precision=0.0000001`,
  input,
);
const simplified = JSON.parse(out['out.json']);

// ---- Validation ----
const byCode = new Map(kept.map((f) => [f.properties.DISTRICT_CODE, f]));
const problems = [];
let maxAreaChangePct = 0;
let vertsBefore = 0;
let vertsAfter = 0;
for (const f of simplified.features) {
  const before = byCode.get(f.properties.DISTRICT_CODE);
  const change = (100 * Math.abs(km2(f) - km2(before))) / km2(before);
  maxAreaChangePct = Math.max(maxAreaChangePct, change);
  vertsBefore += turf.coordAll(before).length;
  vertsAfter += turf.coordAll(f).length;
  const p = polygonProblems(f);
  if (p.length) problems.push({ code: f.properties.DISTRICT_CODE, name: f.properties.NAME_AR, problems: p });
}

// Overlaps between neighbours after simplification (should still be none).
const feats = simplified.features;
const boxes = feats.map((f) => turf.bbox(f));
const hit = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const overlaps = [];
for (let i = 0; i < feats.length; i++)
  for (let j = i + 1; j < feats.length; j++) {
    if (!hit(boxes[i], boxes[j])) continue;
    const inter = turf.intersect(turf.featureCollection([feats[i], feats[j]]));
    if (inter && turf.area(inter) > 1) overlaps.push({ a: feats[i].properties.NAME_AR, b: feats[j].properties.NAME_AR, m2: +turf.area(inter).toFixed(1) });
  }

const sum = feats.reduce((s, f) => s + km2(f), 0);
const union = feats.reduce((acc, f) => (acc ? turf.union(turf.featureCollection([acc, f])) : f), null);
const stats = {
  osmSnapshot: body.osm3s?.timestamp_osm_base,
  fetchDate: date,
  candidates: candidates.length,
  kept: feats.length,
  nonResidential: feats.filter((f) => f.properties.NON_RESIDENTIAL).map((f) => f.properties.NAME_AR),
  missingNameAr: feats.filter((f) => !f.properties.NAME_AR).length,
  missingNameEn: feats.filter((f) => !f.properties.NAME_EN).length,
  excluded,
  partiallyOutsideKept: feats.filter((f) => f.properties.SHARE_INSIDE_GOV_PCT < 99.5).map((f) => ({ name: f.properties.NAME_AR, shareInside: f.properties.SHARE_INSIDE_GOV_PCT })),
  simplification: { intervalM: rules.simplifyIntervalM, vertsBefore, vertsAfter, maxAreaChangePct: +maxAreaChangePct.toFixed(3) },
  validation: { invalidCount: problems.length, problems, overlapsAfterSimplify: overlaps },
  areaKm2: { sum: +sum.toFixed(2), union: +km2(union).toFixed(2) },
  extent: turf.bbox(simplified).map((v) => +v.toFixed(5)),
};
console.log(JSON.stringify({ ...stats, excluded: stats.excluded.length, validation: { invalid: problems.length, overlaps: overlaps.length } }, null, 1));

writeJson('jeddah_districts.geojson', simplified);
writeJson('stats/districts.json', stats);
