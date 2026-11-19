// Loads data/processed/*.geojson into Oracle (GIS_COVERAGE).
// GeoJSON geometry -> SDO_GEOMETRY (SRID 4326) with SDO_UTIL.FROM_GEOJSON, inside one transaction.
// Refuses to run when the tables already contain rows: reloading needs a DELETE, which the user approves first.
//
// Usage (from backend/):  dotnet run --project CoverageAnalysis.DataLoader [-- --data ../data/processed]
using System.Diagnostics;
using CoverageAnalysis.DataLoader;
using Dapper;
using Microsoft.Extensions.Configuration;
using Oracle.ManagedDataAccess.Client;

var config = new ConfigurationBuilder()
    .AddUserSecrets<Program>()
    .AddCommandLine(args)
    .Build();

var connectionString = config.GetConnectionString("Oracle");
if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("ConnectionStrings:Oracle is not set in user-secrets.");
    return 1;
}

var dataDir = Path.GetFullPath(config["data"] ?? Path.Combine(AppContext.BaseDirectory, "../../../../../data/processed"));
Console.WriteLine($"Data folder: {dataDir}");

await using var conn = new OracleConnection(connectionString);
await conn.OpenAsync();

var existing = await conn.ExecuteScalarAsync<int>("SELECT (SELECT COUNT(*) FROM DISTRICTS) + (SELECT COUNT(*) FROM FACILITIES) FROM DUAL");
if (existing > 0)
{
    Console.Error.WriteLine($"DISTRICTS/FACILITIES already contain {existing} rows. Nothing loaded (a reload needs an approved DELETE first).");
    return 2;
}

var sw = Stopwatch.StartNew();
await using var tx = await conn.BeginTransactionAsync();

const string insertDistrict = """
    INSERT INTO DISTRICTS (DISTRICT_CODE, OSM_ID, NAME_AR, NAME_EN, NON_RESIDENTIAL, SHARE_INSIDE_GOV_PCT, GEOM)
    VALUES (:code, :osmId, :nameAr, :nameEn, :nonRes, :sharePct, SDO_UTIL.FROM_GEOJSON(:geom, NULL, 4326))
    """;

var districts = GeoJsonFile.Read(Path.Combine(dataDir, "jeddah_districts.geojson"));
foreach (var d in districts)
{
    var p = new OracleDynamicParameters()
        .Add("code", d.Str("DISTRICT_CODE"), OracleDbType.Varchar2)
        .Add("osmId", d.Num("OSM_ID"), OracleDbType.Decimal)
        .Add("nameAr", d.Str("NAME_AR"), OracleDbType.Varchar2)
        .Add("nameEn", d.Str("NAME_EN"), OracleDbType.Varchar2)
        .Add("nonRes", d.Num("NON_RESIDENTIAL"), OracleDbType.Decimal)
        .Add("sharePct", d.Num("SHARE_INSIDE_GOV_PCT"), OracleDbType.Decimal)
        .Add("geom", d.GeometryJson, OracleDbType.Clob);
    await conn.ExecuteAsync(insertDistrict, p, tx);
}
Console.WriteLine($"districts: {districts.Count}");

const string insertFacility = """
    INSERT INTO FACILITIES (FACILITY_ID, OSM_ID, OSM_TYPE, SERVICE_TYPE, SUBTYPE, NAME_AR, NAME_EN, GEOM_ORIGIN, GEOM)
    VALUES (:fid, :osmId, :osmType, :service, :subtype, :nameAr, :nameEn, :origin, SDO_UTIL.FROM_GEOJSON(:geom, NULL, 4326))
    """;

foreach (var service in new[] { "school", "health", "park" })
{
    var facilities = GeoJsonFile.Read(Path.Combine(dataDir, $"facilities_{service}.geojson"));
    foreach (var f in facilities)
    {
        var p = new OracleDynamicParameters()
            .Add("fid", f.Str("FACILITY_ID"), OracleDbType.Varchar2)
            .Add("osmId", f.Num("OSM_ID"), OracleDbType.Decimal)
            .Add("osmType", f.Str("OSM_TYPE"), OracleDbType.Varchar2)
            .Add("service", f.Str("SERVICE_TYPE"), OracleDbType.Varchar2)
            .Add("subtype", f.Str("SUBTYPE"), OracleDbType.Varchar2)
            .Add("nameAr", f.Str("NAME_AR"), OracleDbType.Varchar2)
            .Add("nameEn", f.Str("NAME_EN"), OracleDbType.Varchar2)
            .Add("origin", f.Str("GEOM_ORIGIN"), OracleDbType.Varchar2)
            .Add("geom", f.GeometryJson, OracleDbType.Clob);
        await conn.ExecuteAsync(insertFacility, p, tx);
    }
    Console.WriteLine($"facilities ({service}): {facilities.Count}");
}

await tx.CommitAsync();
Console.WriteLine($"Committed in {sw.Elapsed.TotalSeconds:F1}s");
return 0;
