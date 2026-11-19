// Types mirroring the backend DTOs (camelCase JSON). GeoJSON is RFC 7946, WGS84.

export type ServiceType = 'school' | 'health' | 'park';
export const SERVICE_TYPES: readonly ServiceType[] = ['school', 'health', 'park'];

export type Position = [number, number];
export type GeoJsonGeometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

export interface Feature<P> {
  type: 'Feature';
  properties: P;
  geometry: GeoJsonGeometry | null;
}

export interface FeatureCollection<P> {
  type: 'FeatureCollection';
  features: Feature<P>[];
}

export interface DistrictProps {
  districtCode: string;
  osmId: number;
  nameAr: string | null;
  nameEn: string | null;
  nonResidential: boolean;
  areaKm2: number;
}

export type Distance = 500 | 800 | 1000;
export const DISTANCES: readonly Distance[] = [500, 800, 1000];

export interface DistrictCoverage {
  districtCode: string;
  nameAr: string | null;
  nameEn: string | null;
  nonResidential: boolean;
  areaKm2: number;
  facilityCount: number;
  coveredAreaKm2: number;
  uncoveredAreaKm2: number;
  coveragePct: number;
  coveredGeom: GeoJsonGeometry | null;
  uncoveredGeom: GeoJsonGeometry | null;
}

export interface CoverageSummary {
  residentialDistricts: number;
  cityCoveragePct: number;
  underServedDistricts: number;
  uncoveredAreaKm2: number;
  facilityCount: number;
}

export interface CoverageResponse {
  serviceType: ServiceType;
  distanceM: Distance;
  computedAt: string | null;
  districtsComputedNow: number;
  computeMs: number;
  summary: CoverageSummary;
  districts: DistrictCoverage[];
}

export interface ServiceCoverage {
  serviceType: ServiceType;
  facilityCount: number;
  coveragePct: number;
  coveredAreaKm2: number;
  uncoveredAreaKm2: number;
}

export interface DistrictDetail {
  districtCode: string;
  nameAr: string | null;
  nameEn: string | null;
  nonResidential: boolean;
  areaKm2: number;
  distanceM: Distance;
  services: ServiceCoverage[];
}

export interface PriorityDistrict {
  districtCode: string;
  nameAr: string | null;
  nameEn: string | null;
  /** In how many services the district is under the threshold (2 or 3). */
  underServedCount: number;
  coveragePctByService: Record<ServiceType, number>;
}

export interface PriorityResponse {
  distanceM: Distance;
  threshold: number;
  districts: PriorityDistrict[];
}

export interface CreateProposal {
  serviceType: ServiceType;
  distanceM: Distance;
  districtCode: string;
  lon: number;
  lat: number;
  clientCoverageAfter: number;
  note?: string;
}

export interface Proposal {
  id: number;
  serviceType: ServiceType;
  distanceM: Distance;
  districtCode: string;
  nameAr: string | null;
  lon: number;
  lat: number;
  coverageBefore: number;
  /** Server value (Oracle, COVERAGE_PKG.EVALUATE_SITE). */
  coverageAfter: number;
  /** Browser value (geodesic operators). */
  clientCoverageAfter: number | null;
  /** Browser minus server, in percentage points. */
  diffPoints: number | null;
  gainKm2: number;
  note: string | null;
  createdAt: string;
}

export interface FacilityProps {
  facilityId: string;
  osmId: number;
  osmType: 'node' | 'way' | 'relation';
  serviceType: ServiceType;
  subtype: string | null;
  nameAr: string | null;
  nameEn: string | null;
  districtCode: string | null;
}
