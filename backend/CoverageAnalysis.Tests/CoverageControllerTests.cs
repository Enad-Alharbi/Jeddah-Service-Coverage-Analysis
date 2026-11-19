using CoverageAnalysis.Api.Controllers;
using CoverageAnalysis.Api.Dtos;
using CoverageAnalysis.Api.Repositories;
using CoverageAnalysis.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace CoverageAnalysis.Tests;

public class CoverageControllerTests
{
    /// <summary>Validation must reject bad input before any Oracle work starts.</summary>
    private sealed class NotCalledService : ICoverageService
    {
        public Task<CoverageResponse> GetCoverageAsync(string s, int d, CancellationToken ct) => throw new InvalidOperationException("must not be called");
        public Task<DistrictDetailResponse?> GetDistrictAsync(string c, int d, CancellationToken ct) => throw new InvalidOperationException();
        public Task<PriorityResponse> GetPriorityAsync(int d, double t, CancellationToken ct) => throw new InvalidOperationException();
        public Task<RecomputeResponse> RecomputeAsync(string? s, int? d, CancellationToken ct) => throw new InvalidOperationException();
        public Task<ComputeResult> EnsureCachedAsync(string s, int d, CancellationToken ct) => throw new InvalidOperationException();
    }

    private sealed class Env(string name) : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "test";
        public string WebRootPath { get; set; } = "";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }

    private static CoverageController Controller(string env = "Development") => TestHelpers.WithContext(
        new CoverageController(new NotCalledService(), MsOptions.Create(TestHelpers.Options()), new Env(env)));

    [Fact]
    public async Task Unknown_service_and_distance_give_400_before_touching_Oracle()
    {
        var result = await Controller().Get("hospital", 700, CancellationToken.None);

        var problem = Assert.IsType<ValidationProblemDetails>(Assert.IsAssignableFrom<ObjectResult>(result).Value);
        Assert.Contains("serviceType", problem.Errors.Keys);
        Assert.Contains("distance", problem.Errors.Keys);
    }

    [Fact]
    public async Task Priority_threshold_must_be_a_percentage()
    {
        var result = await Controller().GetPriority(800, 150, CancellationToken.None);
        Assert.IsType<ValidationProblemDetails>(Assert.IsAssignableFrom<ObjectResult>(result).Value);
    }

    [Fact]
    public async Task Recompute_is_hidden_outside_Development()
    {
        var result = await Controller(Environments.Production).Recompute(null, null, CancellationToken.None);
        Assert.IsType<NotFoundResult>(result);
    }
}
