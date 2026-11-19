import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DistrictProps, FacilityProps, FeatureCollection, ServiceType } from './api.types';

@Injectable({ providedIn: 'root' })
export class MapDataApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  districts(): Observable<FeatureCollection<DistrictProps>> {
    return this.http.get<FeatureCollection<DistrictProps>>(`${this.base}/districts`);
  }

  /** All facilities when serviceType is omitted. */
  facilities(serviceType?: ServiceType): Observable<FeatureCollection<FacilityProps>> {
    const params: Record<string, string> = serviceType ? { serviceType } : {};
    return this.http.get<FeatureCollection<FacilityProps>>(`${this.base}/facilities`, { params });
  }
}
