using CoverageAnalysis.Api.Dtos;
using CoverageAnalysis.Api.Repositories;

namespace CoverageAnalysis.Api.Services;

public interface IMapDataService
{
    Task<FeatureCollection<DistrictProperties>> GetDistrictsAsync(CancellationToken ct);
    Task<FeatureCollection<FacilityProperties>> GetFacilitiesAsync(string? serviceType, CancellationToken ct);
}

/// <summary>Districts and facilities as GeoJSON FeatureCollections for the map layers.</summary>
public sealed class MapDataService(IDistrictRepository districts, IFacilityRepository facilities) : IMapDataService
{
    public async Task<FeatureCollection<DistrictProperties>> GetDistrictsAsync(CancellationToken ct)
    {
        var rows = await districts.GetAllAsync(ct);
        return new FeatureCollection<DistrictProperties>(rows.Select(r => new Feature<DistrictProperties>(
            new DistrictProperties(r.DistrictCode, r.OsmId, r.NameAr, r.NameEn, r.NonResidential == 1, r.AreaKm2),
            GeoJsonText.Parse(r.GeoJson))).ToList());
    }

    public async Task<FeatureCollection<FacilityProperties>> GetFacilitiesAsync(string? serviceType, CancellationToken ct)
    {
        var rows = await facilities.GetAsync(serviceType, ct);
        return new FeatureCollection<FacilityProperties>(rows.Select(r => new Feature<FacilityProperties>(
            new FacilityProperties(r.FacilityId, r.OsmId, r.OsmType, r.ServiceType, r.Subtype, r.NameAr, r.NameEn, r.DistrictCode),
            GeoJsonText.Parse(r.GeoJson))).ToList());
    }
}
