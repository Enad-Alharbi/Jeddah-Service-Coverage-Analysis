namespace CoverageAnalysis.Api.Options;

/// <summary>Analysis settings from appsettings.json ("Coverage" section). Nothing here is hard-coded in code.</summary>
public sealed class CoverageOptions
{
    public const string Section = "Coverage";

    public string[] ServiceTypes { get; init; } = [];
    public int[] DistancesM { get; init; } = [];

    /// <summary>[minLon, minLat, maxLon, maxLat], derived from the real districts' extent (DATA_REPORT.md).</summary>
    public double[] JeddahBoundingBox { get; init; } = [];

    /// <summary>Display-only simplification of result geometries, in meters (SDO_UTIL.SIMPLIFY on geodetic data).</summary>
    public double DisplaySimplifyMeters { get; init; } = 2;

    /// <summary>A full recompute takes ~30 s, longer than Dapper's 30 s default.</summary>
    public int CommandTimeoutSeconds { get; init; } = 300;

    public double DefaultPriorityThreshold { get; init; } = 50;

    public bool IsValidService(string? s) => s is not null && ServiceTypes.Contains(s);
    public bool IsValidDistance(int d) => DistancesM.Contains(d);
}
