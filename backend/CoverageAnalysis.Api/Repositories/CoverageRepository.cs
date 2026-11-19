using System.Data;
using CoverageAnalysis.Api.Data;
using CoverageAnalysis.Api.Options;
using Dapper;
using Microsoft.Extensions.Options;

namespace CoverageAnalysis.Api.Repositories;

public interface ICoverageRepository
{
    /// <summary>Computes only districts missing from the cache (COVERAGE_PKG.ENSURE).</summary>
    Task<ComputeResult> EnsureAsync(string serviceType, int distanceM, CancellationToken ct);

    /// <summary>Recomputes every district (COVERAGE_PKG.COMPUTE) and overwrites the cache rows.</summary>
    Task<ComputeResult> RecomputeAsync(string serviceType, int distanceM, CancellationToken ct);

    Task<IReadOnlyList<CoverageRow>> GetResultsAsync(string serviceType, int distanceM, bool withGeometry, CancellationToken ct);

    Task<IReadOnlyList<CoverageRow>> GetForDistrictAsync(string districtCode, int distanceM, CancellationToken ct);

    Task<int> CountFacilitiesAsync(string serviceType, CancellationToken ct);
}

/// <summary>
/// The spatial work (buffer, union, intersection, difference, area) lives in the PL/SQL package COVERAGE_PKG
/// (backend/database/06_coverage_pkg.sql). This repository calls it and reads the cached results.
/// </summary>
public sealed class CoverageRepository(IDbConnectionFactory db, IOptions<CoverageOptions> options) : ICoverageRepository
{
    private readonly CoverageOptions _opt = options.Value;

    public Task<ComputeResult> EnsureAsync(string serviceType, int distanceM, CancellationToken ct) =>
        RunProcedureAsync("COVERAGE_PKG.ENSURE", serviceType, distanceM, includeDistrict: false, ct);

    public Task<ComputeResult> RecomputeAsync(string serviceType, int distanceM, CancellationToken ct) =>
        RunProcedureAsync("COVERAGE_PKG.COMPUTE", serviceType, distanceM, includeDistrict: true, ct);

    private async Task<ComputeResult> RunProcedureAsync(string proc, string serviceType, int distanceM, bool includeDistrict, CancellationToken ct)
    {
        var p = new DynamicParameters();
        p.Add("p_service", serviceType);
        p.Add("p_distance", distanceM);
        if (includeDistrict)
        {
            p.Add("p_district_id", null, DbType.Decimal);
            p.Add("p_union", "SET");
        }
        p.Add("p_rows", dbType: DbType.Decimal, direction: ParameterDirection.Output);
        p.Add("p_elapsed_ms", dbType: DbType.Decimal, direction: ParameterDirection.Output);

        using var conn = await db.OpenAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(proc, p, commandType: CommandType.StoredProcedure,
            commandTimeout: _opt.CommandTimeoutSeconds, cancellationToken: ct));
        return new ComputeResult((int)p.Get<decimal>("p_rows"), (long)p.Get<decimal>("p_elapsed_ms"));
    }

    public async Task<IReadOnlyList<CoverageRow>> GetResultsAsync(string serviceType, int distanceM, bool withGeometry, CancellationToken ct)
    {
        // Display geometry: SDO_UTIL.SIMPLIFY (threshold in meters for geodetic data). Measurements are NOT
        // affected: the areas were computed on the full-detail geometry and stored as numbers.
        var geomColumns = withGeometry
            ? """
              , CASE WHEN r.COVERED_GEOM IS NOT NULL THEN SDO_UTIL.TO_GEOJSON(
                    NVL(SDO_UTIL.SIMPLIFY(r.COVERED_GEOM, :simplifyM, 0.05), r.COVERED_GEOM)) END AS COVERED_GEO_JSON
              , CASE WHEN r.UNCOVERED_GEOM IS NOT NULL THEN SDO_UTIL.TO_GEOJSON(
                    NVL(SDO_UTIL.SIMPLIFY(r.UNCOVERED_GEOM, :simplifyM, 0.05), r.UNCOVERED_GEOM)) END AS UNCOVERED_GEO_JSON
              """
            : "";
        var sql = $"""
            SELECT r.SERVICE_TYPE, d.DISTRICT_CODE, d.NAME_AR, d.NAME_EN, d.NON_RESIDENTIAL, d.AREA_KM2,
                   r.FACILITY_COUNT, r.COVERED_AREA_KM2, r.UNCOVERED_AREA_KM2, r.COVERAGE_PCT, r.COMPUTED_AT
                   {geomColumns}
            FROM   COVERAGE_RESULTS r
            JOIN   DISTRICTS d ON d.ID = r.DISTRICT_ID
            WHERE  r.SERVICE_TYPE = :serviceType AND r.DISTANCE_M = :distanceM
            ORDER  BY r.COVERAGE_PCT, d.DISTRICT_CODE
            """;
        using var conn = await db.OpenAsync(ct);
        var rows = await conn.QueryAsync<CoverageRow>(new CommandDefinition(sql,
            new { serviceType, distanceM, simplifyM = _opt.DisplaySimplifyMeters }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<IReadOnlyList<CoverageRow>> GetForDistrictAsync(string districtCode, int distanceM, CancellationToken ct)
    {
        const string sql = """
            SELECT r.SERVICE_TYPE, d.DISTRICT_CODE, d.NAME_AR, d.NAME_EN, d.NON_RESIDENTIAL, d.AREA_KM2,
                   r.FACILITY_COUNT, r.COVERED_AREA_KM2, r.UNCOVERED_AREA_KM2, r.COVERAGE_PCT, r.COMPUTED_AT
            FROM   COVERAGE_RESULTS r
            JOIN   DISTRICTS d ON d.ID = r.DISTRICT_ID
            WHERE  d.DISTRICT_CODE = :districtCode AND r.DISTANCE_M = :distanceM
            """;
        using var conn = await db.OpenAsync(ct);
        var rows = await conn.QueryAsync<CoverageRow>(new CommandDefinition(sql, new { districtCode, distanceM }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<int> CountFacilitiesAsync(string serviceType, CancellationToken ct)
    {
        using var conn = await db.OpenAsync(ct);
        return await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM FACILITIES WHERE SERVICE_TYPE = :serviceType", new { serviceType }, cancellationToken: ct));
    }
}
