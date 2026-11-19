import type { FieldProperties } from '@arcgis/core/layers/support/Field.js';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import LabelClass from '@arcgis/core/layers/support/LabelClass.js';
import PopupTemplate from '@arcgis/core/PopupTemplate.js';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer.js';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js';
import TextSymbol from '@arcgis/core/symbols/TextSymbol.js';
import { DistrictProps, FeatureCollection } from '../../core/api/api.types';
import { environment } from '../../../environments/environment';
import { toGraphics } from '../geojson-to-arcgis';
import { tokenColor } from '../map-theme';
import { OSM_ATTRIBUTION } from './attribution';

/** Field schema for the client-side districts layer (names match what renderers / popups / phase 6 use). */
const FIELDS: FieldProperties[] = [
  { name: 'OBJECTID', type: 'oid' },
  { name: 'DISTRICT_CODE', type: 'string', alias: 'رمز الحي' },
  { name: 'OSM_ID', type: 'double' },
  { name: 'NAME_AR', type: 'string', alias: 'الحي' },
  { name: 'NAME_EN', type: 'string', alias: 'District' },
  { name: 'NON_RESIDENTIAL', type: 'small-integer' },
  { name: 'AREA_KM2', type: 'double', alias: 'المساحة (كم²)' },
  // Display-only text for the popup (computed in TypeScript, not Arcade).
  { name: 'NAME_EN_DISPLAY', type: 'string' },
  { name: 'KIND_LABEL', type: 'string' },
  // Filled after an analysis (phase 6); null until then.
  { name: 'COVERAGE_PCT', type: 'double', alias: 'نسبة التغطية %' },
];

/**
 * Neutral look before any analysis. Jeddah's district borders run along the major roads, so a grey outline
 * vanishes into the basemap's grey road casing; the violet accent keeps them visible at street scale.
 * Phase 6 swaps in a class-breaks renderer.
 */
export function neutralDistrictRenderer(): SimpleRenderer {
  return new SimpleRenderer({
    symbol: new SimpleFillSymbol({
      color: tokenColor('--color-text-muted', 0.06),
      outline: { color: tokenColor('--color-accent-strong', 0.75), width: 1.4 },
    }),
  });
}

export function createDistrictLayer(data: FeatureCollection<DistrictProps>): FeatureLayer {
  const source = toGraphics(data.features, (p) => ({
    DISTRICT_CODE: p.districtCode,
    OSM_ID: p.osmId,
    NAME_AR: p.nameAr ?? '',
    NAME_EN: p.nameEn ?? '',
    NON_RESIDENTIAL: p.nonResidential ? 1 : 0,
    AREA_KM2: p.areaKm2,
    COVERAGE_PCT: null,
    NAME_EN_DISPLAY: p.nameEn || '—',
    KIND_LABEL: p.nonResidential ? 'غير سكني (مطار / ميناء / جامعة)' : 'حي سكني',
  }));

  return new FeatureLayer({
    id: 'districts',
    title: 'الأحياء',
    source,
    fields: FIELDS,
    objectIdField: 'OBJECTID',
    geometryType: 'polygon',
    spatialReference: { wkid: 4326 },
    copyright: OSM_ATTRIBUTION,
    renderer: neutralDistrictRenderer(),
    outFields: ['*'],
    labelingInfo: [
      new LabelClass({
        labelExpressionInfo: { expression: '$feature.NAME_AR' },
        minScale: environment.map.districtLabelMinScale,
        labelPlacement: 'always-horizontal',
        symbol: new TextSymbol({
          color: tokenColor('--color-text', 0.92),
          haloColor: tokenColor('--color-bg', 0.85),
          haloSize: 1.2,
          font: { size: 10, weight: 'bold' },
        }),
      }),
    ],
    popupTemplate: new PopupTemplate({
      title: '{NAME_AR}',
      content: [
        {
          type: 'fields',
          fieldInfos: [
            { fieldName: 'NAME_EN_DISPLAY', label: 'الاسم بالإنجليزية' },
            { fieldName: 'KIND_LABEL', label: 'النوع' },
            { fieldName: 'AREA_KM2', label: 'المساحة (كم²)', format: { places: 2, digitSeparator: true } },
            { fieldName: 'DISTRICT_CODE', label: 'الرمز' },
          ],
        },
      ],
    }),
  });
}
