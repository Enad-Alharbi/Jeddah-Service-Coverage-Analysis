import Point from '@arcgis/core/geometry/Point.js';
import Polygon from '@arcgis/core/geometry/Polygon.js';
import { geodeticAreaExecute } from '@arcgis/core/geometry/operators/geodeticAreaOperator.js';
import { computeWhatIf, loadWhatIfOperators } from './what-if';

// A 2 km x 2 km "district" around a point in Jeddah (Esri ring order: clockwise exterior).
const W = 39.17, E = 39.1893, S = 21.56, N = 21.578;
const district = new Polygon({
  rings: [[[W, S], [W, N], [E, N], [E, S], [W, S]]],
  spatialReference: { wkid: 4326 },
});
const center = new Point({ longitude: (W + E) / 2, latitude: (S + N) / 2, spatialReference: { wkid: 4326 } });

describe('computeWhatIf (browser geodesic operators)', () => {
  beforeAll(async () => {
    await loadWhatIfOperators();
  });

  it('an empty district gains the area of one walking-distance circle (π r²), clipped to the district', () => {
    const r = computeWhatIf({
      clickPoint: center,
      district,
      covered: null,
      distanceM: 500,
      serverBeforePct: 0,
      districtAreaKm2: geodeticAreaExecute(district, { unit: 'square-kilometers' }),
    })!;

    // A 500 m circle lies fully inside the ~2 km square: gain = π · 0.5² ≈ 0.785 km².
    expect(r.gainKm2).toBeCloseTo(Math.PI * 0.25, 2);
    expect(r.beforePct).toBe(0);
    expect(r.afterPct).toBeCloseTo(r.deltaPct, 6);
  });

  it('adds nothing when the site is inside an area that is already covered', () => {
    const r = computeWhatIf({
      clickPoint: center,
      district,
      covered: district, // fully covered already
      distanceM: 800,
      serverBeforePct: 100,
      districtAreaKm2: 4,
    })!;
    expect(r.deltaPct).toBeCloseTo(0, 6);
    expect(r.afterPct).toBe(100);
  });
});
