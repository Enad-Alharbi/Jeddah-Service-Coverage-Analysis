import { Component, effect, inject, untracked } from '@angular/core';
import { toArcgisGeometry } from '../../map/geojson-to-arcgis';
import { MapController, ProposalClick } from '../../map/map-controller';
import { MapStore } from '../../map/map.store';
import { computeWhatIf, loadWhatIfOperators } from '../../map/what-if';
import type Polygon from '@arcgis/core/geometry/Polygon.js';
import { AnalysisStore } from './analysis.store';
import { CommandBar } from './command-bar/command-bar';
import { DistrictCard } from './district-card/district-card';
import { KpiStrip } from './kpi-strip/kpi-strip';
import { LegendChips } from './legend-chips/legend-chips';
import { MapView } from './map-view/map-view';
import { RankingDrawer } from './ranking-drawer/ranking-drawer';
import { WhatIfCard } from './what-if-card/what-if-card';
import { WhatIfStore } from './what-if.store';
import { PriorityStore } from './priority.store';

/**
 * Command-center layout: full-bleed map with floating glass UI.
 * This page wires the stores to the map: results -> layers, map clicks / table rows -> selected district,
 * and in proposal mode map clicks -> browser what-if.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [MapView, CommandBar, KpiStrip, LegendChips, RankingDrawer, DistrictCard, WhatIfCard],
  providers: [MapStore, MapController, AnalysisStore, WhatIfStore, PriorityStore],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  host: {
    '[style.--drawer-h.px]': 'store.drawerHeight()',
    '(document:keydown.escape)': 'whatIf.mode() && whatIf.exit()',
  },
})
export class DashboardPage {
  protected readonly store = inject(MapStore);
  protected readonly analysis = inject(AnalysisStore);
  protected readonly whatIf = inject(WhatIfStore);
  protected readonly priority = inject(PriorityStore);
  private readonly map = inject(MapController);

  constructor() {
    // New analysis result -> repaint the map, show only that service's facilities and its saved proposals.
    effect(() => {
      const result = this.analysis.result();
      if (!result) return;
      untracked(() => {
        this.store.visibleServices.set([result.serviceType]);
        void this.map.showCoverage(result);
        this.whatIf.discard(); // a trial belongs to the old service / distance
        void this.whatIf.loadSaved(result.serviceType, result.distanceM);
      });
    });

    // A click on a district in the map selects it (without moving the map).
    effect(() => {
      const code = this.map.clickedDistrict();
      untracked(() => this.select(code, false));
    });

    // Proposal mode on/off.
    effect(() => {
      const on = this.whatIf.mode();
      untracked(() => {
        this.map.setProposalMode(on);
        if (on) {
          this.select(null, false);
          void loadWhatIfOperators(); // load the geometry engines before the first click
        }
      });
    });

    effect(() => {
      const click = this.map.proposalClick();
      if (click) untracked(() => void this.evaluate(click));
    });

    effect(() => {
      if (!this.whatIf.trial()) untracked(() => this.map.clearTrial());
    });

    // Priority tab: load the multi-service list for the current distance and highlight it on the map.
    effect(() => {
      const active = this.priority.active();
      const distance = this.analysis.distance();
      untracked(() => {
        if (active) void this.priority.load(distance);
        else this.map.showPriority(null);
      });
    });

    effect(() => {
      const r = this.priority.result();
      const active = this.priority.active();
      const layersReady = this.store.loadState() === 'ready';
      this.analysis.result(); // re-apply after a new analysis re-creates the coverage layers
      if (active && r && layersReady) untracked(() => this.map.showPriority(r.districts.map((d) => d.districtCode)));
    });

    effect(() => {
      const saved = this.whatIf.saved();
      untracked(() => this.map.showProposals(saved));
    });
  }

  protected selectFromTable(code: string): void {
    this.select(code, true);
  }

  protected closeCard(): void {
    this.select(null, false);
  }

  protected retryLoad(): void {
    void this.map.loadBaseLayers();
  }

  private select(code: string | null, zoom: boolean): void {
    this.analysis.select(code);
    void this.map.selectDistrict(code, zoom);
  }

  /** Browser what-if for a clicked site. Refuses clicks outside Jeddah's residential districts. */
  private async evaluate(click: ProposalClick): Promise<void> {
    const result = this.analysis.result();
    if (!this.whatIf.mode() || !result) return;
    if (!click.districtCode) {
      this.whatIf.message.set('الموقع خارج أحياء جدة. اضغط داخل حي.');
      return;
    }
    if (click.nonResidential) {
      this.whatIf.message.set('هذه وحدة غير سكنية (مطار / ميناء / جامعة). اختر حيًا سكنيًا.');
      return;
    }
    const row = result.districts.find((d) => d.districtCode === click.districtCode);
    const district = await this.map.districtGeometry(click.districtCode);
    if (!row || !district) return;

    await loadWhatIfOperators();
    const r = computeWhatIf({
      clickPoint: click.point,
      district,
      covered: toArcgisGeometry(row.coveredGeom) as Polygon | null,
      distanceM: result.distanceM,
      serverBeforePct: row.coveragePct,
      districtAreaKm2: row.areaKm2,
    });
    if (!r) return;

    this.map.drawTrial(r.site, r.buffer);
    this.whatIf.setTrial({
      districtCode: row.districtCode,
      nameAr: row.nameAr ?? row.districtCode,
      serviceType: result.serviceType,
      distanceM: result.distanceM,
      lon: r.site.longitude!,
      lat: r.site.latitude!,
      beforePct: r.beforePct,
      afterPct: r.afterPct,
      deltaPct: r.deltaPct,
      gainKm2: r.gainKm2,
    });
  }
}
