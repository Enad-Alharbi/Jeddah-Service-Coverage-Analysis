// Raw facilities -> data/processed/facilities_<service>.geojson (points, WGS84)
// 1. osmtogeojson  2. areas -> ONE point via point-on-surface  3. dedupe  4. keep within reach of a district
import fs from 'node:fs';
import osmtogeojson from 'osmtogeojson';
import * as turf from '@turf/turf';
import { facilities as cfg, paths } from './config.mjs';
import { latestRaw, osmNames, writeJson } from './geo-utils.mjs';

const districts = JSON.parse(fs.readFileSync(`${paths.processed}/jeddah_districts.geojson`, 'utf8')).features;
const dBoxes = districts.map((d) => turf.bbox(d));
const allStats = {};

for (const service of Object.keys(cfg.services)) {
  const { body, date } = latestRaw(`facilities_${service}`);
  const all = osmtogeojson(body).features.filter((f) => f.properties && hasServiceTag(service, f.properties));
  // An open way can't be a facility area (OSM mapping error, e.g. a 2-node line tagged school): excluded + reported.
  const invalid = all.filter((f) => f.geometry.type === 'LineString');
  const raw = all.filter((f) => f.geometry.type !== 'LineString');
  const stats = {
    fetchDate: date,
    osmSnapshot: body.osm3s?.timestamp_osm_base,
    rawElements: body.elements.length,
    features: all.length,
    excludedOpenWays: invalid.map((f) => ({ id: f.id, name: f.properties.name ?? '', nodes: f.geometry.coordinates.length })),
  };

  // ---- 1+2: one point per OSM object ----
  // Point-on-surface (not centroid): the centroid of an L- or U-shaped campus/park can fall OUTSIDE the
  // shape; pointOnFeature guarantees a point that lies on the polygon itself.
  const items = raw.map((f) => {
    const [osmType, osmId] = f.id.split('/');
    const isArea = /Polygon/.test(f.geometry.type);
    const point = f.geometry.type === 'Point' ? f : turf.pointOnFeature(f);
    if (isArea && !turf.booleanPointInPolygon(point, f)) throw new Error(`point-on-surface outside ${f.id}`);
    const names = osmNames(f.properties);
    return { f, osmType, osmId: Number(osmId), isArea, point, names, name: names.ar || names.en, areaM2: isArea ? turf.area(f) : 0 };
  });
  stats.byGeometry = countBy(items, (i) => `${i.osmType}/${i.f.geometry.type}`);
  stats.pointOnSurfaceDiffersFromCentroid = items.filter((i) => i.isArea && !turf.booleanPointInPolygon(turf.centroid(i.f), i.f)).length;

  // ---- 3: dedupe ----
  // (a) the same object matched twice (amenity + healthcare tags) is impossible here: one query, unique ids.
  // (b) a node (or smaller area) INSIDE an area of the same service with the same name (or one side unnamed)
  //     is the same facility mapped twice -> keep the larger area.
  const areas = items.filter((i) => i.isArea).sort((a, b) => b.areaM2 - a.areaM2);
  const dropped = [];
  const kept = items.filter((i) => {
    const container = areas.find(
      (a) => a !== i && a.areaM2 > i.areaM2 && turf.booleanPointInPolygon(i.point, a.f) && sameFacilityName(a.name, i.name),
    );
    if (container) {
      dropped.push({ id: `${i.osmType}/${i.osmId}`, name: i.name, insideOf: `${container.osmType}/${container.osmId}`, containerName: container.name });
      // Unnamed area + named node for the same facility: the area keeps the node's OSM names.
      if (!container.name && i.name) {
        container.name = i.name;
        container.names = i.names;
        container.nameFrom = `${i.osmType}/${i.osmId}`;
      }
    }
    return !container;
  });
  stats.duplicatesRemoved = dropped.length;
  stats.duplicates = dropped;

  // ---- 4: keep facilities inside a district or within reach of one ----
  const out = [];
  let outsideButNear = 0;
  let tooFar = 0;
  for (const i of kept) {
    const [x, y] = i.point.geometry.coordinates;
    const host = districts.find((d, k) => x >= dBoxes[k][0] && x <= dBoxes[k][2] && y >= dBoxes[k][1] && y <= dBoxes[k][3] && turf.booleanPointInPolygon(i.point, d));
    if (!host) {
      const dist = Math.min(...districts.map((d) => turf.pointToPolygonDistance(i.point, d, { units: 'meters' })));
      if (dist > cfg.maxDistanceM) { tooFar++; continue; }
      outsideButNear++;
    }
    const t = i.f.properties;
    out.push(
      turf.point([+x.toFixed(7), +y.toFixed(7)], {
        FACILITY_ID: `${service}-${i.osmType[0]}${i.osmId}`,
        OSM_ID: i.osmId,
        OSM_TYPE: i.osmType,
        SERVICE_TYPE: service,
        SUBTYPE: subtype(service, t),
        NAME_AR: i.names.ar,
        NAME_EN: i.names.en,
        GEOM_ORIGIN: i.isArea ? 'point_on_surface' : 'node',
        IN_DISTRICT: host ? 1 : 0, // preliminary; the authoritative spatial join is done in Oracle
      }),
    );
  }
  stats.outsideDistrictsWithinReach = outsideButNear;
  stats.droppedTooFar = tooFar;
  stats.final = out.length;
  stats.bySubtype = countBy(out, (p) => p.properties.SUBTYPE);
  stats.withoutAnyName = out.filter((p) => !p.properties.NAME_AR && !p.properties.NAME_EN).length;
  stats.withoutNameAr = out.filter((p) => !p.properties.NAME_AR).length;
  stats.withoutNameEn = out.filter((p) => !p.properties.NAME_EN).length;
  stats.byGeomOrigin = countBy(out, (p) => p.properties.GEOM_ORIGIN);
  allStats[service] = stats;

  console.log(service, JSON.stringify({ ...stats, duplicates: undefined }));
  writeJson(`facilities_${service}.geojson`, turf.featureCollection(out));
}
writeJson('stats/facilities.json', allStats);

function hasServiceTag(service, t) {
  if (service === 'school') return t.amenity === 'school';
  if (service === 'park') return t.leisure === 'park';
  return /^(hospital|clinic|doctors)$/.test(t.amenity ?? '') || /^(hospital|clinic|doctor|centre)$/.test(t.healthcare ?? '');
}
function subtype(service, t) {
  if (service === 'health') return /^(hospital|clinic|doctors)$/.test(t.amenity ?? '') ? t.amenity : `healthcare:${t.healthcare}`;
  return service === 'school' ? t.amenity : t.leisure;
}
function sameFacilityName(a, b) {
  return !a || !b || a.trim() === b.trim();
}
function countBy(arr, key) {
  return arr.reduce((acc, x) => ((acc[key(x)] = (acc[key(x)] ?? 0) + 1), acc), {});
}
