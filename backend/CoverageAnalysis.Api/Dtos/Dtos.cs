using System.Text.Json;

namespace CoverageAnalysis.Api.Dtos;

public sealed record DistrictProperties(
    string DistrictCode, long OsmId, string? NameAr, string? NameEn, bool NonResidential, decimal AreaKm2);

public sealed record FacilityProperties(
    string FacilityId, long OsmId, string OsmType, string ServiceType, string? Subtype,
    string? NameAr, string? NameEn, string? DistrictCode);

public sealed record DistrictCoverageDto(
    string DistrictCode, string? NameAr, string? NameEn, bool NonResidential, decimal AreaKm2,
    int FacilityCount, decimal CoveredAreaKm2, decimal UncoveredAreaKm2, decimal CoveragePct,
    JsonElement? CoveredGeom, JsonElement? UncoveredGeom);

/// <summary>City-wide KPIs. Residential districts only (airport, seaport and universities are excluded).</summary>
public sealed record CoverageSummaryDto(
    int ResidentialDistricts, decimal CityCoveragePct, int UnderServedDistricts,
    decimal UncoveredAreaKm2, int FacilityCount);

public sealed record CoverageResponse(
    string ServiceType, int DistanceM, DateTime? ComputedAt, int DistrictsComputedNow, long ComputeMs,
    CoverageSummaryDto Summary, IReadOnlyList<DistrictCoverageDto> Districts);

public sealed record ServiceCoverageDto(
    string ServiceType, int FacilityCount, decimal CoveragePct, decimal CoveredAreaKm2, decimal UncoveredAreaKm2);

public sealed record DistrictDetailResponse(
    string DistrictCode, string? NameAr, string? NameEn, bool NonResidential, decimal AreaKm2, int DistanceM,
    IReadOnlyList<ServiceCoverageDto> Services);

public sealed record PriorityDistrictDto(
    string DistrictCode, string? NameAr, string? NameEn, int UnderServedCount,
    IReadOnlyDictionary<string, decimal> CoveragePctByService);

public sealed record PriorityResponse(int DistanceM, double Threshold, IReadOnlyList<PriorityDistrictDto> Districts);

public sealed record RecomputeItemDto(string ServiceType, int DistanceM, int Districts, long ElapsedMs);

public sealed record RecomputeResponse(IReadOnlyList<RecomputeItemDto> Items, long TotalMs);
