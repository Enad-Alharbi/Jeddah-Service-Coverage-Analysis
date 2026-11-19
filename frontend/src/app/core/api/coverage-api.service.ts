import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CoverageResponse, Distance, DistrictDetail, PriorityResponse, ServiceType } from './api.types';

@Injectable({ providedIn: 'root' })
export class CoverageApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/coverage`;

  /** Per-district coverage + covered / uncovered geometry. The server computes and caches on first request. */
  coverage(serviceType: ServiceType, distance: Distance): Observable<CoverageResponse> {
    return this.http.get<CoverageResponse>(this.base, { params: { serviceType, distance } });
  }

  /** Residential districts under `threshold` % in two or more services (planning priority). */
  priority(distance: Distance, threshold = 50): Observable<PriorityResponse> {
    return this.http.get<PriorityResponse>(`${this.base}/priority`, { params: { distance, threshold } });
  }

  /** One district, all three services. */
  district(code: string, distance: Distance): Observable<DistrictDetail> {
    return this.http.get<DistrictDetail>(`${this.base}/district/${encodeURIComponent(code)}`, { params: { distance } });
  }
}
