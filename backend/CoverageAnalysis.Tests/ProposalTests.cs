using CoverageAnalysis.Api.Controllers;
using CoverageAnalysis.Api.Dtos;
using CoverageAnalysis.Api.Services;
using Microsoft.AspNetCore.Mvc;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace CoverageAnalysis.Tests;

public class ProposalTests
{
    private static ProposalDto Dto(decimal server, decimal? client) =>
        new(1, "park", 800, "JED-1", "حي", 39.18, 21.57, 38m, server, client, 1.1m, null, DateTime.UtcNow);

    [Fact]
    public void DiffPoints_is_browser_minus_server_in_percentage_points()
    {
        Assert.Equal(-0.01m, Dto(52.47m, 52.46m).DiffPoints);
        Assert.Equal(0m, Dto(50.87m, 50.87m).DiffPoints);
        Assert.Null(Dto(50m, null).DiffPoints);
    }

    private sealed class FakeService(ProposalDto? result) : IProposalService
    {
        public bool Called { get; private set; }

        public Task<ProposalDto?> CreateAsync(CreateProposalRequest req, CancellationToken ct)
        {
            Called = true;
            return Task.FromResult(result);
        }

        public Task<IReadOnlyList<ProposalDto>> GetAsync(string? s, int? d, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<ProposalDto>>([]);
    }

    private static ProposalsController Controller(FakeService fake) =>
        TestHelpers.WithContext(new ProposalsController(fake, MsOptions.Create(TestHelpers.Options())));

    private static CreateProposalRequest Request(double lon = 39.18373, double lat = 21.57182, int distance = 800, decimal client = 50.87m) =>
        new("park", distance, "JED-20039323", lon, lat, client, null);

    [Fact]
    public async Task Rejects_a_point_outside_the_Jeddah_bounding_box_without_calling_Oracle()
    {
        var fake = new FakeService(null);
        var result = await Controller(fake).Create(Request(lon: 40.5), CancellationToken.None);

        var problem = Assert.IsType<ValidationProblemDetails>(Assert.IsAssignableFrom<ObjectResult>(result).Value);
        Assert.Contains("coordinates", problem.Errors.Keys);
        Assert.False(fake.Called);
    }

    [Fact]
    public async Task Rejects_invalid_distance_and_coverage_values()
    {
        var result = await Controller(new FakeService(null)).Create(Request(distance: 700, client: 120m), CancellationToken.None);

        var problem = Assert.IsType<ValidationProblemDetails>(Assert.IsAssignableFrom<ObjectResult>(result).Value);
        Assert.Contains("DistanceM", problem.Errors.Keys);
        Assert.Contains("ClientCoverageAfter", problem.Errors.Keys);
    }

    [Fact]
    public async Task Returns_422_when_the_point_is_not_in_that_district()
    {
        var result = await Controller(new FakeService(null)).Create(Request(), CancellationToken.None);
        Assert.Equal(422, Assert.IsAssignableFrom<ObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Returns_201_with_both_browser_and_server_values()
    {
        var saved = Dto(50.87m, 50.87m);
        var result = await Controller(new FakeService(saved)).Create(Request(), CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result);
        Assert.Same(saved, created.Value);
    }
}
