// Inspection: which tag values exist for schools / health / parks around Jeddah, and how many of each.
import * as turf from '@turf/turf';
import fs from 'node:fs';
import { runOverpass } from './overpass.mjs';

const districts = JSON.parse(fs.readFileSync('../processed/jeddah_districts.geojson', 'utf8'));
const [w, s, e, n] = turf.bbox(turf.buffer(turf.bboxPolygon(turf.bbox(districts)), 1.2, { units: 'kilometers' }));
const bb = `${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)}`;
console.log('search bbox (S,W,N,E):', bb);

const q = `
(
  nwr["amenity"~"^(school|kindergarten|college|university|hospital|clinic|doctors|dentist|pharmacy)$"](${bb});
  nwr["healthcare"](${bb});
  nwr["leisure"~"^(park|garden|playground|recreation_ground|nature_reserve)$"](${bb});
);
out tags;
`;
const body = await runOverpass(q, 'inspect_facility_tags');
const count = {};
const add = (k) => (count[k] = (count[k] ?? 0) + 1);
for (const el of body.elements) {
  const t = el.tags ?? {};
  if (t.amenity) add(`amenity=${t.amenity} (${el.type})`);
  if (t.healthcare) add(`healthcare=${t.healthcare}`);
  if (t.leisure) add(`leisure=${t.leisure} (${el.type})`);
  if (t.amenity === 'school' && t['isced:level']) add(`  school isced:level=${t['isced:level']}`);
  if (t.leisure === 'garden' && t.garden_type) add(`  garden_type=${t.garden_type}`);
  if (t.leisure === 'garden' && t.access) add(`  garden access=${t.access}`);
  if (t.leisure === 'park' && t.access) add(`  park access=${t.access}`);
}
Object.entries(count).sort().forEach(([k, v]) => console.log(String(v).padStart(5), k));
