-- =====================================================================
-- 07_compute_all.sql   (run as GIS_COVERAGE)
-- Full recompute of the cache: 3 services x 3 distances x all districts, with timings.
-- (The API does the same through POST /api/coverage/recompute; GET /api/coverage fills gaps on demand.)
-- =====================================================================
SET SERVEROUTPUT ON

DECLARE
  n      NUMBER;
  ms     NUMBER;
  total  NUMBER := 0;
BEGIN
  FOR s IN (SELECT COLUMN_VALUE AS SVC FROM TABLE(SYS.ODCIVARCHAR2LIST('school', 'health', 'park'))) LOOP
    FOR d IN (SELECT COLUMN_VALUE AS DIST FROM TABLE(SYS.ODCINUMBERLIST(500, 800, 1000))) LOOP
      COVERAGE_PKG.COMPUTE(s.SVC, d.DIST, NULL, 'SET', n, ms);
      total := total + ms;
      DBMS_OUTPUT.PUT_LINE(RPAD(s.SVC, 7) || LPAD(d.DIST, 5) || ' m : ' || n || ' districts in ' || ms || ' ms');
    END LOOP;
  END LOOP;
  DBMS_OUTPUT.PUT_LINE('TOTAL: ' || ROUND(total / 1000, 1) || ' s');
END;
/

PROMPT ===== Sanity checks =====
SELECT SERVICE_TYPE, DISTANCE_M, COUNT(*) AS ROWS_,
       MIN(COVERAGE_PCT) AS MIN_PCT, MAX(COVERAGE_PCT) AS MAX_PCT,
       -- area-weighted city coverage for residential districts
       ROUND(100 * SUM(CASE WHEN d.NON_RESIDENTIAL = 0 THEN r.COVERED_AREA_KM2 END)
                 / SUM(CASE WHEN d.NON_RESIDENTIAL = 0 THEN d.AREA_KM2 END), 1) AS CITY_PCT,
       SUM(CASE WHEN ABS(r.COVERED_AREA_KM2 + r.UNCOVERED_AREA_KM2 - d.AREA_KM2) > 0.00001 THEN 1 ELSE 0 END) AS AREA_MISMATCH,
       SUM(CASE WHEN r.COVERAGE_PCT > 0 AND r.COVERED_GEOM IS NULL THEN 1 ELSE 0 END) AS MISSING_GEOM,
       SUM(CASE WHEN SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(r.COVERED_GEOM, 0.05) NOT IN ('TRUE', 'NULL') THEN 1 ELSE 0 END) AS INVALID_COV,
       SUM(CASE WHEN SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(r.UNCOVERED_GEOM, 0.05) NOT IN ('TRUE', 'NULL') THEN 1 ELSE 0 END) AS INVALID_UNCOV
FROM   COVERAGE_RESULTS r JOIN DISTRICTS d ON d.ID = r.DISTRICT_ID
GROUP  BY SERVICE_TYPE, DISTANCE_M
ORDER  BY SERVICE_TYPE, DISTANCE_M;
