namespace CoverageAnalysis.Api.Repositories;

// Dapper row types. Column names like DISTRICT_CODE map to DistrictCode (MatchNamesWithUnderscores).
// Oracle NUMBER(1) flags are read as int (Dapper can't convert NUMBER straight to bool).

public sealed class DistrictRow
{
    public long Id { get; set; }
    public string DistrictCode { get; set; } = "";
    public long OsmId { get; set; }
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public int NonResidential { get; set; }
    public decimal AreaKm2 { get; set; }
    public string? GeoJson { get; set; }
}

public sealed class FacilityRow
{
    public string FacilityId { get; set; } = "";
    public long OsmId { get; set; }
    public string OsmType { get; set; } = "";
    public string ServiceType { get; set; } = "";
    public string? Subtype { get; set; }
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public string? DistrictCode { get; set; }
    public string? GeoJson { get; set; }
}

public sealed class CoverageRow
{
    public string ServiceType { get; set; } = "";
    public string DistrictCode { get; set; } = "";
    public string? NameAr { get; set; }
    public string? NameEn { get; set; }
    public int NonResidential { get; set; }
    public decimal AreaKm2 { get; set; }
    public int FacilityCount { get; set; }
    public decimal CoveredAreaKm2 { get; set; }
    public decimal UncoveredAreaKm2 { get; set; }
    public decimal CoveragePct { get; set; }
    public DateTime ComputedAt { get; set; }
    public string? CoveredGeoJson { get; set; }
    public string? UncoveredGeoJson { get; set; }
}

public sealed record ComputeResult(int Districts, long ElapsedMs);
