namespace CoverageAnalysis.Tests;

public class CoverageOptionsTests
{
    [Theory]
    [InlineData("school", true)]
    [InlineData("health", true)]
    [InlineData("park", true)]
    [InlineData("hospital", false)]
    [InlineData(null, false)]
    public void Only_the_three_services_are_valid(string? service, bool expected) =>
        Assert.Equal(expected, TestHelpers.Options().IsValidService(service));

    [Theory]
    [InlineData(500, true)]
    [InlineData(800, true)]
    [InlineData(1000, true)]
    [InlineData(700, false)]
    [InlineData(0, false)]
    public void Only_the_three_walking_distances_are_valid(int distance, bool expected) =>
        Assert.Equal(expected, TestHelpers.Options().IsValidDistance(distance));
}
