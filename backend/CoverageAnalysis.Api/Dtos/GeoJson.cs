using System.Text.Json;
using System.Text.Json.Serialization;

namespace CoverageAnalysis.Api.Dtos;

/// <summary>Minimal GeoJSON (RFC 7946) types. Geometry is passed through as produced by SDO_UTIL.TO_GEOJSON.</summary>
public sealed record FeatureCollection<TProps>(IReadOnlyList<Feature<TProps>> Features)
{
    [JsonPropertyOrder(-1)]
    public string Type => "FeatureCollection";
}

public sealed record Feature<TProps>(TProps Properties, JsonElement? Geometry)
{
    [JsonPropertyOrder(-1)]
    public string Type => "Feature";
}

public static class GeoJsonText
{
    /// <summary>Oracle returns GeoJSON as text; parse it once so it is embedded as JSON, not as a string.</summary>
    public static JsonElement? Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }
}
