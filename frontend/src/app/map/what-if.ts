import type Point from '@arcgis/core/geometry/Point.js';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import SpatialReference from '@arcgis/core/geometry/SpatialReference.js';
import { geodesicBufferExecute, geodesicBufferIsLoaded, geodesicBufferLoad } from '@arcgis/core/geometry/operators/geodesicBufferOperator.js';
import { geodeticAreaExecute, geodeticAreaIsLoaded, geodeticAreaLoad } from '@arcgis/core/geometry/operators/geodeticAreaOperator.js';
import { intersectionExecute } from '@arcgis/core/geometry/operators/intersectionOperator.js';
import { projectExecute, projectIsLoaded, projectLoad } from '@arcgis/core/geometry/operators/projectOperator.js';
import { unionExecute } from '@arcgis/core/geometry/operators/unionOperator.js';

const WGS84 = SpatialReference.WGS84;

/** Same densification as the server (arc_tolerance 0.25 m in COVERAGE_PKG), so both sides draw the same circle. */
const MAX_DEVIATION_M = 0.25;

export interface WhatIfInput {
  /** Where the planner clicked: a map point in the VIEW's spatial reference (Web Mercator). */
  clickPoint: Point;
  /** The district polygon in WGS84. */
  district: Polygon;
  /** Current covered part of that district (from the API) in WGS84, or null when nothing covers it. */
  covered: Polygon | null;
  distanceM: number;
  /** Server values from the cached analysis: the "before" the planner already sees in the table. */
  serverBeforePct: number;
  districtAreaKm2: number;
}

export interface WhatIfResult {
  site: Point; // WGS84
  buffer: Polygon; // WGS84 geodesic circle
  beforePct: number;
  afterPct: number;
  deltaPct: number;
  gainKm2: number;
}

/** Operators that need their engine loaded once before the first call. */
export async function loadWhatIfOperators(): Promise<void> {
  await Promise.all([
    geodesicBufferIsLoaded() ? null : geodesicBufferLoad(),
    geodeticAreaIsLoaded() ? null : geodeticAreaLoad(),
    projectIsLoaded() ? null : projectLoad(),
  ]);
}

/**
 * What-if in the browser, instant (no request):
 *   1. project the click to WGS84 so EVERY operator input shares one spatial reference
 *      (mixing Web Mercator meters with lon/lat degrees would produce nonsense shapes);
 *   2. geodesic buffer of the walking distance around the site (true meters on the ellipsoid);
 *   3. union with the district's current covered part, intersect with the district;
 *   4. geodetic area -> new coverage %.
 *
 * The delta is computed with the same browser method for "before" and "after", then added to the server's
 * "before", so small method differences (UTM vs geodesic, 2 m display simplification) cancel out.
 */
export function computeWhatIf(input: WhatIfInput): WhatIfResult | null {
  const site = projectExecute(input.clickPoint, WGS84) as Point | null;
  if (!site) return null;

  const buffer = geodesicBufferExecute(site, input.distanceM, { unit: 'meters', maxDeviation: MAX_DEVIATION_M });
  if (!buffer) return null;

  const districtArea = geodeticAreaExecute(input.district, { unit: 'square-kilometers' });
  if (!districtArea) return null;

  const coveredBefore = input.covered ? (intersectionExecute(input.covered, input.district) as Polygon | null) : null;
  const unioned = input.covered ? (unionExecute(input.covered, buffer) as Polygon | null) : buffer;
  const coveredAfter = unioned ? (intersectionExecute(unioned, input.district) as Polygon | null) : null;

  const areaOf = (g: Polygon | null) => (g ? geodeticAreaExecute(g, { unit: 'square-kilometers' }) : 0);
  const clientBefore = (100 * areaOf(coveredBefore)) / districtArea;
  const clientAfter = (100 * areaOf(coveredAfter)) / districtArea;

  const deltaPct = Math.max(0, clientAfter - clientBefore);
  const afterPct = Math.min(100, input.serverBeforePct + deltaPct);
  return {
    site,
    buffer,
    beforePct: input.serverBeforePct,
    afterPct,
    deltaPct: afterPct - input.serverBeforePct,
    // Same convention as the server cache: km2 = coverage ratio x the district's ellipsoidal area.
    gainKm2: ((afterPct - input.serverBeforePct) / 100) * input.districtAreaKm2,
  };
}
