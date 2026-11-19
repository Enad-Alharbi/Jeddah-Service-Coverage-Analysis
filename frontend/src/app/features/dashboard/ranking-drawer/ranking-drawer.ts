import { Component, computed, effect, inject, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { coverageClass, coverageColorVar } from '../../../core/coverage-class';
import { SERVICE_LABELS } from '../../../core/labels';
import { AnalysisStore, SortKey } from '../analysis.store';
import { PriorityList } from '../priority-list/priority-list';
import { DrawerTab, PriorityStore } from '../priority.store';

const COLLAPSED_PX = 48;
const MIN_PX = 160;
const DEFAULT_PX = 320;

/**
 * Bottom drawer with the district ranking (worst -> best by default). Expandable and resizable by dragging
 * its handle; reports its height so the legend and map controls can sit above it.
 */
@Component({
  selector: 'app-ranking-drawer',
  imports: [DecimalPipe, PriorityList],
  templateUrl: './ranking-drawer.html',
  styleUrl: './ranking-drawer.scss',
  host: { '[style.block-size.px]': 'height()' },
})
export class RankingDrawer {
  protected readonly analysis = inject(AnalysisStore);
  protected readonly priority = inject(PriorityStore);
  /** Row clicked: the page selects the district and zooms the map to it. */
  readonly rowSelected = output<string>();
  readonly heightChange = output<number>();

  protected readonly open = signal(false);
  // Phones: a bottom sheet of at most 40% of the screen, so the map stays visible.
  private readonly expandedHeight = signal(Math.max(MIN_PX, Math.min(DEFAULT_PX, Math.round(window.innerHeight * 0.4))));
  protected readonly height = computed(() => (this.open() ? this.expandedHeight() : COLLAPSED_PX));
  protected readonly title = computed(() => {
    const r = this.analysis.result();
    return r ? `ترتيب الأحياء · ${SERVICE_LABELS[r.serviceType]} · ${r.distanceM} م` : 'ترتيب الأحياء';
  });

  protected readonly columns: { key: SortKey; label: string; numeric: boolean }[] = [
    { key: 'nameAr', label: 'الحي', numeric: false },
    { key: 'facilityCount', label: 'المرافق', numeric: true },
    { key: 'coveragePct', label: 'التغطية', numeric: true },
    { key: 'uncoveredAreaKm2', label: 'غير مغطى (كم²)', numeric: true },
  ];
  protected readonly colorFor = coverageColorVar;
  protected readonly classFor = coverageClass;

  constructor() {
    effect(() => this.heightChange.emit(this.height()));
    // Open the drawer automatically the first time results arrive.
    effect(() => {
      if (this.analysis.status() === 'ready' && this.analysis.result()) this.open.set(true);
    });
  }

  protected showTab(tab: DrawerTab): void {
    this.priority.tab.set(tab);
    this.open.set(true);
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const s = this.analysis.sort();
    return s.key !== key ? 'none' : s.dir === 'asc' ? 'ascending' : 'descending';
  }

  /** Drag the handle to resize (pointer events work for mouse, touch and pen). */
  protected startResize(e: PointerEvent): void {
    if (!this.open()) return;
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startH = this.expandedHeight();
    const max = Math.round(window.innerHeight * 0.7);
    const move = (ev: PointerEvent) => this.expandedHeight.set(Math.min(max, Math.max(MIN_PX, startH + (startY - ev.clientY))));
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  }

  /** Keyboard resize for the handle (accessibility). */
  protected resizeBy(delta: number): void {
    const max = Math.round(window.innerHeight * 0.7);
    this.expandedHeight.update((h) => Math.min(max, Math.max(MIN_PX, h + delta)));
  }
}
