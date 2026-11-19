using System.Data;
using Dapper;
using Oracle.ManagedDataAccess.Client;

namespace CoverageAnalysis.DataLoader;

/// <summary>
/// Dapper parameters with explicit Oracle types. Needed for GeoJSON text: a district boundary can be
/// tens of KB, beyond the VARCHAR2 bind limit, so it must be bound as a CLOB.
/// </summary>
public sealed class OracleDynamicParameters : SqlMapper.IDynamicParameters
{
    private readonly List<OracleParameter> _parameters = [];

    public OracleDynamicParameters Add(string name, object? value, OracleDbType type)
    {
        _parameters.Add(new OracleParameter(name, type) { Value = value ?? DBNull.Value });
        return this;
    }

    public void AddParameters(IDbCommand command, SqlMapper.Identity identity)
    {
        var oracleCommand = (OracleCommand)command;
        oracleCommand.BindByName = true;
        oracleCommand.Parameters.AddRange(_parameters.ToArray());
    }
}
