// Step 1 of inspection: which OSM relations are named Jeddah / جدة and are administrative boundaries?
import { runOverpass } from './overpass.mjs';

const q = `
rel["boundary"="administrative"]["name:en"~"^Jeddah",i];
out tags;
rel["boundary"="administrative"]["name"~"^(جدة|جده|محافظة جدة|أمانة جدة)$"];
out tags;
`;
const body = await runOverpass(q, 'inspect_city_candidates');
const seen = new Set();
for (const el of body.elements) {
  if (seen.has(el.id)) continue;
  seen.add(el.id);
  const t = el.tags;
  console.log(`rel ${el.id} | admin_level=${t.admin_level} | name=${t.name} | name:en=${t['name:en'] ?? ''} | place=${t.place ?? ''} | border_type=${t.border_type ?? ''}`);
}
