using CoverageAnalysis.Api.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace CoverageAnalysis.Tests;

internal static class TestHelpers
{
    /// <summary>Same values as appsettings.json (Coverage section).</summary>
    public static CoverageOptions Options() => new()
    {
        ServiceTypes = ["school", "health", "park"],
        DistancesM = [500, 800, 1000],
        JeddahBoundingBox = [38.94686, 21.05161, 39.42693, 21.99678],
        DefaultPriorityThreshold = 50,
    };

    /// <summary>Gives a controller the HttpContext/services that ValidationProblem() and Problem() need.</summary>
    public static T WithContext<T>(T controller) where T : ControllerBase
    {
        var services = new ServiceCollection().AddLogging().AddControllers().Services.BuildServiceProvider();
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { RequestServices = services } };
        return controller;
    }
}
