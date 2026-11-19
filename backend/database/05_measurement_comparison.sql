-- =====================================================================
-- 05_measurement_comparison.sql   (run as GIS_COVERAGE; read-only, prints with DBMS_OUTPUT)
--
-- The same coverage calculation done two ways, to choose the measurement approach:
--   Option A  GEODETIC: buffer / union / intersection / area directly on SRID 4326 (WGS84 ellipsoid).
--   Option B  PROJECTED: transform to UTM zone 37N (SRID 32637, planar meters), do the work there.
-- Jeddah (lon 38.9–39.4) sits right on UTM 37N's central meridian (39°E), so distortion there is tiny.
-- =====================================================================
SET SERVEROUTPUT ON SIZE UNLIMITED

DECLARE
  c_tol   CONSTANT NUMBER := 0.05;   -- 5 cm
  c_arc   CONSTANT NUMBER := 0.25;   -- max 25 cm gap between a true circle and its densified buffer (same as COVERAGE_PKG)

  PROCEDURE compare(p_code VARCHAR2, p_service VARCHAR2, p_dist NUMBER) IS
    l_name   DISTRICTS.NAME_AR%TYPE;
    l_d4326  SDO_GEOMETRY;
    l_area_true NUMBER;
    l_n      PLS_INTEGER;
    t0       PLS_INTEGER;
    -- Option A
    a_union  SDO_GEOMETRY; a_cov SDO_GEOMETRY; a_cov_km2 NUMBER; a_pct NUMBER; a_ms NUMBER;
    -- Option B
    b_d      SDO_GEOMETRY; b_union SDO_GEOMETRY; b_cov SDO_GEOMETRY;
    b_cov_km2 NUMBER; b_d_km2 NUMBER; b_pct NUMBER; b_ms NUMBER;
  BEGIN
    SELECT NAME_AR, GEOM, AREA_KM2 INTO l_name, l_d4326, l_area_true FROM DISTRICTS WHERE DISTRICT_CODE = p_code;

    -- ---------- Option A: geodetic (SRID 4326, distances in meters on the ellipsoid) ----------
    t0 := DBMS_UTILITY.GET_TIME;
    SELECT SDO_AGGR_UNION(SDOAGGRTYPE(SDO_GEOM.SDO_BUFFER(f.GEOM, p_dist, c_tol, 'unit=M arc_tolerance=' || c_arc), c_tol)), COUNT(*)
    INTO   a_union, l_n
    FROM   FACILITIES f
    WHERE  f.SERVICE_TYPE = p_service
    AND    SDO_WITHIN_DISTANCE(f.GEOM, l_d4326, 'distance=' || p_dist || ' unit=M') = 'TRUE';
    a_cov     := SDO_GEOM.SDO_INTERSECTION(l_d4326, a_union, c_tol);
    a_cov_km2 := NVL(SDO_GEOM.SDO_AREA(a_cov, c_tol, 'unit=SQ_KM'), 0);
    a_pct     := 100 * a_cov_km2 / l_area_true;
    a_ms      := (DBMS_UTILITY.GET_TIME - t0) * 10;

    -- ---------- Option B: UTM 37N (SRID 32637, planar meters) ----------
    t0 := DBMS_UTILITY.GET_TIME;
    b_d := SDO_CS.TRANSFORM(l_d4326, 32637);
    SELECT SDO_AGGR_UNION(SDOAGGRTYPE(SDO_GEOM.SDO_ARC_DENSIFY(SDO_GEOM.SDO_BUFFER(SDO_CS.TRANSFORM(f.GEOM, 32637), p_dist, c_tol), c_tol, 'arc_tolerance=' || c_arc), c_tol))
    INTO   b_union
    FROM   FACILITIES f
    WHERE  f.SERVICE_TYPE = p_service
    AND    SDO_WITHIN_DISTANCE(f.GEOM, l_d4326, 'distance=' || p_dist || ' unit=M') = 'TRUE';
    b_cov     := SDO_GEOM.SDO_INTERSECTION(b_d, b_union, c_tol);
    b_cov_km2 := NVL(SDO_GEOM.SDO_AREA(b_cov, c_tol), 0) / 1e6;
    b_d_km2   := SDO_GEOM.SDO_AREA(b_d, c_tol) / 1e6;
    b_pct     := 100 * b_cov_km2 / b_d_km2;
    b_ms      := (DBMS_UTILITY.GET_TIME - t0) * 10;

    DBMS_OUTPUT.PUT_LINE('--- ' || l_name || ' (' || p_code || ')  ' || p_service || ' @ ' || p_dist || ' m, ' || l_n || ' facilities in reach');
    DBMS_OUTPUT.PUT_LINE('  district area  : geodetic ' || TO_CHAR(l_area_true, '990.0000') || ' km2 | UTM ' || TO_CHAR(b_d_km2, '990.0000')
                         || ' km2 | diff ' || TO_CHAR(100 * (b_d_km2 - l_area_true) / l_area_true, 'S0.000') || ' %');
    DBMS_OUTPUT.PUT_LINE('  covered area   : geodetic ' || TO_CHAR(a_cov_km2, '990.0000') || ' km2 | UTM ' || TO_CHAR(b_cov_km2, '990.0000')
                         || ' km2 | diff ' || TO_CHAR(100 * (b_cov_km2 - a_cov_km2) / NULLIF(a_cov_km2, 0), 'S0.000') || ' %');
    DBMS_OUTPUT.PUT_LINE('  coverage %     : geodetic ' || TO_CHAR(a_pct, '990.00') || '     | UTM ' || TO_CHAR(b_pct, '990.00')
                         || '     | diff ' || TO_CHAR(b_pct - a_pct, 'S0.000') || ' points');
    DBMS_OUTPUT.PUT_LINE('  time           : geodetic ' || a_ms || ' ms | UTM ' || b_ms || ' ms');
  END;
BEGIN
  compare('JED-20039239', 'school', 800);   -- السلامة: 24 schools within 800 m (heaviest union)
  compare('JED-20039328', 'school', 800);   -- الروضة
  compare('JED-20039239', 'park',   500);
END;
/
