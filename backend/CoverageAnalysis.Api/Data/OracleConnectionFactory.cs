using System.Data;
using Oracle.ManagedDataAccess.Client;

namespace CoverageAnalysis.Api.Data;

public interface IDbConnectionFactory
{
    Task<IDbConnection> OpenAsync(CancellationToken ct = default);
}

/// <summary>Opens pooled Oracle connections using the user-secrets connection string.</summary>
public sealed class OracleConnectionFactory(IConfiguration configuration) : IDbConnectionFactory
{
    private readonly string _connectionString = configuration.GetConnectionString("Oracle") is { Length: > 0 } cs
        ? cs
        : throw new InvalidOperationException("ConnectionStrings:Oracle is missing. Set it with dotnet user-secrets.");

    public async Task<IDbConnection> OpenAsync(CancellationToken ct = default)
    {
        var conn = new OracleConnection(_connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }
}
