// Fetches the Jeddah governorate + all admin_level=10 relations inside it, WITH geometry (out geom),
// and saves the raw response. Processing happens in a separate script.
import { runOverpass } from './overpass.mjs';

const GOVERNORATE_REL = 12429519;
const q = `
rel(${GOVERNORATE_REL})->.govrel;
.govrel map_to_area->.gov;
(
  .govrel;
  rel["boundary"="administrative"]["admin_level"="10"](area.gov);
);
out geom;
`;
await runOverpass(q, 'districts');
