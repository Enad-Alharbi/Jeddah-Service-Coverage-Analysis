// Step 2 of inspection: inside the Jeddah governorate (rel 12429519), which admin levels exist,
// how many relations per level, and do the known districts appear?
import { runOverpass } from './overpass.mjs';

const GOVERNORATE_REL = Number(process.argv[2] ?? 12429519);

const q = `
rel(${GOVERNORATE_REL});
map_to_area->.gov;
rel["boundary"="administrative"](area.gov);
out tags;
`;
const body = await runOverpass(q, 'inspect_admin_levels');

const byLevel = new Map();
for (const el of body.elements) {
  const lvl = el.tags.admin_level ?? '(none)';
  if (!byLevel.has(lvl)) byLevel.set(lvl, []);
  byLevel.get(lvl).push(el);
}

for (const [lvl, els] of [...byLevel].sort()) {
  console.log(`\nadmin_level=${lvl}: ${els.length} relations`);
  for (const el of els.slice(0, 8)) {
    console.log(`  rel ${el.id} | ${el.tags.name} | ${el.tags['name:en'] ?? ''}`);
  }
}

// Spot-check: known Jeddah districts from the brief.
const known = ['الروضة', 'الصفا', 'السلامة', 'النعيم', 'الحمراء'];
console.log('\nSpot-check:');
for (const name of known) {
  const hits = body.elements.filter((e) => (e.tags.name ?? '').includes(name) || (e.tags['name:ar'] ?? '').includes(name));
  console.log(`  ${name}: ${hits.length ? hits.map((h) => `rel ${h.id} lvl ${h.tags.admin_level} "${h.tags.name}"`).join('; ') : 'NOT FOUND'}`);
}
