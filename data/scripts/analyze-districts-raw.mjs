// Inspection only (no output files): geometry sanity of the raw district relations.
// - every relation builds a polygon?  - inside the governorate?  - overlaps between districts?
// - how much of the governorate is NOT covered by any district (gaps / unmapped land)?
import fs from 'node:fs';
import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';

const file = process.argv[2];
const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
const gj = osmtogeojson(raw);
const polys = gj.features.filter((f) => f.id?.startsWith('relation/') && /Polygon/.test(f.geometry.type));

const gov = polys.find((f) => f.properties.admin_level === '6');
const districts = polys.filter((f) => f.properties.admin_level === '10');
const relIds = raw.elements.filter((e) => e.type === 'relation' && e.tags.admin_level === '10').map((e) => e.id);
console.log(`relations: ${relIds.length}, built polygons: ${districts.length}`);
const missing = relIds.filter((id) => !districts.some((d) => d.id === `relation/${id}`));
if (missing.length) console.log('could not build:', missing);

const km2 = (f) => turf.area(f) / 1e6;
console.log(`governorate area: ${km2(gov).toFixed(1)} km²`);

// Inside the governorate?
const outside = [];
for (const d of districts) {
  const inter = turf.intersect(turf.featureCollection([d, gov]));
  const frac = inter ? turf.area(inter) / turf.area(d) : 0;
  if (frac < 0.95) outside.push(`${d.id} ${d.properties.name} inside=${(frac * 100).toFixed(1)}%`);
}
console.log(`districts <95% inside governorate: ${outside.length}`, outside);

// Pairwise overlaps (bbox prefilter).
const boxes = districts.map((d) => turf.bbox(d));
const hit = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const overlaps = [];
for (let i = 0; i < districts.length; i++)
  for (let j = i + 1; j < districts.length; j++) {
    if (!hit(boxes[i], boxes[j])) continue;
    const inter = turf.intersect(turf.featureCollection([districts[i], districts[j]]));
    if (!inter) continue;
    const a = km2(inter);
    if (a > 0.001) overlaps.push({ a: districts[i].properties.name, b: districts[j].properties.name, ids: [districts[i].id, districts[j].id], km2: +a.toFixed(4), pctOfSmaller: +((100 * a) / Math.min(km2(districts[i]), km2(districts[j]))).toFixed(1) });
  }
console.log(`overlapping pairs (>0.001 km²): ${overlaps.length}`);
overlaps.sort((x, y) => y.km2 - x.km2).slice(0, 15).forEach((o) => console.log('  ', JSON.stringify(o)));

// Coverage of the governorate by districts.
const union = districts.reduce((acc, d) => (acc ? turf.union(turf.featureCollection([acc, d])) : d), null);
const sum = districts.reduce((s, d) => s + km2(d), 0);
console.log(`sum of district areas: ${sum.toFixed(1)} km², union: ${km2(union).toFixed(1)} km²`);
console.log(`share of governorate covered by districts: ${((100 * km2(union)) / km2(gov)).toFixed(1)}%`);

const sizes = districts.map((d) => ({ n: d.properties.name, id: d.id, a: km2(d) })).sort((x, y) => y.a - x.a);
console.log('largest:', sizes.slice(0, 5).map((s) => `${s.n} ${s.a.toFixed(1)}`).join(' | '));
console.log('smallest:', sizes.slice(-5).map((s) => `${s.n} ${s.a.toFixed(3)}`).join(' | '));
const bb = turf.bbox(turf.featureCollection(districts));
console.log('districts extent (minX,minY,maxX,maxY):', bb.map((v) => v.toFixed(4)).join(', '));
