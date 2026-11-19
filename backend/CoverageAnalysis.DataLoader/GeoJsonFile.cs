using System.Text.Json;

namespace CoverageAnalysis.DataLoader;

/// <summary>One GeoJSON feature: its properties and its geometry kept as raw JSON text for SDO_UTIL.FROM_GEOJSON.</summary>
public sealed record GeoFeature(JsonElement Properties, string GeometryJson)
{
    public string Str(string name) =>
        Properties.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    public decimal Num(string name) =>
        Properties.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : 0m;
}

public static class GeoJsonFile
{
    public static IReadOnlyList<GeoFeature> Read(string path)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.GetProperty("features").EnumerateArray()
            .Select(f => new GeoFeature(f.GetProperty("properties").Clone(), f.GetProperty("geometry").GetRawText()))
            .ToList();
    }
}
