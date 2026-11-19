using CoverageAnalysis.Api.Dtos;
using CoverageAnalysis.Api.Options;
using CoverageAnalysis.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace CoverageAnalysis.Api.Controllers;

[ApiController]
[Route("api/proposals")]
[Produces("application/json")]
public class ProposalsController(IProposalService service, IOptions<CoverageOptions> options) : ControllerBase
{
    private readonly CoverageOptions _opt = options.Value;

    /// <summary>
    /// Save a what-if site. The server re-computes "after" in Oracle (COVERAGE_PKG.EVALUATE_SITE) and stores it
    /// next to the browser's value, so the response shows how closely they agree (diffPoints).
    /// </summary>
    [HttpPost]
    [ProducesResponseType<ProposalDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Create(CreateProposalRequest req, CancellationToken ct)
    {
        if (!_opt.IsValidService(req.ServiceType))
            ModelState.AddModelError(nameof(req.ServiceType), $"Must be one of: {string.Join(", ", _opt.ServiceTypes)}.");
        if (!_opt.IsValidDistance(req.DistanceM))
            ModelState.AddModelError(nameof(req.DistanceM), $"Must be one of: {string.Join(", ", _opt.DistancesM)} (meters).");
        if (string.IsNullOrWhiteSpace(req.DistrictCode))
            ModelState.AddModelError(nameof(req.DistrictCode), "Required.");
        if (!InsideJeddahBox(req.Lon, req.Lat))
            ModelState.AddModelError("coordinates", "The point is outside Jeddah's bounding box (from the real districts' extent).");
        if (req.ClientCoverageAfter is < 0 or > 100)
            ModelState.AddModelError(nameof(req.ClientCoverageAfter), "Must be between 0 and 100.");
        if (req.Note is { Length: > 500 })
            ModelState.AddModelError(nameof(req.Note), "At most 500 characters.");
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var created = await service.CreateAsync(req, ct);
        if (created is null)
            return Problem(statusCode: StatusCodes.Status422UnprocessableEntity, title: "Point not in district",
                detail: $"The point ({req.Lon}, {req.Lat}) is not inside district '{req.DistrictCode}'.");

        return CreatedAtAction(nameof(Get), new { serviceType = created.ServiceType, distance = created.DistanceM }, created);
    }

    /// <summary>Saved what-if sites, newest first. Both filters are optional.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<ProposalDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Get([FromQuery] string? serviceType, [FromQuery] int? distance, CancellationToken ct)
    {
        if (serviceType is not null && !_opt.IsValidService(serviceType))
            ModelState.AddModelError(nameof(serviceType), $"Must be one of: {string.Join(", ", _opt.ServiceTypes)}.");
        if (distance is not null && !_opt.IsValidDistance(distance.Value))
            ModelState.AddModelError(nameof(distance), $"Must be one of: {string.Join(", ", _opt.DistancesM)} (meters).");
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return Ok(await service.GetAsync(serviceType, distance, ct));
    }

    private bool InsideJeddahBox(double lon, double lat) =>
        _opt.JeddahBoundingBox is [var minX, var minY, var maxX, var maxY]
        && lon >= minX && lon <= maxX && lat >= minY && lat <= maxY;
}
