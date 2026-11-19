import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateProposal, Distance, Proposal, ServiceType } from './api.types';

@Injectable({ providedIn: 'root' })
export class ProposalsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/proposals`;

  /** The server re-computes "after" in Oracle and returns both values (diffPoints = browser - server). */
  create(body: CreateProposal): Observable<Proposal> {
    return this.http.post<Proposal>(this.base, body);
  }

  list(serviceType: ServiceType, distance: Distance): Observable<Proposal[]> {
    return this.http.get<Proposal[]>(this.base, { params: { serviceType, distance } });
  }
}
