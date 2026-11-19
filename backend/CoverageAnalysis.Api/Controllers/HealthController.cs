using Microsoft.AspNetCore.Mvc;

namespace CoverageAnalysis.Api.Controllers;

/// <summary>Simple liveness check. Database connectivity is added in phase 3.</summary>
[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "ok", timeUtc = DateTime.UtcNow });
}
