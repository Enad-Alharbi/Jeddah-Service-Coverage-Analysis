using System.Data;
using CoverageAnalysis.Api.Data;
using CoverageAnalysis.Api.Options;
using Dapper;
using Microsoft.Extensions.Options;

namespace CoverageAnalysis.Api.Repositories;

public sealed class ProposalRow
{
    public long Id { get; set; }
    public string ServiceType { get; set; } = "";
    public int DistanceM { get; set; }
    public string DistrictCode { get; set; } = "";
    public string? NameAr { get; set; }
    public double Lon { get; set; }
    public double Lat { get; set; }
    public decimal CoverageBefore { get; set; }
    public decimal CoverageAfter { get; set; }
    public decimal? ClientCoverageAfter { get; set; }
    public decimal GainKm2 { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class SiteEvaluation
{
    public long DistrictId { get; set; }
    public decimal AreaKm2 { get; set; }
    public decimal CoverageBefore { get; set; }
    public decimal CoverageAfter { get; set; }
}

public interface IProposalRepository
{
    /// <summary>Null when the point is not inside that district (spatial check in Oracle).</summary>
    Task<SiteEvaluation?> EvaluateAsync(string serviceType, int distanceM, string districtCode, double lon, double lat, CancellationToken ct);
    Task<long> InsertAsync(string serviceType, int distanceM, SiteEvaluation eval, double lon, double lat,
        decimal gainKm2, decimal clientCoverageAfter, string? note, CancellationToken ct);
    Task<IReadOnlyList<ProposalRow>> GetAsync(string? serviceType, int? distanceM, CancellationToken ct);
}

public sealed class ProposalRepository(IDbConnectionFactory db, IOptions<CoverageOptions> options) : IProposalRepository
{
    private readonly int _timeout = options.Value.CommandTimeoutSeconds;

    public async Task<SiteEvaluation?> EvaluateAsync(string serviceType, int distanceM, string districtCode, double lon, double lat, CancellationToken ct)
    {
        // 1) the point must lie inside the given district (CONTAINS, or COVERS for a point on the border);
        // 2) "before" = the cached coverage; 3) "after" = COVERAGE_PKG.EVALUATE_SITE with the extra facility.
        const string sql = """
            SELECT d.ID AS DISTRICT_ID, d.AREA_KM2, r.COVERAGE_PCT AS COVERAGE_BEFORE,
                   COVERAGE_PKG.EVALUATE_SITE(:serviceType, :distanceM, d.ID, :lon, :lat) AS COVERAGE_AFTER
            FROM   DISTRICTS d
            JOIN   COVERAGE_RESULTS r
                   ON r.DISTRICT_ID = d.ID AND r.SERVICE_TYPE = :serviceType AND r.DISTANCE_M = :distanceM
            WHERE  d.DISTRICT_CODE = :districtCode
            AND    SDO_RELATE(d.GEOM, SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(:lon, :lat, NULL), NULL, NULL),
                              'mask=CONTAINS+COVERS') = 'TRUE'
            """;
        using var conn = await db.OpenAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<SiteEvaluation>(new CommandDefinition(sql,
            new { serviceType, distanceM, districtCode, lon, lat }, commandTimeout: _timeout, cancellationToken: ct));
    }

    public async Task<long> InsertAsync(string serviceType, int distanceM, SiteEvaluation eval, double lon, double lat,
        decimal gainKm2, decimal clientCoverageAfter, string? note, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO PROPOSED_SITES
              (SERVICE_TYPE, DISTANCE_M, DISTRICT_ID, GEOM, COVERAGE_BEFORE, COVERAGE_AFTER, CLIENT_COVERAGE_AFTER, GAIN_KM2, NOTE)
            VALUES
              (:serviceType, :distanceM, :districtId, SDO_GEOMETRY(2001, 4326, SDO_POINT_TYPE(:lon, :lat, NULL), NULL, NULL),
               :before, :after, :clientAfter, :gainKm2, :note)
            RETURNING ID INTO :id
            """;
        var p = new DynamicParameters(new
        {
            serviceType, distanceM, districtId = eval.DistrictId, lon, lat,
            before = eval.CoverageBefore, after = eval.CoverageAfter, clientAfter = clientCoverageAfter, gainKm2, note,
        });
        p.Add("id", dbType: DbType.Decimal, direction: ParameterDirection.Output);
        using var conn = await db.OpenAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(sql, p, cancellationToken: ct));
        return (long)p.Get<decimal>("id");
    }

    public async Task<IReadOnlyList<ProposalRow>> GetAsync(string? serviceType, int? distanceM, CancellationToken ct)
    {
        const string sql = """
            SELECT p.ID, p.SERVICE_TYPE, p.DISTANCE_M, d.DISTRICT_CODE, d.NAME_AR,
                   p.GEOM.SDO_POINT.X AS LON, p.GEOM.SDO_POINT.Y AS LAT,
                   p.COVERAGE_BEFORE, p.COVERAGE_AFTER, p.CLIENT_COVERAGE_AFTER, p.GAIN_KM2, p.NOTE, p.CREATED_AT
            FROM   PROPOSED_SITES p
            JOIN   DISTRICTS d ON d.ID = p.DISTRICT_ID
            WHERE  (:serviceType IS NULL OR p.SERVICE_TYPE = :serviceType)
            AND    (:distanceM IS NULL OR p.DISTANCE_M = :distanceM)
            ORDER  BY p.CREATED_AT DESC
            """;
        using var conn = await db.OpenAsync(ct);
        var rows = await conn.QueryAsync<ProposalRow>(new CommandDefinition(sql, new { serviceType, distanceM }, cancellationToken: ct));
        return rows.AsList();
    }
}
