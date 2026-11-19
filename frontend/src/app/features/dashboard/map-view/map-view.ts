import { CUSTOM_ELEMENTS_SCHEMA, Component, effect, inject } from '@angular/core';
import '@arcgis/map-components/components/arcgis-map';
import '@arcgis/map-components/components/arcgis-zoom';
import '@arcgis/map-components/components/arcgis-home';
import { MapController } from '../../../map/map-controller';
import { MapStore } from '../../../map/map.store';
import { environment } from '../../../../environments/environment';

/** Full-bleed ArcGIS map. All layer work is delegated to MapController. */
@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // <arcgis-*> are web components, not Angular components
})
export class MapView {
  private readonly controller = inject(MapController);
  private readonly store = inject(MapStore);

  protected readonly basemap = environment.map.basemap;
  protected readonly center = extentCenter(environment.map.jeddahExtent);

  constructor() {
    // Legend chips toggle services -> filter the facilities layer on the client.
    effect(() => this.controller.setVisibleServices(this.store.visibleServices()));
  }

  protected onViewReady(event: Event): void {
    this.controller.attach(event.target as HTMLArcgisMapElement);
    void this.controller.loadBaseLayers();
  }
}

function extentCenter([minX, minY, maxX, maxY]: readonly number[]): number[] {
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}
