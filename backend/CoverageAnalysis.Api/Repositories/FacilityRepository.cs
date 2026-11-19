using CoverageAnalysis.Api.Data;
using Dapper;

namespace CoverageAnalysis.Api.Repositories;

public interface IFacilityRepository
{
    Task<IReadOnlyList<FacilityRow>> GetAsync(string? serviceType, CancellationToken ct);
}

public sealed class FacilityRepository(IDbConnectionFactory db) : IFacilityRepository
{
    public async Task<IReadOnlyList<FacilityRow>> GetAsync(string? serviceType, CancellationToken ct)
    {
        // DISTRICT_ID comes from the spatial join (03_post_load.sql); NULL = outside every district.
        const string sql = """
            SELECT f.FACILITY_ID, f.OSM_ID, f.OSM_TYPE, f.SERVICE_TYPE, f.SUBTYPE, f.NAME_AR, f.NAME_EN,
                   d.DISTRICT_CODE, SDO_UTIL.TO_GEOJSON(f.GEOM) AS GEO_JSON
            FROM   FACILITIES f
            LEFT   JOIN DISTRICTS d ON d.ID = f.DISTRICT_ID
            WHERE  (:serviceType IS NULL OR f.SERVICE_TYPE = :serviceType)
            ORDER  BY f.SERVICE_TYPE, f.FACILITY_ID
            """;
        using var conn = await db.OpenAsync(ct);
        var rows = await conn.QueryAsync<FacilityRow>(new CommandDefinition(sql, new { serviceType }, cancellationToken: ct));
        return rows.AsList();
    }
}
