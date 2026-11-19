-- =====================================================================
-- 02_spatial_metadata_indexes.sql   (run as GIS_COVERAGE, after 01)
--
-- 1) USER_SDO_GEOM_METADATA: tells Oracle each geometry column's SRID, bounds and tolerance.
--    A spatial index cannot be created without it.
-- 2) Spatial indexes (MDSYS.SPATIAL_INDEX_V2, R-tree). Spatial operators such as SDO_RELATE,
--    SDO_WITHIN_DISTANCE and SDO_ANYINTERACT REQUIRE a spatial index on the searched column.
--
-- Tolerance 0.05: for geodetic data (SRID 4326) Oracle reads the tolerance in METERS,
-- so two points closer than 5 cm are treated as the same point. Bounds are whole-world lon/lat.
-- =====================================================================

DECLARE
  PROCEDURE add_meta(p_table VARCHAR2, p_column VARCHAR2) IS
    n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO n FROM USER_SDO_GEOM_METADATA WHERE TABLE_NAME = p_table AND COLUMN_NAME = p_column;
    IF n = 0 THEN
      INSERT INTO USER_SDO_GEOM_METADATA (TABLE_NAME, COLUMN_NAME, DIMINFO, SRID)
      VALUES (
        p_table, p_column,
        SDO_DIM_ARRAY(
          SDO_DIM_ELEMENT('Longitude', -180, 180, 0.05),
          SDO_DIM_ELEMENT('Latitude',   -90,  90, 0.05)
        ),
        4326
      );
    END IF;
  END;
BEGIN
  add_meta('DISTRICTS',        'GEOM');
  add_meta('FACILITIES',       'GEOM');
  add_meta('COVERAGE_RESULTS', 'COVERED_GEOM');
  add_meta('COVERAGE_RESULTS', 'UNCOVERED_GEOM');
  add_meta('PROPOSED_SITES',   'GEOM');
  COMMIT;
END;
/

-- layer_gtype restricts what the column may hold and lets Oracle optimise the index.
-- MULTIPOLYGON accepts polygons (2003) AND multipolygons (2007); POLYGON rejects 2007 with ORA-13375,
-- and 4 districts are multi-part. POINT enables point-specific optimisations.
-- The coverage geometries are results of intersection/difference and may be collections,
-- so they get no gtype restriction.
CREATE INDEX DISTRICTS_GEOM_SIDX ON DISTRICTS (GEOM)
  INDEXTYPE IS MDSYS.SPATIAL_INDEX_V2 PARAMETERS ('layer_gtype=MULTIPOLYGON');

CREATE INDEX FACILITIES_GEOM_SIDX ON FACILITIES (GEOM)
  INDEXTYPE IS MDSYS.SPATIAL_INDEX_V2 PARAMETERS ('layer_gtype=POINT');

CREATE INDEX COVERAGE_COVERED_SIDX ON COVERAGE_RESULTS (COVERED_GEOM)
  INDEXTYPE IS MDSYS.SPATIAL_INDEX_V2;

CREATE INDEX COVERAGE_UNCOVERED_SIDX ON COVERAGE_RESULTS (UNCOVERED_GEOM)
  INDEXTYPE IS MDSYS.SPATIAL_INDEX_V2;

CREATE INDEX PROPOSED_GEOM_SIDX ON PROPOSED_SITES (GEOM)
  INDEXTYPE IS MDSYS.SPATIAL_INDEX_V2 PARAMETERS ('layer_gtype=POINT');
