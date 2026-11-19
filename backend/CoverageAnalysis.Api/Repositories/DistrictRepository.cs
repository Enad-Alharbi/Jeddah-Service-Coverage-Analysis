using CoverageAnalysis.Api.Data;
using Dapper;

namespace CoverageAnalysis.Api.Repositories;

public interface IDistrictRepository
{
    Task<IReadOnlyList<DistrictRow>> GetAllAsync(CancellationToken ct);
    Task<DistrictRow?> GetByCodeAsync(string code, CancellationToken ct);
}

public sealed class DistrictRepository(IDbConnectionFactory db) : IDistrictRepository
{
    // Districts were already simplified (topology-preserving, 5 m) in the data pipeline, so they are sent as stored.
    private const string Columns = """
        ID, DISTRICT_CODE, OSM_ID, NAME_AR, NAME_EN, NON_RESIDENTIAL, AREA_KM2
        """;

    public async Task<IReadOnlyList<DistrictRow>> GetAllAsync(CancellationToken ct)
    {
        using var conn = await db.OpenAsync(ct);
        var rows = await conn.QueryAsync<DistrictRow>(new CommandDefinition(
            $"SELECT {Columns}, SDO_UTIL.TO_GEOJSON(GEOM) AS GEO_JSON FROM DISTRICTS ORDER BY DISTRICT_CODE",
            cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<DistrictRow?> GetByCodeAsync(string code, CancellationToken ct)
    {
        using var conn = await db.OpenAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<DistrictRow>(new CommandDefinition(
            $"SELECT {Columns} FROM DISTRICTS WHERE DISTRICT_CODE = :code",
            new { code }, cancellationToken: ct));
    }
}
