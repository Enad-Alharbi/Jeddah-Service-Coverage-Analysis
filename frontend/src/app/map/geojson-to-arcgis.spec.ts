import type Point from '@arcgis/core/geometry/Point.js';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import { toArcgisGeometry } from './geojson-to-arcgis';

// A ~1 km square in Jeddah, GeoJSON style: exterior ring COUNTER-clockwise, one clockwise hole.
const exterior: [number, number][] = [
  [39.17, 21.56], [39.18, 21.56], [39.18, 21.57], [39.17, 21.57], [39.17, 21.56],
];
const hole: [number, number][] = [
  [39.174, 21.564], [39.174, 21.566], [39.176, 21.566], [39.176, 21.564], [39.174, 21.564],
];

describe('toArcgisGeometry', () => {
  it('reverses GeoJSON rings so the exterior is clockwise and the hole counter-clockwise (Esri convention)', () => {
    const p = toArcgisGeometry({ type: 'Polygon', coordinates: [exterior, hole] }) as Polygon;
    expect(p.spatialReference.wkid).toBe(4326);
    expect(p.rings.length).toBe(2);
    expect(p.isClockwise(p.rings[0])).toBe(true);
    expect(p.isClockwise(p.rings[1])).toBe(false);
  });

  it('flattens a MultiPolygon into one Esri polygon with all parts as rings', () => {
    const shifted = exterior.map(([x, y]) => [x + 0.05, y] as [number, number]);
    const p = toArcgisGeometry({ type: 'MultiPolygon', coordinates: [[exterior], [shifted]] }) as Polygon;
    expect(p.rings.length).toBe(2);
    expect(p.rings.every((r) => p.isClockwise(r))).toBe(true);
  });

  it('builds points as WGS84 lon/lat and returns null for a missing geometry', () => {
    const pt = toArcgisGeometry({ type: 'Point', coordinates: [39.1837, 21.5718] }) as Point;
    expect(pt.longitude).toBeCloseTo(39.1837, 6);
    expect(pt.latitude).toBeCloseTo(21.5718, 6);
    expect(toArcgisGeometry(null)).toBeNull();
  });
});
