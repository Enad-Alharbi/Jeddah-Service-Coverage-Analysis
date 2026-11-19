import { Injectable, inject, signal } from '@angular/core';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js';
import type Graphic from '@arcgis/core/Graphic.js';
import type Point from '@arcgis/core/geometry/Point.js';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer.js';
import type MapView from '@arcgis/core/views/MapView.js';
import HighlightOptions from '@arcgis/core/views/support/HighlightOptions.js';
import type GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js';
import { Proposal } from '../core/api/api.types';
import { createProposalsLayer, createWhatIfLayer, proposalGraphics, trialGraphics } from './layers/what-if-layers';
import { token, tokenColor } from './map-theme';
import FeatureEffect from '@arcgis/core/layers/support/FeatureEffect.js';
import FeatureFilter from '@arcgis/core/layers/support/FeatureFilter.js';
import { firstValueFrom, forkJoin } from 'rxjs';
import { CoverageResponse, SERVICE_TYPES, ServiceType } from '../core/api/api.types';
import { MapDataApi } from '../core/api/map-data-api.service';
import { coverageClassBreaksRenderer, createCoverageLayers } from './layers/coverage-layers';
import { createDistrictLayer, neutralDistrictRenderer } from './layers/district-layer';
import { createFacilityLayer, setVisibleServices } from './layers/facility-layer';
import { MapStore } from './map.store';

const SELECTION = 'selection';

/** A click in proposal mode: where, and which district (null = outside every district). */
export interface ProposalClick {
  point: Point;
  districtCode: string | null;
  nonResidential: boolean;
  at: number; // makes repeated clicks on the same district distinct signal values
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Owns the MapView and every layer. Components talk to this service (show coverage, select a district),
 * never to ArcGIS objects directly. Provided per dashboard page.
 *
 * Draw order, bottom -> top: basemap, districts, covered, uncovered, facilities (+ highlight).
 */
@Injectable()
export class MapController {
  private readonly api = inject(MapDataApi);
  private readonly store = inject(MapStore);

  /** Set when the user clicks a district on the map (not a facility). */
  readonly clickedDistrict = signal<string | null>(null);
  /** Screen position of the selected district's centroid, kept current while the map pans/zooms. */
  readonly selectedAnchor = signal<ScreenPoint | null>(null);
  /** Proposal mode: a map click is a candidate site, not a selection. */
  readonly proposalClick = signal<ProposalClick | null>(null);

  private proposalMode = false;
  private whatIf?: GraphicsLayer;
  private proposals?: GraphicsLayer;

  private view?: MapView;
  private districts?: FeatureLayer;
  private facilities?: FeatureLayer;
  private covered?: FeatureLayer;
  private uncovered?: FeatureLayer;
  private objectIdByCode = new Map<string, number>();
  private highlight?: { remove(): void };
  private selectedCentroid?: Point;
  private anchorWatch?: { remove(): void };

  attach(mapEl: HTMLArcgisMapElement): void {
    this.view = mapEl.view;
    // A named highlight in the theme's amber, so selection never looks like the cyan ">= 80%" class.
    this.view.highlights?.add(
      new HighlightOptions({ name: SELECTION, color: tokenColor('--color-highlight'), haloOpacity: 1, fillOpacity: 0.12 }),
    );
    this.view.on('click', (e) => void this.handleClick(e));
  }

  async loadBaseLayers(): Promise<void> {
    const view = this.view;
    if (!view) return;
    this.store.loadState.set('loading');
    this.store.errorMessage.set(null);
    try {
      const { districts, facilities } = await firstValueFrom(forkJoin({ districts: this.api.districts(), facilities: this.api.facilities() }));
      view.map!.removeAll();
      this.covered = this.uncovered = undefined;

      this.districts = createDistrictLayer(districts);
      // Clicking a district selects it (detail card) instead of opening a popup; facilities keep their popups.
      this.districts.popupEnabled = false;
      const names = new Map(districts.features.map((f) => [f.properties.districtCode, f.properties.nameAr ?? f.properties.districtCode]));
      this.facilities = createFacilityLayer(facilities, names);
      setVisibleServices(this.facilities, this.store.visibleServices());
      this.proposals = createProposalsLayer();
      this.whatIf = createWhatIfLayer();
      view.map!.addMany([this.districts, this.facilities, this.proposals, this.whatIf]);

      // DISTRICT_CODE -> OBJECTID, needed to write coverage values onto the client-side features.
      const all = await this.districts.queryFeatures({ where: '1=1', outFields: ['OBJECTID', 'DISTRICT_CODE'], returnGeometry: false });
      this.objectIdByCode = new Map(all.features.map((g) => [g.attributes.DISTRICT_CODE as string, g.attributes.OBJECTID as number]));

      this.store.districtCount.set(districts.features.length);
      this.store.facilityCounts.set(countByService(facilities.features.map((f) => f.properties.serviceType)));

      const { extent } = await this.districts.queryExtent();
      if (extent) await view.goTo(extent.expand(1.05), { animate: false });
      this.store.loadState.set('ready');
    } catch {
      this.store.loadState.set('error');
      this.store.errorMessage.set('تعذّر تحميل بيانات الخريطة من الخادم. تأكد أن الـ API يعمل على المنفذ 5090.');
    }
  }

  setVisibleServices(services: ServiceType[]): void {
    if (this.facilities) setVisibleServices(this.facilities, services);
  }

  /** Paint an analysis result: class-breaks districts + covered (cyan) + uncovered (coral hatch). */
  async showCoverage(result: CoverageResponse): Promise<void> {
    const view = this.view;
    if (!view || !this.districts) return;

    // Client-side layers are edited with applyEdits (their `source` is read only after creation).
    const updateFeatures = result.districts
      .filter((d) => this.objectIdByCode.has(d.districtCode))
      .map((d) => ({ attributes: { OBJECTID: this.objectIdByCode.get(d.districtCode)!, COVERAGE_PCT: d.coveragePct } }));
    await this.districts.applyEdits({ updateFeatures } as never);
    this.districts.renderer = coverageClassBreaksRenderer();

    this.removeCoverageLayers();
    const { covered, uncovered } = createCoverageLayers(result);
    this.covered = covered;
    this.uncovered = uncovered;
    view.map!.addMany([covered, uncovered], 1); // just above the districts, below the facilities
  }

  clearCoverage(): void {
    this.removeCoverageLayers();
    if (this.districts) this.districts.renderer = neutralDistrictRenderer();
  }

  /**
   * Multi-service priority view. A FeatureEffect splits the districts layer with an attribute filter:
   * priority districts glow (coral drop shadow), the rest fade out. No new layer, no new request.
   * The single-service covered / uncovered layers are hidden meanwhile, since priority looks at all three services.
   * Pass null to go back to the normal view.
   */
  showPriority(codes: string[] | null): void {
    if (!this.districts) return;
    for (const l of [this.covered, this.uncovered]) if (l) l.visible = codes === null;
    if (codes === null) {
      this.districts.featureEffect = null;
      return;
    }
    const list = codes.length ? codes.map((c) => `'${c.replace(/'/g, "''")}'`).join(', ') : "''";
    this.districts.featureEffect = new FeatureEffect({
      filter: new FeatureFilter({ where: `DISTRICT_CODE IN (${list})` }),
      includedEffect: `drop-shadow(0px, 0px, 6px, ${token('--coverage-low')}) brightness(115%)`,
      excludedEffect: 'opacity(25%) grayscale(80%)',
      excludedLabelsVisible: false,
    });
  }

  /** Highlight a district, optionally zoom to it, and track its screen position for the floating card. */
  async selectDistrict(code: string | null, zoom = false): Promise<void> {
    this.highlight?.remove();
    this.anchorWatch?.remove();
    this.highlight = this.anchorWatch = undefined;
    this.selectedAnchor.set(null);
    if (!code || !this.view || !this.districts) return;

    const { features } = await this.districts.queryFeatures({
      where: `DISTRICT_CODE = '${code.replace(/'/g, "''")}'`,
      outFields: ['*'],
      returnGeometry: true,
    });
    const graphic = features[0] as Graphic | undefined;
    if (!graphic) return;

    const layerView = await this.view.whenLayerView(this.districts);
    this.highlight = layerView.highlight(graphic, { name: SELECTION });
    const polygon = graphic.geometry as Polygon;
    this.selectedCentroid = polygon.centroid ?? polygon.extent!.center;

    if (zoom) await this.view.goTo({ target: polygon.extent!.expand(1.6) }, { duration: 400 });

    const update = () => {
      const p = this.view!.toScreen(this.selectedCentroid as never);
      this.selectedAnchor.set(p ? { x: p.x, y: p.y } : null);
    };
    update();
    this.anchorWatch = reactiveUtils.watch(() => this.view!.extent, update);
  }

  // ---------------------------------------------------------------- what-if

  /** In proposal mode facility popups are off, so every click becomes a candidate site. */
  setProposalMode(on: boolean): void {
    this.proposalMode = on;
    if (this.view) this.view.popupEnabled = !on;
    if (!on) this.clearTrial();
  }

  /** District polygon in WGS84 (asked for explicitly, so it matches the other what-if inputs). */
  async districtGeometry(code: string): Promise<Polygon | null> {
    if (!this.districts) return null;
    const { features } = await this.districts.queryFeatures({
      where: `DISTRICT_CODE = '${code.replace(/'/g, "''")}'`,
      returnGeometry: true,
      outSpatialReference: { wkid: 4326 },
    });
    return (features[0]?.geometry as Polygon | undefined) ?? null;
  }

  drawTrial(site: Point, buffer: Polygon): void {
    this.whatIf?.removeAll();
    this.whatIf?.addMany(trialGraphics(site, buffer));
  }

  clearTrial(): void {
    this.whatIf?.removeAll();
  }

  showProposals(list: Proposal[]): void {
    this.proposals?.removeAll();
    this.proposals?.addMany(proposalGraphics(list));
  }

  private removeCoverageLayers(): void {
    for (const l of [this.covered, this.uncovered]) if (l) this.view?.map?.remove(l);
    this.covered = this.uncovered = undefined;
  }

  /** The view's click event: screen position + the clicked map point (view spatial reference). */
  private async handleClick(e: { x: number; y: number; mapPoint?: Point | null }): Promise<void> {
    if (!this.view || !this.districts || !this.facilities) return;

    if (this.proposalMode) {
      // Which district contains the clicked point? (hitTest on the districts layer only.)
      const hit = await this.view.hitTest({ x: e.x, y: e.y }, { include: [this.districts] });
      const g = (hit.results[0] as { graphic?: Graphic } | undefined)?.graphic;
      const point = e.mapPoint ?? this.view.toMap({ x: e.x, y: e.y });
      if (!point) return;
      this.proposalClick.set({
        point,
        districtCode: (g?.attributes?.DISTRICT_CODE as string | undefined) ?? null,
        nonResidential: g?.attributes?.NON_RESIDENTIAL === 1,
        at: Date.now(),
      });
      return;
    }

    // A facility click opens its popup (default behaviour); only empty-of-facility clicks select a district.
    const facilityHit = await this.view.hitTest({ x: e.x, y: e.y }, { include: [this.facilities] });
    if (facilityHit.results.length) return;
    const districtHit = await this.view.hitTest({ x: e.x, y: e.y }, { include: [this.districts] });
    const first = districtHit.results[0] as { graphic?: Graphic } | undefined;
    this.clickedDistrict.set((first?.graphic?.attributes?.DISTRICT_CODE as string | undefined) ?? null);
  }
}


function countByService(types: ServiceType[]): Record<ServiceType, number> {
  const counts = Object.fromEntries(SERVICE_TYPES.map((s) => [s, 0])) as Record<ServiceType, number>;
  for (const t of types) counts[t]++;
  return counts;
}
