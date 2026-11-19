using CoverageAnalysis.Api.Dtos;
using CoverageAnalysis.Api.Options;
using CoverageAnalysis.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace CoverageAnalysis.Api.Controllers;

[ApiController]
[Route("api")]
[Produces("application/json")]
public class MapDataController(IMapDataService mapData, IOptions<CoverageOptions> options) : ControllerBase
{
    /// <summary>All Jeddah districts (OSM admin_level=10) as a GeoJSON FeatureCollection (WGS84).</summary>
    [HttpGet("districts")]
    [ProducesResponseType<FeatureCollection<DistrictProperties>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDistricts(CancellationToken ct) => Ok(await mapData.GetDistrictsAsync(ct));

    /// <summary>Facilities as GeoJSON points. Omit serviceType for all three services.</summary>
    /// <param name="serviceType">school | health | park</param>
    [HttpGet("facilities")]
    [ProducesResponseType<FeatureCollection<FacilityProperties>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetFacilities([FromQuery] string? serviceType, CancellationToken ct)
    {
        if (serviceType is not null && !options.Value.IsValidService(serviceType))
        {
            ModelState.AddModelError(nameof(serviceType), $"Must be one of: {string.Join(", ", options.Value.ServiceTypes)}.");
            return ValidationProblem(ModelState);
        }
        return Ok(await mapData.GetFacilitiesAsync(serviceType, ct));
    }
}
