// Shared settings for the data pipeline. No geometry or names live here: everything comes from OSM.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const paths = {
  raw: path.resolve(here, '../raw'),
  processed: path.resolve(here, '../processed'),
};

// District selection rules (approved by the user on 2026-11-15, see DATA_REPORT.md).
export const districts = {
  governorateRelId: 12429519, // محافظة جدة, admin_level=6
  adminLevel: '10',
  minShareInsideGovernorate: 0.5, // keep a district if > 50% of its area is inside the governorate
  // Exact duplicates in OSM (same member ways): drop these relation ids.
  dropDuplicateRelIds: [19268636], // الشراع, duplicate of 20039305
  // Tagged as admin_level=10 but not residential: kept on the map, excluded from ranking/KPIs.
  nonResidentialRelIds: [20039229, 20039288, 20039298, 20039331],
  // Topology-preserving simplification tolerance (meters). Small, so areas barely change.
  simplifyIntervalM: 5,
};

// Facility tags per service (decisions documented in DATA_REPORT.md).
// Each entry is an Overpass tag filter; one Overpass query per service, run one at a time.
export const facilities = {
  // Fetch box = districts extent + this margin, so facilities just outside a border still count
  // for the districts they can reach (edge effect). Final keep rule: within maxDistanceM of a district.
  searchMarginKm: 1.2,
  maxDistanceM: 1000,
  services: {
    school: ['["amenity"="school"]'],
    health: [
      '["amenity"~"^(hospital|clinic|doctors)$"]',
      '["healthcare"~"^(hospital|clinic|doctor|centre)$"]',
    ],
    park: ['["leisure"="park"]'],
  },
};

export const overpass = {
  endpoint: 'https://overpass-api.de/api/interpreter',
  // Server-side timeout (seconds) written into each query as [timeout:N].
  queryTimeoutSec: 180,
  maxRetries: 4,
  // Generic client name (no personal details), per Overpass etiquette.
  userAgent: 'jeddah-coverage-learning-project/0.1 (local, non-commercial)',
};
