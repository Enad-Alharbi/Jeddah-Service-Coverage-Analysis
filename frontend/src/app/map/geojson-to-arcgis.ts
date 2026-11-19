import Graphic from '@arcgis/core/Graphic.js';
import Point from '@arcgis/core/geometry/Point.js';
import Polygon from '@arcgis/core/geometry/Polygon.js';
import { Feature, GeoJsonGeometry, Position } from '../core/api/api.types';

const WGS84 = { wkid: 4326 };

/**
 * GeoJSON (RFC 7946) and Esri geometry use OPPOSITE ring orientation:
 *   GeoJSON: exterior ring counter-clockwise, holes clockwise.
 *   Esri:    exterior ring CLOCKWISE, holes counter-clockwise.
 * Reversing every ring converts one convention into the other, so rendering and the
 * geometry operators (union / intersection / area in phase 7) see exteriors and holes correctly.
 */
const toEsriRing = (ring: Position[]): number[][] => [...ring].reverse();

export function toArcgisGeometry(g: GeoJsonGeometry | null): Point | Polygon | null {
  if (!g) return null;
  switch (g.type) {
    case 'Point':
      return new Point({ longitude: g.coordinates[0], latitude: g.coordinates[1], spatialReference: WGS84 });
    case 'Polygon':
      return new Polygon({ rings: g.coordinates.map(toEsriRing), spatialReference: WGS84 });
    case 'MultiPolygon':
      // An Esri Polygon holds any number of rings, so a multipolygon is all its parts' rings together.
      return new Polygon({ rings: g.coordinates.flatMap((poly) => poly.map(toEsriRing)), spatialReference: WGS84 });
  }
}

/**
 * GeoJSON features -> Graphics for a client-side FeatureLayer.
 * `toAttributes` maps API properties to the layer's field names; an OBJECTID is added (required by FeatureLayer).
 */
export function toGraphics<P>(features: Feature<P>[], toAttributes: (p: P) => Record<string, unknown>): Graphic[] {
  return features
    .map((f, i) => ({ geometry: toArcgisGeometry(f.geometry), attributes: { OBJECTID: i + 1, ...toAttributes(f.properties) } }))
    .filter((g) => g.geometry !== null)
    .map((g) => new Graphic({ geometry: g.geometry!, attributes: g.attributes }));
}
