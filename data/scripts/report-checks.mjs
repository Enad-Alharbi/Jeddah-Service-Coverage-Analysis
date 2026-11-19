// Extra checks for DATA_REPORT.md: interior gaps between districts, facilities per district.
import fs from 'node:fs';
import * as turf from '@turf/turf';
import { writeJson } from './geo-utils.mjs';

const read = (f) => JSON.parse(fs.readFileSync(`../processed/${f}`, 'utf8'));
const districts = read('jeddah_districts.geojson').features;

// Interior gaps = holes in the union of all districts (land enclosed by districts but in none of them).
const union = districts.reduce((acc, f) => (acc ? turf.union(turf.featureCollection([acc, f])) : f), null);
const polys = union.geometry.type === 'Polygon' ? [union.geometry.coordinates] : union.geometry.coordinates;
const holes = polys.flatMap((rings) => rings.slice(1)).map((r) => turf.area(turf.polygon([r])));
const gaps = { unionParts: polys.length, holeCount: holes.length, holesOver1000m2: holes.filter((a) => a > 1000).length, totalHoleKm2: +(holes.reduce((s, a) => s + a, 0) / 1e6).toFixed(3), largestHoleKm2: +((Math.max(0, ...holes)) / 1e6).toFixed(3) };
console.log('gaps', gaps);

const perDistrict = {};
for (const s of ['school', 'health', 'park']) {
  const pts = read(`facilities_${s}.geojson`).features;
  const counts = districts.map((d) => pts.filter((p) => turf.booleanPointInPolygon(p, d)).length);
  const residential = districts.map((d, i) => ({ d, c: counts[i] })).filter((x) => !x.d.properties.NON_RESIDENTIAL);
  perDistrict[s] = {
    residentialDistrictsWithZero: residential.filter((x) => x.c === 0).length,
    max: Math.max(...counts),
    median: [...counts].sort((a, b) => a - b)[Math.floor(counts.length / 2)],
  };
}
console.log('perDistrict', perDistrict);
writeJson('stats/checks.json', { gaps, perDistrict });
