-- =====================================================================
-- 06_coverage_pkg.sql   (run as GIS_COVERAGE)
-- COVERAGE_PKG: computes walking-distance coverage per district and caches it in COVERAGE_RESULTS.
--
-- Measurement choice (see 05_measurement_comparison.sql): Option B.
--   Geometry operations (buffer, union, intersection, difference) run in UTM zone 37N (SRID 32637),
--   where coordinates are planar meters. That was 2–13x faster than geodetic operations on 4326, and the
--   coverage % agreed within 0.1 percentage points.
--   km2 values = coverage ratio x the district's true ellipsoidal area (DISTRICTS.AREA_KM2). This removes
--   UTM's small area scale error (k0 = 0.9996 -> about -0.08 % in area) and guarantees covered + uncovered = district area.
--   Result geometries are transformed back to 4326 for storage and display.
-- =====================================================================

CREATE OR REPLACE PACKAGE COVERAGE_PKG AS
  -- (Re)compute one service + distance for every district, or for one district (p_district_id).
  -- p_union: 'SET' = SDO_AGGR_SET_UNION (default), 'AGGR' = SDO_AGGR_UNION (kept to compare speed).
  PROCEDURE COMPUTE(
    p_service     IN  VARCHAR2,
    p_distance    IN  NUMBER,
    p_district_id IN  NUMBER   DEFAULT NULL,
    p_union       IN  VARCHAR2 DEFAULT 'SET',
    p_rows        OUT NUMBER,
    p_elapsed_ms  OUT NUMBER);

  -- Compute only the districts missing from the cache for this service + distance (on-demand caching).
  PROCEDURE ENSURE(
    p_service    IN  VARCHAR2,
    p_distance   IN  NUMBER,
    p_rows       OUT NUMBER,
    p_elapsed_ms OUT NUMBER);

  -- What-if, server side: coverage % of one district if a new facility were added at (p_lon, p_lat).
  -- Same method as COMPUTE (UTM buffers, union, intersection), so it is the reference the browser's
  -- geodesic what-if is checked against. Read-only: nothing is written to the cache.
  FUNCTION EVALUATE_SITE(
    p_service     IN VARCHAR2,
    p_distance    IN NUMBER,
    p_district_id IN NUMBER,
    p_lon         IN NUMBER,
    p_lat         IN NUMBER) RETURN NUMBER;
END COVERAGE_PKG;
/

CREATE OR REPLACE PACKAGE BODY COVERAGE_PKG AS
  c_tol       CONSTANT NUMBER := 0.05;   -- 5 cm
  c_arc       CONSTANT NUMBER := 0.25;   -- buffer circles are densified to within 25 cm of a true circle (area loss ~0.04 %)
  c_utm       CONSTANT NUMBER := 32637;  -- WGS 84 / UTM zone 37N
  c_wgs84     CONSTANT NUMBER := 4326;

  PROCEDURE check_inputs(p_service VARCHAR2, p_distance NUMBER) IS
  BEGIN
    IF p_service NOT IN ('school', 'health', 'park') THEN
      RAISE_APPLICATION_ERROR(-20001, 'Invalid service type: ' || p_service);
    END IF;
    IF p_distance NOT IN (500, 800, 1000) THEN
      RAISE_APPLICATION_ERROR(-20002, 'Invalid distance: ' || p_distance);
    END IF;
  END;

  -- Back to 4326 for storage; repair if the transformation produced a tiny invalidity.
  FUNCTION to_wgs84(p_geom SDO_GEOMETRY) RETURN SDO_GEOMETRY IS
    l_geom SDO_GEOMETRY;
  BEGIN
    IF p_geom IS NULL THEN RETURN NULL; END IF;
    l_geom := SDO_CS.TRANSFORM(p_geom, c_wgs84);
    IF SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(l_geom, c_tol) <> 'TRUE' THEN
      l_geom := SDO_UTIL.RECTIFY_GEOMETRY(l_geom, c_tol);
    END IF;
    RETURN l_geom;
  END;

  -- Steps 1 + 2: buffers of the facilities that can reach the district, unioned into one coverage shape (UTM).
  FUNCTION reach_union(p_service VARCHAR2, p_distance NUMBER, p_district_4326 SDO_GEOMETRY, p_union VARCHAR2)
    RETURN SDO_GEOMETRY
  IS
    l_buffers SDO_GEOMETRY_ARRAY;
    l_union   SDO_GEOMETRY;
  BEGIN
    -- Step 1. Pre-filter with the spatial index: only facilities within p_distance of the district can cover
    -- any part of it. This avoids buffering all of Jeddah's facilities for every district.
    -- Each surviving point is projected to UTM and buffered there (planar circle of p_distance meters).
    -- In a projected CRS the buffer is a TRUE circular arc, which SDO_CS.TRANSFORM cannot take back to 4326
    -- (ORA-13294), so the arcs are densified into straight segments within c_arc meters of the true circle.
    SELECT SDO_GEOM.SDO_ARC_DENSIFY(
             SDO_GEOM.SDO_BUFFER(SDO_CS.TRANSFORM(f.GEOM, c_utm), p_distance, c_tol),
             c_tol, 'arc_tolerance=' || c_arc)
    BULK COLLECT INTO l_buffers
    FROM   FACILITIES f
    WHERE  f.SERVICE_TYPE = p_service
    AND    SDO_WITHIN_DISTANCE(f.GEOM, p_district_4326, 'distance=' || p_distance || ' unit=M') = 'TRUE';

    IF l_buffers.COUNT = 0 THEN
      RETURN NULL;
    END IF;

    -- Step 2. Union of overlapping circles into one (multi)polygon, so overlaps are not counted twice.
    IF p_union = 'AGGR' THEN
      -- Classic aggregate: unions the geometries one by one.
      SELECT SDO_AGGR_UNION(SDOAGGRTYPE(VALUE(b), c_tol)) INTO l_union FROM TABLE(l_buffers) b;
    ELSE
      -- Set union: takes the whole array at once and unions it in batches. Usually faster for many inputs.
      l_union := SDO_AGGR_SET_UNION(l_buffers, c_tol);
    END IF;
    RETURN l_union;
  END;

  PROCEDURE compute_one(p_service VARCHAR2, p_distance NUMBER, p_district_id NUMBER, p_union VARCHAR2) IS
    l_d4326     SDO_GEOMETRY;
    l_area_km2  NUMBER;
    l_d_utm     SDO_GEOMETRY;
    l_union     SDO_GEOMETRY;
    l_cov       SDO_GEOMETRY;
    l_uncov     SDO_GEOMETRY;
    l_ratio     NUMBER := 0;
    l_count     NUMBER;
  BEGIN
    SELECT GEOM, AREA_KM2 INTO l_d4326, l_area_km2 FROM DISTRICTS WHERE ID = p_district_id;
    l_d_utm := SDO_CS.TRANSFORM(l_d4326, c_utm);
    l_union := reach_union(p_service, p_distance, l_d4326, p_union);

    IF l_union IS NULL THEN
      -- Nothing within reach: the whole district is uncovered.
      l_cov   := NULL;
      l_uncov := l_d_utm;
    ELSE
      -- Step 3. Covered part = district ∩ coverage, uncovered part = district − coverage.
      l_cov   := SDO_GEOM.SDO_INTERSECTION(l_d_utm, l_union, c_tol);
      l_uncov := SDO_GEOM.SDO_DIFFERENCE(l_d_utm, l_union, c_tol);
      -- Step 4. Coverage ratio from planar areas (UTM is conformal: area ratios are preserved here).
      l_ratio := NVL(SDO_GEOM.SDO_AREA(l_cov, c_tol), 0) / SDO_GEOM.SDO_AREA(l_d_utm, c_tol);
      l_ratio := LEAST(GREATEST(l_ratio, 0), 1);
    END IF;

    -- Step 5. Facility count = facilities whose point lies in this district (spatial join from 03_post_load.sql).
    SELECT COUNT(*) INTO l_count FROM FACILITIES WHERE DISTRICT_ID = p_district_id AND SERVICE_TYPE = p_service;

    -- Store in 4326 (private PL/SQL functions can't be called inside SQL, so transform first).
    l_cov   := to_wgs84(l_cov);
    l_uncov := to_wgs84(l_uncov);

    MERGE INTO COVERAGE_RESULTS r
    USING (SELECT p_service AS SERVICE_TYPE, p_distance AS DISTANCE_M, p_district_id AS DISTRICT_ID FROM DUAL) k
    ON (r.SERVICE_TYPE = k.SERVICE_TYPE AND r.DISTANCE_M = k.DISTANCE_M AND r.DISTRICT_ID = k.DISTRICT_ID)
    WHEN MATCHED THEN UPDATE SET
      FACILITY_COUNT     = l_count,
      COVERED_AREA_KM2   = ROUND(l_ratio * l_area_km2, 6),
      UNCOVERED_AREA_KM2 = ROUND((1 - l_ratio) * l_area_km2, 6),
      COVERAGE_PCT       = ROUND(100 * l_ratio, 2),
      COVERED_GEOM       = l_cov,
      UNCOVERED_GEOM     = l_uncov,
      COMPUTED_AT        = SYSTIMESTAMP
    WHEN NOT MATCHED THEN INSERT
      (SERVICE_TYPE, DISTANCE_M, DISTRICT_ID, FACILITY_COUNT, COVERED_AREA_KM2, UNCOVERED_AREA_KM2,
       COVERAGE_PCT, COVERED_GEOM, UNCOVERED_GEOM, COMPUTED_AT)
    VALUES
      (p_service, p_distance, p_district_id, l_count, ROUND(l_ratio * l_area_km2, 6), ROUND((1 - l_ratio) * l_area_km2, 6),
       ROUND(100 * l_ratio, 2), l_cov, l_uncov, SYSTIMESTAMP);
  END;

  PROCEDURE COMPUTE(
    p_service     IN  VARCHAR2,
    p_distance    IN  NUMBER,
    p_district_id IN  NUMBER   DEFAULT NULL,
    p_union       IN  VARCHAR2 DEFAULT 'SET',
    p_rows        OUT NUMBER,
    p_elapsed_ms  OUT NUMBER)
  IS
    t0 PLS_INTEGER := DBMS_UTILITY.GET_TIME;
  BEGIN
    check_inputs(p_service, p_distance);
    p_rows := 0;
    FOR d IN (SELECT ID FROM DISTRICTS WHERE p_district_id IS NULL OR ID = p_district_id ORDER BY ID) LOOP
      compute_one(p_service, p_distance, d.ID, p_union);
      p_rows := p_rows + 1;
    END LOOP;
    COMMIT;
    p_elapsed_ms := (DBMS_UTILITY.GET_TIME - t0) * 10;
  END;

  PROCEDURE ENSURE(
    p_service    IN  VARCHAR2,
    p_distance   IN  NUMBER,
    p_rows       OUT NUMBER,
    p_elapsed_ms OUT NUMBER)
  IS
    t0 PLS_INTEGER := DBMS_UTILITY.GET_TIME;
  BEGIN
    check_inputs(p_service, p_distance);
    p_rows := 0;
    FOR d IN (
      SELECT ID FROM DISTRICTS
      WHERE  ID NOT IN (SELECT DISTRICT_ID FROM COVERAGE_RESULTS WHERE SERVICE_TYPE = p_service AND DISTANCE_M = p_distance)
      ORDER  BY ID
    ) LOOP
      compute_one(p_service, p_distance, d.ID, 'SET');
      p_rows := p_rows + 1;
    END LOOP;
    COMMIT;
    p_elapsed_ms := (DBMS_UTILITY.GET_TIME - t0) * 10;
  END;

  FUNCTION EVALUATE_SITE(
    p_service     IN VARCHAR2,
    p_distance    IN NUMBER,
    p_district_id IN NUMBER,
    p_lon         IN NUMBER,
    p_lat         IN NUMBER) RETURN NUMBER
  IS
    l_d4326 SDO_GEOMETRY;
    l_d_utm SDO_GEOMETRY;
    l_union SDO_GEOMETRY;
    l_site  SDO_GEOMETRY;
    l_cov   SDO_GEOMETRY;
  BEGIN
    check_inputs(p_service, p_distance);
    SELECT GEOM INTO l_d4326 FROM DISTRICTS WHERE ID = p_district_id;
    l_d_utm := SDO_CS.TRANSFORM(l_d4326, c_utm);

    -- Existing coverage (same steps 1 + 2 as COMPUTE) ...
    l_union := reach_union(p_service, p_distance, l_d4326, 'SET');

    -- ... plus the proposed site's walking-distance circle, built exactly like the existing ones.
    l_site := SDO_GEOM.SDO_ARC_DENSIFY(
                SDO_GEOM.SDO_BUFFER(
                  SDO_CS.TRANSFORM(SDO_GEOMETRY(2001, c_wgs84, SDO_POINT_TYPE(p_lon, p_lat, NULL), NULL, NULL), c_utm),
                  p_distance, c_tol),
                c_tol, 'arc_tolerance=' || c_arc);
    l_union := CASE WHEN l_union IS NULL THEN l_site ELSE SDO_GEOM.SDO_UNION(l_union, l_site, c_tol) END;

    l_cov := SDO_GEOM.SDO_INTERSECTION(l_d_utm, l_union, c_tol);
    RETURN ROUND(100 * LEAST(1, NVL(SDO_GEOM.SDO_AREA(l_cov, c_tol), 0) / SDO_GEOM.SDO_AREA(l_d_utm, c_tol)), 2);
  END;
END COVERAGE_PKG;
/
SHOW ERRORS PACKAGE BODY COVERAGE_PKG
