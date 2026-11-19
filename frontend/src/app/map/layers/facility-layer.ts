import type { FieldProperties } from '@arcgis/core/layers/support/Field.js';
import FeatureReductionCluster from '@arcgis/core/layers/support/FeatureReductionCluster.js';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import LabelClass from '@arcgis/core/layers/support/LabelClass.js';
import PopupTemplate from '@arcgis/core/PopupTemplate.js';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer.js';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol.js';
import TextSymbol from '@arcgis/core/symbols/TextSymbol.js';
import { FacilityProps, FeatureCollection, ServiceType } from '../../core/api/api.types';
import { NO_NAME, SERVICE_LABEL_SINGULAR, SERVICE_LABELS, SUBTYPE_LABELS } from '../../core/labels';
import { environment } from '../../../environments/environment';
import { toGraphics } from '../geojson-to-arcgis';
import { tokenColor } from '../map-theme';
import { OSM_ATTRIBUTION } from './attribution';

const FIELDS: FieldProperties[] = [
  { name: 'OBJECTID', type: 'oid' },
  { name: 'FACILITY_ID', type: 'string' },
  { name: 'OSM_ID', type: 'double' },
  { name: 'OSM_TYPE', type: 'string' },
  { name: 'SERVICE_TYPE', type: 'string', alias: 'الخدمة' },
  { name: 'SUBTYPE', type: 'string' },
  { name: 'NAME_AR', type: 'string' },
  { name: 'NAME_EN', type: 'string' },
  { name: 'DISTRICT_CODE', type: 'string' },
  // Display-only text for the popup, computed in TypeScript from the Arabic label tables.
  { name: 'TITLE', type: 'string' },
  { name: 'SERVICE_LABEL', type: 'string' },
  { name: 'SUBTYPE_LABEL', type: 'string' },
  { name: 'NAME_EN_DISPLAY', type: 'string' },
  { name: 'DISTRICT_LABEL', type: 'string' },
  { name: 'OSM_URL', type: 'string' },
];

/** Distinct SHAPE per service (not only color), so the layer stays readable for colorblind users. */
export const FACILITY_STYLE: Record<ServiceType, { token: string; shape: 'square' | 'diamond' | 'triangle' }> = {
  school: { token: '--facility-school', shape: 'square' },
  health: { token: '--facility-health', shape: 'diamond' },
  park: { token: '--facility-park', shape: 'triangle' },
};

function facilityRenderer(): UniqueValueRenderer {
  return new UniqueValueRenderer({
    field: 'SERVICE_TYPE',
    uniqueValueInfos: (Object.keys(FACILITY_STYLE) as ServiceType[]).map((s) => ({
      value: s,
      label: SERVICE_LABELS[s],
      symbol: new SimpleMarkerSymbol({
        style: FACILITY_STYLE[s].shape,
        color: tokenColor(FACILITY_STYLE[s].token),
        size: s === 'park' ? 9 : 8,
        outline: { color: tokenColor('--color-bg', 0.9), width: 1 },
      }),
    })),
  });
}

/**
 * Clustering when zoomed out: hundreds of overlapping points become counted bubbles, colored by the
 * most common service in each cluster. Below `facilityClusterMaxScale` every facility is drawn on its own.
 */
function facilityClusters(): FeatureReductionCluster {
  return new FeatureReductionCluster({
    clusterRadius: '60px',
    clusterMinSize: '18px',
    clusterMaxSize: '42px',
    maxScale: environment.map.facilityClusterMaxScale,
    labelingInfo: [
      new LabelClass({
        deconflictionStrategy: 'none',
        labelExpressionInfo: { expression: "Text($feature.cluster_count, '#,###')" },
        labelPlacement: 'center-center',
        symbol: new TextSymbol({ color: tokenColor('--color-bg'), font: { size: 10, weight: 'bold' } }),
      }),
    ],
    popupTemplate: new PopupTemplate({ title: 'مجموعة مرافق', content: 'عدد المرافق: {cluster_count}. قرّب الخريطة لرؤيتها منفصلة.' }),
  });
}

/**
 * @param districtNames DISTRICT_CODE -> Arabic name, so the popup can name the district the facility is in.
 */
export function createFacilityLayer(data: FeatureCollection<FacilityProps>, districtNames: Map<string, string>): FeatureLayer {
  const source = toGraphics(data.features, (p) => ({
    FACILITY_ID: p.facilityId,
    OSM_ID: p.osmId,
    OSM_TYPE: p.osmType,
    SERVICE_TYPE: p.serviceType,
    SUBTYPE: p.subtype ?? '',
    NAME_AR: p.nameAr ?? '',
    NAME_EN: p.nameEn ?? '',
    DISTRICT_CODE: p.districtCode ?? '',
    TITLE: p.nameAr || p.nameEn || NO_NAME,
    SERVICE_LABEL: SERVICE_LABEL_SINGULAR[p.serviceType],
    SUBTYPE_LABEL: (p.subtype && SUBTYPE_LABELS[p.subtype]) || p.subtype || '—',
    NAME_EN_DISPLAY: p.nameEn || '—',
    DISTRICT_LABEL: p.districtCode ? (districtNames.get(p.districtCode) ?? p.districtCode) : 'خارج حدود الأحياء (ضمن 1 كم)',
    OSM_URL: `https://www.openstreetmap.org/${p.osmType}/${p.osmId}`,
  }));

  return new FeatureLayer({
    id: 'facilities',
    title: 'المرافق',
    source,
    fields: FIELDS,
    objectIdField: 'OBJECTID',
    geometryType: 'point',
    spatialReference: { wkid: 4326 },
    copyright: OSM_ATTRIBUTION,
    renderer: facilityRenderer(),
    featureReduction: facilityClusters(),
    outFields: ['*'],
    popupTemplate: new PopupTemplate({
      title: '{TITLE}',
      content: [
        {
          type: 'fields',
          fieldInfos: [
            { fieldName: 'SERVICE_LABEL', label: 'الخدمة' },
            { fieldName: 'SUBTYPE_LABEL', label: 'النوع في OSM' },
            { fieldName: 'NAME_EN_DISPLAY', label: 'الاسم بالإنجليزية' },
            { fieldName: 'DISTRICT_LABEL', label: 'الحي' },
            { fieldName: 'OSM_URL', label: 'المصدر (OSM)' },
          ],
        },
      ],
    }),
  });
}

/** Show only the selected services (client-side filter, no new request). */
export function setVisibleServices(layer: FeatureLayer, services: ServiceType[]): void {
  layer.definitionExpression = services.length
    ? `SERVICE_TYPE IN (${services.map((s) => `'${s}'`).join(', ')})`
    : '1 = 0';
}
