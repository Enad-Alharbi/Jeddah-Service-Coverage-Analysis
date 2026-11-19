// Inspection: admin_level 6 and 10 relations in a box slightly larger than the districts' extent,
// to (1) see which governorate the out-of-boundary districts fall in, (2) find level-10 relations we missed.
import fs from 'node:fs';
import { runOverpass } from './overpass.mjs';
import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';

const [minX, minY, maxX, maxY] = [38.85, 20.95, 39.55, 22.1]; // inspection box only, derived from the extent printed earlier
const q = `
rel["boundary"="administrative"]["admin_level"~"^(6|10)$"](${minY},${minX},${maxY},${maxX});
out geom;
`;
const raw = await runOverpass(q, 'inspect_neighbours');
const known = new Set(JSON.parse(fs.readFileSync('../raw/inspect_admin_levels_2026-11-15.json', 'utf8')).elements.map((e) => e.id));

const gj = osmtogeojson(raw).features.filter((f) => f.id?.startsWith('relation/') && /Polygon/.test(f.geometry.type));
const govs = gj.filter((f) => f.properties.admin_level === '6');
console.log('governorates in box:', govs.map((g) => `${g.id} ${g.properties.name}`).join(' | '));

const lvl10 = gj.filter((f) => f.properties.admin_level === '10');
const extra = lvl10.filter((f) => !known.has(Number(f.id.split('/')[1])));
console.log(`\nlevel-10 relations in box: ${lvl10.length}, NOT in our 156: ${extra.length}`);
for (const f of extra) {
  const share = govs.map((g) => {
    const i = turf.intersect(turf.featureCollection([f, g]));
    return i ? `${g.properties.name} ${((100 * turf.area(i)) / turf.area(f)).toFixed(0)}%` : null;
  }).filter(Boolean);
  console.log(`  ${f.id} ${f.properties.name} | ${f.properties['name:en'] ?? ''} | ${(turf.area(f) / 1e6).toFixed(1)} km² | in: ${share.join(', ') || 'no governorate'}`);
}

const outsideIds = [19268639, 20039255, 20039258, 20039261, 20039283, 20039285, 20039291, 20039318, 20039322, 20039337, 20039340, 20039341, 20039342, 20039344];
console.log('\nwhere the 14 partial districts fall:');
for (const id of outsideIds) {
  const f = lvl10.find((x) => x.id === `relation/${id}`);
  if (!f) { console.log(`  ${id}: not in box result`); continue; }
  const share = govs.map((g) => {
    const i = turf.intersect(turf.featureCollection([f, g]));
    return i ? `${g.properties.name} ${((100 * turf.area(i)) / turf.area(f)).toFixed(0)}%` : null;
  }).filter(Boolean);
  console.log(`  ${id} ${f.properties.name}: ${share.join(', ')}`);
}
