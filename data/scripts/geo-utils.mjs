// Small geometry helpers shared by the processing scripts.
import fs from 'node:fs';
import path from 'node:path';
import * as turf from '@turf/turf';
import { paths } from './config.mjs';

export const km2 = (f) => turf.area(f) / 1e6;

const hasArabic = (s) => /[؀-ۿ]/.test(s ?? '');

/**
 * OSM names -> { ar, en }. `name:ar` / `name:en` win; the plain `name` fills whichever slot matches
 * its script (Arabic -> ar, otherwise -> en). Nothing is translated or transliterated.
 */
export function osmNames(t) {
  const name = (t.name ?? '').trim();
  return {
    ar: (t['name:ar'] ?? '').trim() || (hasArabic(name) ? name : ''),
    en: (t['name:en'] ?? '').trim() || (name && !hasArabic(name) ? name : ''),
  };
}

/** Latest raw dump for a base name, e.g. latestRaw('districts') -> data/raw/districts_2026-11-15.json */
export function latestRaw(baseName) {
  const files = fs.readdirSync(paths.raw).filter((f) => new RegExp(`^${baseName}_\\d{4}-\\d{2}-\\d{2}\\.json$`).test(f)).sort();
  if (!files.length) throw new Error(`No raw file for ${baseName}. Run the fetch script first.`);
  const file = path.join(paths.raw, files.at(-1));
  return { file, date: files.at(-1).match(/\d{4}-\d{2}-\d{2}/)[0], body: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

export function writeJson(relPath, data) {
  const file = path.join(paths.processed, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, relPath.endsWith('.geojson') ? 0 : 2));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}

/** Exterior ring counter-clockwise? (RFC 7946 and Oracle both expect CCW exterior, CW holes.) */
const ringIsCcw = (ring) => {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) s += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
  return s < 0;
};

/** Returns a list of problems for a (Multi)Polygon feature; empty list = valid. */
export function polygonProblems(f) {
  const problems = [];
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  polys.forEach((rings, p) =>
    rings.forEach((ring, r) => {
      const [a, b] = [ring[0], ring.at(-1)];
      if (a[0] !== b[0] || a[1] !== b[1]) problems.push(`poly ${p} ring ${r} not closed`);
      if (ring.length < 4) problems.push(`poly ${p} ring ${r} has < 4 points`);
      if (ringIsCcw(ring) !== (r === 0)) problems.push(`poly ${p} ring ${r} wrong orientation`);
    }),
  );
  const kinks = turf.kinks(f).features.length;
  if (kinks) problems.push(`${kinks} self-intersection point(s)`);
  return problems;
}
