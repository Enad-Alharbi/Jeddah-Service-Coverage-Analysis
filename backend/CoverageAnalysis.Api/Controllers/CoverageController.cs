using CoverageAnalysis.Api.Dtos;
using CoverageAnalysis.Api.Options;
using CoverageAnalysis.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace CoverageAnalysis.Api.Controllers;

[ApiController]
[Route("api/coverage")]
[Produces("application/json")]
public class CoverageController(ICoverageService service, IOptions<CoverageOptions> options, IWebHostEnvironment env) : ControllerBase
{
    private readonly CoverageOptions _opt = options.Value;

    /// <summary>
    /// Per-district coverage for one service and walking distance, with covered / uncovered geometry (GeoJSON).
    /// Computed in Oracle on first request and cached in COVERAGE_RESULTS.
    /// </summary>
    /// <param name="serviceType">school | health | park</param>
    /// <param name="distance">Walking distance in meters: 500 | 800 | 1000</param>
    [HttpGet]
    [ProducesResponseType<CoverageResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Get([FromQuery] string? serviceType, [FromQuery] int? distance, CancellationToken ct)
    {
        ValidateService(serviceType, required: true);
        ValidateDistance(distance, required: true);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return Ok(await service.GetCoverageAsync(serviceType!, distance!.Value, ct));
    }

    /// <summary>One district: coverage for all three services at the chosen distance.</summary>
    /// <param name="code">District code, e.g. JED-20039328</param>
    /// <param name="distance">500 | 800 | 1000</param>
    [HttpGet("district/{code}")]
    [ProducesResponseType<DistrictDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDistrict(string code, [FromQuery] int? distance, CancellationToken ct)
    {
        ValidateDistance(distance, required: true);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);

        var result = await service.GetDistrictAsync(code, distance!.Value, ct);
        return result is null
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "District not found", detail: $"No district with code '{code}'.")
            : Ok(result);
    }

    /// <summary>Residential districts under the threshold (%) in two or more services: the planning priority list.</summary>
    /// <param name="distance">500 | 800 | 1000</param>
    /// <param name="threshold">Coverage % below which a service counts as under-served (default 50)</param>
    [HttpGet("priority")]
    [ProducesResponseType<PriorityResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetPriority([FromQuery] int? distance, [FromQuery] double? threshold, CancellationToken ct)
    {
        ValidateDistance(distance, required: true);
        var t = threshold ?? _opt.DefaultPriorityThreshold;
        if (t is <= 0 or > 100) ModelState.AddModelError(nameof(threshold), "Must be greater than 0 and at most 100.");
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return Ok(await service.GetPriorityAsync(distance!.Value, t, ct));
    }

    /// <summary>Development only: recompute the cache. Omit both parameters for a full run (3 services x 3 distances).</summary>
    [HttpPost("recompute")]
    [ProducesResponseType<RecomputeResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Recompute([FromQuery] string? serviceType, [FromQuery] int? distance, CancellationToken ct)
    {
        if (!env.IsDevelopment()) return NotFound();
        ValidateService(serviceType, required: false);
        ValidateDistance(distance, required: false);
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        return Ok(await service.RecomputeAsync(serviceType, distance, ct));
    }

    private void ValidateService(string? serviceType, bool required)
    {
        if (serviceType is null && !required) return;
        if (!_opt.IsValidService(serviceType))
            ModelState.AddModelError(nameof(serviceType), $"Must be one of: {string.Join(", ", _opt.ServiceTypes)}.");
    }

    private void ValidateDistance(int? distance, bool required)
    {
        if (distance is null && !required) return;
        if (distance is null || !_opt.IsValidDistance(distance.Value))
            ModelState.AddModelError(nameof(distance), $"Must be one of: {string.Join(", ", _opt.DistancesM)} (meters).");
    }
}
