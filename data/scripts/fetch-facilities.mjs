// Fetch schools / health / parks with full geometry (areas are needed for point-on-surface).
// One Overpass query per service, sequential (Overpass etiquette).
import fs from 'node:fs';
import * as turf from '@turf/turf';
import { facilities, paths } from './config.mjs';
import { runOverpass } from './overpass.mjs';

const districts = JSON.parse(fs.readFileSync(`${paths.processed}/jeddah_districts.geojson`, 'utf8'));
const [w, s, e, n] = turf.bbox(turf.buffer(turf.bboxPolygon(turf.bbox(districts)), facilities.searchMarginKm, { units: 'kilometers' }));
const bb = `${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)}`;

for (const [service, filters] of Object.entries(facilities.services)) {
  const union = filters.map((f) => `  nwr${f}(${bb});`).join('\n');
  console.log(`fetching ${service}…`);
  const body = await runOverpass(`(\n${union}\n);\nout geom;`, `facilities_${service}`);
  console.log(`  ${body.elements.length} elements`);
}
