namespace CoverageAnalysis.Api.Dtos;

/// <summary>A what-if site the planner wants to keep. The browser sends its own result; the server re-checks it.</summary>
public sealed record CreateProposalRequest(
    string? ServiceType,
    int DistanceM,
    string? DistrictCode,
    double Lon,
    double Lat,
    decimal ClientCoverageAfter,
    string? Note);

public sealed record ProposalDto(
    long Id,
    string ServiceType,
    int DistanceM,
    string DistrictCode,
    string? NameAr,
    double Lon,
    double Lat,
    decimal CoverageBefore,
    /// <summary>Server value: COVERAGE_PKG.EVALUATE_SITE (UTM method, same as the cached analysis).</summary>
    decimal CoverageAfter,
    /// <summary>What the browser computed with geodesic operators.</summary>
    decimal? ClientCoverageAfter,
    decimal GainKm2,
    string? Note,
    DateTime CreatedAt)
{
    /// <summary>Browser minus server, in percentage points: the client/server agreement check.</summary>
    public decimal? DiffPoints => ClientCoverageAfter is null ? null : Math.Round(ClientCoverageAfter.Value - CoverageAfter, 2);
}
