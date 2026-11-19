using CoverageAnalysis.Api.Dtos;
using CoverageAnalysis.Api.Options;
using CoverageAnalysis.Api.Repositories;
using Microsoft.Extensions.Options;

namespace CoverageAnalysis.Api.Services;

public interface ICoverageService
{
    Task<CoverageResponse> GetCoverageAsync(string serviceType, int distanceM, CancellationToken ct);
    Task<DistrictDetailResponse?> GetDistrictAsync(string districtCode, int distanceM, CancellationToken ct);
    Task<PriorityResponse> GetPriorityAsync(int distanceM, double threshold, CancellationToken ct);
    Task<RecomputeResponse> RecomputeAsync(string? serviceType, int? distanceM, CancellationToken ct);

    /// <summary>Fills missing cache rows for one service + distance (no-op when complete).</summary>
    Task<ComputeResult> EnsureCachedAsync(string serviceType, int distanceM, CancellationToken ct);
}

public sealed class CoverageService(
    ICoverageRepository coverage,
    IDistrictRepository districts,
    IOptions<CoverageOptions> options,
    ILogger<CoverageService> logger) : ICoverageService
{
    // One computation at a time: two requests that both find the cache empty would otherwise
    // compute the same rows twice and race on the INSERT.
    private static readonly SemaphoreSlim ComputeLock = new(1, 1);
    private readonly CoverageOptions _opt = options.Value;

    public async Task<CoverageResponse> GetCoverageAsync(string serviceType, int distanceM, CancellationToken ct)
    {
        var computed = await EnsureCachedAsync(serviceType, distanceM, ct);
        var rows = await coverage.GetResultsAsync(serviceType, distanceM, withGeometry: true, ct);
        var facilityCount = await coverage.CountFacilitiesAsync(serviceType, ct);

        var residential = rows.Where(r => r.NonResidential == 0).ToList();
        var totalArea = residential.Sum(r => r.AreaKm2);
        var summary = new CoverageSummaryDto(
            ResidentialDistricts: residential.Count,
            // Area-weighted: covered km2 / total km2, not the average of district percentages.
            CityCoveragePct: totalArea == 0 ? 0 : Math.Round(100 * residential.Sum(r => r.CoveredAreaKm2) / totalArea, 2),
            UnderServedDistricts: residential.Count(r => r.CoveragePct < (decimal)_opt.DefaultPriorityThreshold),
            UncoveredAreaKm2: Math.Round(residential.Sum(r => r.UncoveredAreaKm2), 3),
            FacilityCount: facilityCount);

        var dtos = rows.Select(r => new DistrictCoverageDto(
            r.DistrictCode, r.NameAr, r.NameEn, r.NonResidential == 1, r.AreaKm2, r.FacilityCount,
            r.CoveredAreaKm2, r.UncoveredAreaKm2, r.CoveragePct,
            GeoJsonText.Parse(r.CoveredGeoJson), GeoJsonText.Parse(r.UncoveredGeoJson))).ToList();

        return new CoverageResponse(serviceType, distanceM, rows.Count == 0 ? null : rows.Max(r => r.ComputedAt),
            computed.Districts, computed.ElapsedMs, summary, dtos);
    }

    public async Task<DistrictDetailResponse?> GetDistrictAsync(string districtCode, int distanceM, CancellationToken ct)
    {
        var district = await districts.GetByCodeAsync(districtCode, ct);
        if (district is null) return null;

        foreach (var s in _opt.ServiceTypes) await EnsureCachedAsync(s, distanceM, ct);
        var rows = await coverage.GetForDistrictAsync(districtCode, distanceM, ct);

        var services = _opt.ServiceTypes
            .Select(s => rows.Single(r => r.ServiceType == s))
            .Select(r => new ServiceCoverageDto(r.ServiceType, r.FacilityCount, r.CoveragePct, r.CoveredAreaKm2, r.UncoveredAreaKm2))
            .ToList();

        return new DistrictDetailResponse(district.DistrictCode, district.NameAr, district.NameEn,
            district.NonResidential == 1, district.AreaKm2, distanceM, services);
    }

    public async Task<PriorityResponse> GetPriorityAsync(int distanceM, double threshold, CancellationToken ct)
    {
        var all = new List<CoverageRow>();
        foreach (var s in _opt.ServiceTypes)
        {
            await EnsureCachedAsync(s, distanceM, ct);
            all.AddRange(await coverage.GetResultsAsync(s, distanceM, withGeometry: false, ct));
        }

        // Planning priority: residential districts under the threshold in two or more services.
        var result = all
            .Where(r => r.NonResidential == 0)
            .GroupBy(r => r.DistrictCode)
            .Select(g => new PriorityDistrictDto(
                g.Key, g.First().NameAr, g.First().NameEn,
                g.Count(r => r.CoveragePct < (decimal)threshold),
                g.ToDictionary(r => r.ServiceType, r => r.CoveragePct)))
            .Where(p => p.UnderServedCount >= 2)
            .OrderByDescending(p => p.UnderServedCount)
            .ThenBy(p => p.CoveragePctByService.Values.Average())
            .ToList();

        return new PriorityResponse(distanceM, threshold, result);
    }

    public async Task<RecomputeResponse> RecomputeAsync(string? serviceType, int? distanceM, CancellationToken ct)
    {
        var services = serviceType is null ? _opt.ServiceTypes : [serviceType];
        var distances = distanceM is null ? _opt.DistancesM : [distanceM.Value];
        var items = new List<RecomputeItemDto>();

        await ComputeLock.WaitAsync(ct);
        try
        {
            foreach (var s in services)
            foreach (var d in distances)
            {
                var r = await coverage.RecomputeAsync(s, d, ct);
                items.Add(new RecomputeItemDto(s, d, r.Districts, r.ElapsedMs));
                logger.LogInformation("Recomputed {Service} {Distance} m: {Districts} districts in {Ms} ms", s, d, r.Districts, r.ElapsedMs);
            }
        }
        finally
        {
            ComputeLock.Release();
        }
        return new RecomputeResponse(items, items.Sum(i => i.ElapsedMs));
    }

    public async Task<ComputeResult> EnsureCachedAsync(string serviceType, int distanceM, CancellationToken ct)
    {
        await ComputeLock.WaitAsync(ct);
        try
        {
            var r = await coverage.EnsureAsync(serviceType, distanceM, ct);
            if (r.Districts > 0)
                logger.LogInformation("Cache filled for {Service} {Distance} m: {Districts} districts in {Ms} ms", serviceType, distanceM, r.Districts, r.ElapsedMs);
            return r;
        }
        finally
        {
            ComputeLock.Release();
        }
    }
}
