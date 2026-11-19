import type { FieldProperties } from '@arcgis/core/layers/support/Field.js';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer.js';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer.js';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js';
import { CoverageResponse, DistrictCoverage, GeoJsonGeometry } from '../../core/api/api.types';
import { COVERAGE_CLASSES } from '../../core/coverage-class';
import { toGraphics } from '../geojson-to-arcgis';
import { tokenColor } from '../map-theme';
import { OSM_ATTRIBUTION } from './attribution';

const FIELDS: FieldProperties[] = [
  { name: 'OBJECTID', type: 'oid' },
  { name: 'DISTRICT_CODE', type: 'string' },
  { name: 'NAME_AR', type: 'string' },
];

/**
 * Districts colored by COVERAGE_PCT in three classes (< 50 coral, 50–80 amber, >= 80 cyan).
 * Non-residential units (airport, seaport, universities) get no value, so they fall back to the neutral default symbol.
 */
export function coverageClassBreaksRenderer(): ClassBreaksRenderer {
  return new ClassBreaksRenderer({
    valueExpression: 'IIf($feature.NON_RESIDENTIAL == 1, null, $feature.COVERAGE_PCT)',
    valueExpressionTitle: 'نسبة التغطية %',
    classBreakInfos: COVERAGE_CLASSES.map((c) => ({
      // The last class must include exactly 100; ArcGIS includes the upper bound of each break.
      minValue: c.min,
      maxValue: c.key === 'high' ? 100 : c.max - 0.0001,
      label: c.label,
      symbol: new SimpleFillSymbol({
        color: tokenColor(c.token, 0.32),
        outline: { color: tokenColor(c.token, 0.9), width: 1 },
      }),
    })),
    defaultLabel: 'غير سكني',
    defaultSymbol: new SimpleFillSymbol({
      color: tokenColor('--color-text-muted', 0.05),
      outline: { color: tokenColor('--color-text-muted', 0.5), width: 0.8, style: 'dash' },
    }),
  });
}

function polygonLayer(id: string, title: string, rows: DistrictCoverage[], pick: (d: DistrictCoverage) => GeoJsonGeometry | null, renderer: SimpleRenderer): FeatureLayer {
  const features = rows.map((d) => ({ type: 'Feature' as const, properties: d, geometry: pick(d) }));
  return new FeatureLayer({
    id,
    title,
    source: toGraphics(features, (d) => ({ DISTRICT_CODE: d.districtCode, NAME_AR: d.nameAr ?? '' })),
    fields: FIELDS,
    objectIdField: 'OBJECTID',
    geometryType: 'polygon',
    spatialReference: { wkid: 4326 },
    copyright: OSM_ATTRIBUTION,
    renderer,
    popupEnabled: false, // clicks fall through to the district selection
  });
}

/**
 * Covered = union of walking-distance buffers clipped to each district (computed in Oracle).
 * Uncovered = district minus that union. Non-residential units are left out (no residents to serve).
 */
export function createCoverageLayers(result: CoverageResponse): { covered: FeatureLayer; uncovered: FeatureLayer } {
  const residential = result.districts.filter((d) => !d.nonResidential);

  const covered = polygonLayer('covered', 'المناطق المغطاة', residential, (d) => d.coveredGeom,
    new SimpleRenderer({
      symbol: new SimpleFillSymbol({ color: tokenColor('--coverage-high', 0.18), outline: { color: tokenColor('--coverage-high', 0), width: 0 } }),
    }));

  // Diagonal hatch: uncovered areas stay readable on top of the class colors and for colorblind users.
  const uncovered = polygonLayer('uncovered', 'المناطق غير المغطاة', residential, (d) => d.uncoveredGeom,
    new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        style: 'backward-diagonal',
        // No outline and a lighter hatch: the district's class color stays readable underneath.
        color: tokenColor('--coverage-low', 0.6),
        outline: { color: tokenColor('--coverage-low', 0), width: 0 },
      }),
    }));

  return { covered, uncovered };
}
