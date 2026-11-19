using CoverageAnalysis.Api.Dtos;
using CoverageAnalysis.Api.Repositories;

namespace CoverageAnalysis.Api.Services;

public interface IProposalService
{
    /// <summary>Null when the point is not inside the given district.</summary>
    Task<ProposalDto?> CreateAsync(CreateProposalRequest req, CancellationToken ct);
    Task<IReadOnlyList<ProposalDto>> GetAsync(string? serviceType, int? distanceM, CancellationToken ct);
}

public sealed class ProposalService(IProposalRepository proposals, ICoverageService coverage, ILogger<ProposalService> logger) : IProposalService
{
    public async Task<ProposalDto?> CreateAsync(CreateProposalRequest req, CancellationToken ct)
    {
        // "Before" comes from the cache, so make sure it exists for this service + distance.
        await coverage.EnsureCachedAsync(req.ServiceType!, req.DistanceM, ct);

        var eval = await proposals.EvaluateAsync(req.ServiceType!, req.DistanceM, req.DistrictCode!, req.Lon, req.Lat, ct);
        if (eval is null) return null;

        // Same convention as the cache: km2 = coverage ratio x the district's ellipsoidal area.
        var gainKm2 = Math.Round((eval.CoverageAfter - eval.CoverageBefore) / 100m * eval.AreaKm2, 4);
        var id = await proposals.InsertAsync(req.ServiceType!, req.DistanceM, eval, req.Lon, req.Lat, gainKm2,
            req.ClientCoverageAfter, string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim(), ct);

        logger.LogInformation("Proposal {Id} in {District}: {Before}% -> server {After}% / browser {Client}%",
            id, req.DistrictCode, eval.CoverageBefore, eval.CoverageAfter, req.ClientCoverageAfter);

        var saved = await proposals.GetAsync(req.ServiceType, req.DistanceM, ct);
        return saved.Where(p => p.Id == id).Select(ToDto).Single();
    }

    public async Task<IReadOnlyList<ProposalDto>> GetAsync(string? serviceType, int? distanceM, CancellationToken ct) =>
        (await proposals.GetAsync(serviceType, distanceM, ct)).Select(ToDto).ToList();

    private static ProposalDto ToDto(ProposalRow r) => new(r.Id, r.ServiceType, r.DistanceM, r.DistrictCode, r.NameAr,
        r.Lon, r.Lat, r.CoverageBefore, r.CoverageAfter, r.ClientCoverageAfter, r.GainKm2, r.Note, r.CreatedAt);
}
