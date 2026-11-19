-- =====================================================================
-- 01_create_tables.sql   (run as GIS_COVERAGE)
-- Tables for districts, facilities, the coverage cache and what-if proposals.
-- All geometries are SDO_GEOMETRY in SRID 4326 (WGS84 lon/lat).
-- =====================================================================

-- ---------------------------------------------------------------------
-- DISTRICTS: 147 Jeddah districts from OSM (admin_level=10)
-- ---------------------------------------------------------------------
CREATE TABLE DISTRICTS (
  ID                    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  DISTRICT_CODE         VARCHAR2(30 CHAR)  NOT NULL CONSTRAINT DISTRICTS_CODE_UK UNIQUE,
  OSM_ID                NUMBER             NOT NULL,
  NAME_AR               VARCHAR2(200 CHAR),
  NAME_EN               VARCHAR2(200 CHAR),
  -- 1 = airport / seaport / university: shown on the map, excluded from ranking and KPIs
  NON_RESIDENTIAL       NUMBER(1) DEFAULT 0 NOT NULL CONSTRAINT DISTRICTS_NONRES_CK CHECK (NON_RESIDENTIAL IN (0, 1)),
  SHARE_INSIDE_GOV_PCT  NUMBER(5,1),
  -- True (ellipsoidal) area, computed once in Oracle after loading
  AREA_KM2              NUMBER,
  GEOM                  SDO_GEOMETRY       NOT NULL
);

-- ---------------------------------------------------------------------
-- FACILITIES: schools / health / parks as points (areas -> point-on-surface)
-- ---------------------------------------------------------------------
CREATE TABLE FACILITIES (
  ID            NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  FACILITY_ID   VARCHAR2(40 CHAR)  NOT NULL CONSTRAINT FACILITIES_FID_UK UNIQUE,
  OSM_ID        NUMBER             NOT NULL,
  OSM_TYPE      VARCHAR2(10 CHAR)  NOT NULL CONSTRAINT FACILITIES_OSMTYPE_CK CHECK (OSM_TYPE IN ('node', 'way', 'relation')),
  SERVICE_TYPE  VARCHAR2(10 CHAR)  NOT NULL CONSTRAINT FACILITIES_SERVICE_CK CHECK (SERVICE_TYPE IN ('school', 'health', 'park')),
  SUBTYPE       VARCHAR2(40 CHAR),
  NAME_AR       VARCHAR2(300 CHAR),
  NAME_EN       VARCHAR2(300 CHAR),
  GEOM_ORIGIN   VARCHAR2(20 CHAR)  CONSTRAINT FACILITIES_ORIGIN_CK CHECK (GEOM_ORIGIN IN ('node', 'point_on_surface')),
  -- Filled by a spatial join (point in polygon). NULL = outside every district (kept: within 1 km, edge effect)
  DISTRICT_ID   NUMBER CONSTRAINT FACILITIES_DISTRICT_FK REFERENCES DISTRICTS (ID),
  GEOM          SDO_GEOMETRY       NOT NULL
);

-- ---------------------------------------------------------------------
-- COVERAGE_RESULTS: the cache of expensive spatial results
-- one row per (service, walking distance, district)
-- ---------------------------------------------------------------------
CREATE TABLE COVERAGE_RESULTS (
  SERVICE_TYPE        VARCHAR2(10 CHAR) NOT NULL CONSTRAINT COVERAGE_SERVICE_CK CHECK (SERVICE_TYPE IN ('school', 'health', 'park')),
  DISTANCE_M          NUMBER(5)         NOT NULL CONSTRAINT COVERAGE_DISTANCE_CK CHECK (DISTANCE_M IN (500, 800, 1000)),
  DISTRICT_ID         NUMBER            NOT NULL CONSTRAINT COVERAGE_DISTRICT_FK REFERENCES DISTRICTS (ID),
  FACILITY_COUNT      NUMBER            NOT NULL,
  COVERED_AREA_KM2    NUMBER            NOT NULL,
  UNCOVERED_AREA_KM2  NUMBER            NOT NULL,
  COVERAGE_PCT        NUMBER(5,2)       NOT NULL CONSTRAINT COVERAGE_PCT_CK CHECK (COVERAGE_PCT BETWEEN 0 AND 100),
  COVERED_GEOM        SDO_GEOMETRY,
  UNCOVERED_GEOM      SDO_GEOMETRY,
  COMPUTED_AT         TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT COVERAGE_RESULTS_PK PRIMARY KEY (SERVICE_TYPE, DISTANCE_M, DISTRICT_ID)
);

-- ---------------------------------------------------------------------
-- PROPOSED_SITES: what-if sites saved by the planner (priority 2)
-- ---------------------------------------------------------------------
CREATE TABLE PROPOSED_SITES (
  ID               NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  SERVICE_TYPE     VARCHAR2(10 CHAR) NOT NULL CONSTRAINT PROPOSED_SERVICE_CK CHECK (SERVICE_TYPE IN ('school', 'health', 'park')),
  DISTANCE_M       NUMBER(5)         NOT NULL CONSTRAINT PROPOSED_DISTANCE_CK CHECK (DISTANCE_M IN (500, 800, 1000)),
  DISTRICT_ID      NUMBER            NOT NULL CONSTRAINT PROPOSED_DISTRICT_FK REFERENCES DISTRICTS (ID),
  GEOM             SDO_GEOMETRY      NOT NULL,
  COVERAGE_BEFORE  NUMBER(5,2),
  COVERAGE_AFTER   NUMBER(5,2),
  GAIN_KM2         NUMBER,
  NOTE             VARCHAR2(500 CHAR),
  CREATED_AT       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

-- Normal (B-tree) indexes for the attribute filters used by the API
CREATE INDEX FACILITIES_SERVICE_IDX  ON FACILITIES (SERVICE_TYPE);
CREATE INDEX FACILITIES_DISTRICT_IDX ON FACILITIES (DISTRICT_ID);
CREATE INDEX COVERAGE_DISTRICT_IDX   ON COVERAGE_RESULTS (DISTRICT_ID);
CREATE INDEX PROPOSED_LOOKUP_IDX     ON PROPOSED_SITES (SERVICE_TYPE, DISTANCE_M);
CREATE INDEX PROPOSED_DISTRICT_IDX   ON PROPOSED_SITES (DISTRICT_ID);
