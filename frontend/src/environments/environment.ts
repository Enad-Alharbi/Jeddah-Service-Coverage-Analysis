// Non-secret settings (committed). Secrets go in app-config.ts (gitignored).
export const environment = {
  apiBaseUrl: 'http://localhost:5090/api',
  map: {
    // Basemap style that matches the dark theme.
    basemap: 'arcgis/dark-gray',
    // Initial view = extent of the 147 OSM districts [minLon, minLat, maxLon, maxLat] (data/DATA_REPORT.md).
    // The map then zooms to the districts layer's real extent once it loads.
    jeddahExtent: [38.94686, 21.05161, 39.42693, 21.99678] as const,
    // District names appear from roughly neighbourhood scale inward.
    districtLabelMinScale: 120_000,
    // Facilities are clustered when zoomed out further than this scale.
    facilityClusterMaxScale: 50_000,
  },
};
