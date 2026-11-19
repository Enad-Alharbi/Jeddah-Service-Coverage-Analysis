import { Component, computed, inject, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SERVICE_LABELS } from '../../../core/labels';
import { MapController } from '../../../map/map-controller';
import { MapStore } from '../../../map/map.store';
import { DonutGauge } from '../../../shared/donut-gauge/donut-gauge';
import { AnalysisStore } from '../analysis.store';

const CARD_W = 300;
const CARD_H = 270;
const GAP = 18;
const TOP_MIN = 150;

/**
 * Floating card next to the selected district: the three services side by side (donut gauges),
 * facility counts and uncovered area. Follows the district while the map moves.
 */
@Component({
  selector: 'app-district-card',
  imports: [DecimalPipe, DonutGauge],
  templateUrl: './district-card.html',
  styleUrl: './district-card.scss',
  // Screen coordinates are physical (x from the left), so left/top are used here rather than logical properties.
  host: {
    '[style.left.px]': 'position().left',
    '[style.top.px]': 'position().top',
  },
})
export class DistrictCard {
  protected readonly analysis = inject(AnalysisStore);
  private readonly map = inject(MapController);
  private readonly mapStore = inject(MapStore);
  readonly closed = output<void>();
  protected readonly labels = SERVICE_LABELS;

  /** Placed beside the district's centroid, flipped / clamped so it always stays on screen. */
  protected readonly position = computed(() => {
    const a = this.map.selectedAnchor();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Keep clear of the KPI strip at the top and the drawer at the bottom.
    const maxTop = Math.max(TOP_MIN, vh - this.mapStore.drawerHeight() - CARD_H - GAP);
    if (!a) return { left: GAP, top: TOP_MIN };
    let left = a.x + GAP;
    if (left + CARD_W > vw - GAP) left = a.x - CARD_W - GAP;
    left = Math.min(Math.max(GAP, left), vw - CARD_W - GAP);
    const top = Math.min(Math.max(TOP_MIN, a.y - CARD_H / 2), maxTop);
    return { left, top };
  });

  protected readonly current = computed(() => this.analysis.detail()?.services.find((s) => s.serviceType === this.analysis.service()) ?? null);
}
