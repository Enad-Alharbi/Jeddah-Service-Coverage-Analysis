using CoverageAnalysis.Api.Data;
using CoverageAnalysis.Api.Options;
using CoverageAnalysis.Api.Repositories;
using CoverageAnalysis.Api.Services;
using Microsoft.AspNetCore.ResponseCompression;

var builder = WebApplication.CreateBuilder(args);

const string FrontendCorsPolicy = "Frontend";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

// Oracle columns like DISTRICT_CODE map to C# properties like DistrictCode.
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

builder.Services.Configure<CoverageOptions>(builder.Configuration.GetSection(CoverageOptions.Section));
builder.Services.AddSingleton<IDbConnectionFactory, OracleConnectionFactory>();
builder.Services.AddScoped<IDistrictRepository, DistrictRepository>();
builder.Services.AddScoped<IFacilityRepository, FacilityRepository>();
builder.Services.AddScoped<ICoverageRepository, CoverageRepository>();
builder.Services.AddScoped<IMapDataService, MapDataService>();
builder.Services.AddScoped<ICoverageService, CoverageService>();
builder.Services.AddScoped<IProposalRepository, ProposalRepository>();
builder.Services.AddScoped<IProposalService, ProposalService>();

builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

// GeoJSON responses are large and very compressible.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(["application/geo+json"]);
});

builder.Services.AddCors(options =>
    options.AddPolicy(FrontendCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseResponseCompression();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "Coverage Analysis API v1");
        options.DocumentTitle = "Jeddah Service Coverage API";
    });
}

app.UseCors(FrontendCorsPolicy);
app.MapControllers();

app.Run();
