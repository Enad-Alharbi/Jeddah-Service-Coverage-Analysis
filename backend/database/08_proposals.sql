-- =====================================================================
-- 08_proposals.sql   (run as GIS_COVERAGE, after 06_coverage_pkg.sql)
-- What-if proposals: keep the browser's result next to the server's, so every saved site
-- documents how closely the client-side geodesic calculation matched Oracle.
-- (Adds a column only: no data is changed or removed.)
-- =====================================================================

ALTER TABLE PROPOSED_SITES ADD (
  -- COVERAGE_AFTER is the server value (COVERAGE_PKG.EVALUATE_SITE); this is what the browser computed.
  CLIENT_COVERAGE_AFTER NUMBER(5,2)
);

-- Check: browser vs server for every saved proposal (difference in percentage points).
-- SELECT p.ID, d.NAME_AR, p.SERVICE_TYPE, p.DISTANCE_M, p.COVERAGE_BEFORE, p.CLIENT_COVERAGE_AFTER, p.COVERAGE_AFTER,
--        ROUND(p.CLIENT_COVERAGE_AFTER - p.COVERAGE_AFTER, 2) AS DIFF_POINTS
-- FROM   PROPOSED_SITES p JOIN DISTRICTS d ON d.ID = p.DISTRICT_ID
-- ORDER  BY p.CREATED_AT DESC;
