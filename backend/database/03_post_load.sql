-- =====================================================================
-- 03_post_load.sql   (run as GIS_COVERAGE, after the DataLoader)
--   1. Validate every geometry          (SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT)
--   2. Rectify the invalid ones         (SDO_UTIL.RECTIFY_GEOMETRY)  then validate again
--   3. True area of each district       (SDO_GEOM.SDO_AREA on the WGS84 ellipsoid)
--   4. Spatial join: facility -> district (SDO_RELATE, point in polygon)
-- Safe to re-run (only UPDATEs, no deletes).
-- Tolerance 0.05 = 5 cm (geodetic data: tolerance is in meters).
-- =====================================================================

PROMPT ===== 1. Validation BEFORE rectify =====
SELECT 'DISTRICTS' AS TBL, SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05) AS RESULT, COUNT(*) AS N
FROM DISTRICTS GROUP BY SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05)
UNION ALL
SELECT 'FACILITIES', SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05), COUNT(*)
FROM FACILITIES GROUP BY SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05);

PROMPT ===== 2. Rectify invalid geometries (if any) =====
-- RECTIFY_GEOMETRY fixes common problems: duplicate vertices, self-intersections, wrong ring orientation.
UPDATE DISTRICTS  SET GEOM = SDO_UTIL.RECTIFY_GEOMETRY(GEOM, 0.05)
WHERE  SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05) <> 'TRUE';
UPDATE FACILITIES SET GEOM = SDO_UTIL.RECTIFY_GEOMETRY(GEOM, 0.05)
WHERE  SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05) <> 'TRUE';
COMMIT;

PROMPT ===== Validation AFTER rectify (expect only TRUE) =====
SELECT 'DISTRICTS' AS TBL, SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05) AS RESULT, COUNT(*) AS N
FROM DISTRICTS GROUP BY SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05)
UNION ALL
SELECT 'FACILITIES', SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05), COUNT(*)
FROM FACILITIES GROUP BY SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(GEOM, 0.05);

PROMPT ===== 3. True area (km2) =====
-- SRID 4326 is geodetic, so SDO_AREA computes the area on the WGS84 ellipsoid: real km2,
-- not the inflated "square degrees" or Web Mercator area.
UPDATE DISTRICTS SET AREA_KM2 = ROUND(SDO_GEOM.SDO_AREA(GEOM, 0.05, 'unit=SQ_KM'), 6);
COMMIT;

SELECT COUNT(*) AS DISTRICTS, ROUND(SUM(AREA_KM2), 2) AS TOTAL_KM2,
       ROUND(MIN(AREA_KM2), 3) AS MIN_KM2, ROUND(MAX(AREA_KM2), 2) AS MAX_KM2,
       SUM(CASE WHEN AREA_KM2 IS NULL OR AREA_KM2 <= 0 THEN 1 ELSE 0 END) AS ZERO_OR_NULL
FROM DISTRICTS;

PROMPT ===== 4. Spatial join: FACILITIES.DISTRICT_ID =====
-- For each facility, find the district polygon that CONTAINS it, or COVERS it when the point
-- lies exactly on the boundary. SDO_RELATE uses the spatial index on DISTRICTS.GEOM
-- (primary filter on the R-tree MBRs, then the exact secondary filter).
-- MIN(ID) makes a boundary point that touches two districts deterministic.
UPDATE FACILITIES f
SET    DISTRICT_ID = (
         SELECT MIN(d.ID)
         FROM   DISTRICTS d
         WHERE  SDO_RELATE(d.GEOM, f.GEOM, 'mask=CONTAINS+COVERS') = 'TRUE'
       );
COMMIT;

SELECT SERVICE_TYPE,
       COUNT(*)                                            AS TOTAL,
       COUNT(DISTRICT_ID)                                  AS IN_A_DISTRICT,
       SUM(CASE WHEN DISTRICT_ID IS NULL THEN 1 ELSE 0 END) AS OUTSIDE_ALL_DISTRICTS
FROM   FACILITIES
GROUP  BY SERVICE_TYPE
ORDER  BY SERVICE_TYPE;

PROMPT ===== Facilities exactly on a district boundary (matched by COVERS only) =====
SELECT COUNT(*) AS ON_BOUNDARY
FROM   FACILITIES f
WHERE  EXISTS (SELECT 1 FROM DISTRICTS d WHERE SDO_RELATE(d.GEOM, f.GEOM, 'mask=COVERS') = 'TRUE');
