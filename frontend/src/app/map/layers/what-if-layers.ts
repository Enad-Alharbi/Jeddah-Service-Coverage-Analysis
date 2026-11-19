import Graphic from '@arcgis/core/Graphic.js';
import Point from '@arcgis/core/geometry/Point.js';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import PopupTemplate from '@arcgis/core/PopupTemplate.js';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js';
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol.js';
import { Proposal } from '../../core/api/api.types';
import { SERVICE_LABEL_SINGULAR } from '../../core/labels';
import { tokenColor } from '../map-theme';

/**
 * GraphicsLayers for temporary, session-only drawings (not data layers):
 * the current what-if trial (site + its walking-distance circle) and the saved proposals.
 */
export function createWhatIfLayer(): GraphicsLayer {
  return new GraphicsLayer({ id: 'what-if', title: 'الاقتراح الحالي', listMode: 'hide' });
}

export function createProposalsLayer(): GraphicsLayer {
  return new GraphicsLayer({ id: 'proposals', title: 'المواقع المقترحة المحفوظة' });
}

export function trialGraphics(site: Point, buffer: Polygon): Graphic[] {
  return [
    new Graphic({
      geometry: buffer,
      symbol: new SimpleFillSymbol({
        color: tokenColor('--color-highlight', 0.16),
        outline: { color: tokenColor('--color-highlight', 0.95), width: 2, style: 'dash' },
      }),
    }),
    new Graphic({
      geometry: site,
      symbol: new SimpleMarkerSymbol({
        style: 'circle',
        size: 13,
        color: tokenColor('--color-highlight'),
        outline: { color: tokenColor('--color-bg'), width: 2 },
      }),
    }),
  ];
}

export function proposalGraphics(list: Proposal[]): Graphic[] {
  return list.map(
    (p) =>
      new Graphic({
        geometry: new Point({ longitude: p.lon, latitude: p.lat }),
        attributes: {
          title: `${SERVICE_LABEL_SINGULAR[p.serviceType]} مقترحة · ${p.nameAr ?? p.districtCode}`,
          change: `${p.coverageBefore.toFixed(1)}% ← ${p.coverageAfter.toFixed(1)}% (+${p.gainKm2.toFixed(2)} كم²)`,
          check: p.diffPoints === null ? '—' : `المتصفح ${p.clientCoverageAfter?.toFixed(2)}% · الخادم ${p.coverageAfter.toFixed(2)}% · الفرق ${p.diffPoints.toFixed(2)} نقطة`,
          note: p.note || '—',
        },
        symbol: new SimpleMarkerSymbol({
          style: 'diamond',
          size: 14,
          color: tokenColor('--color-highlight'),
          outline: { color: tokenColor('--color-bg'), width: 1.5 },
        }),
        popupTemplate: new PopupTemplate({
          title: '{title}',
          content: [
            {
              type: 'fields',
              fieldInfos: [
                { fieldName: 'change', label: 'التغطية قبل ← بعد' },
                { fieldName: 'check', label: 'تحقق المتصفح مقابل Oracle' },
                { fieldName: 'note', label: 'ملاحظة' },
              ],
            },
          ],
        }),
      }),
  );
}
