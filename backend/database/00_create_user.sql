-- =====================================================================
-- 00_create_user.sql
-- Run ONCE as SYSTEM, connected to the PDB: localhost:1521/FREEPDB1
-- Creates the project schema GIS_COVERAGE (separate from GIS_APP).
--
-- Before running: replace <YOUR_PASSWORD> with a password you choose.
-- Do NOT commit the real password: undo the edit after running.
-- =====================================================================

CREATE USER GIS_COVERAGE IDENTIFIED BY "<YOUR_PASSWORD>"
  DEFAULT TABLESPACE USERS
  TEMPORARY TABLESPACE TEMP
  QUOTA UNLIMITED ON USERS;

GRANT CREATE SESSION   TO GIS_COVERAGE;
GRANT CREATE TABLE     TO GIS_COVERAGE;
GRANT CREATE SEQUENCE  TO GIS_COVERAGE;
GRANT CREATE VIEW      TO GIS_COVERAGE;
GRANT CREATE PROCEDURE TO GIS_COVERAGE;

-- Quick check (should return one row, ACCOUNT_STATUS = OPEN):
SELECT USERNAME, ACCOUNT_STATUS, DEFAULT_TABLESPACE
FROM   DBA_USERS
WHERE  USERNAME = 'GIS_COVERAGE';
