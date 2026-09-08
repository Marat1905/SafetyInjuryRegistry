using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;

namespace Safety.Injuries.API.Controllers;

/// <summary>
/// Контроллер для получения информации о версии запущенного приложения.
/// </summary>
[ApiVersion("1.0")]
[ApiController]
[Route("safety/api/v{version:apiVersion}/[controller]")]
public class VersionController : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(VersionResponse), StatusCodes.Status200OK)]
    public IActionResult GetVersion()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var assemblyName = assembly.GetName();

        var response = new VersionResponse
        {
            ApplicationName = assemblyName.Name ?? "Safety.Injuries.API",
            // Приоритет: переменная из Docker -> версия сборки .NET
            Version = Environment.GetEnvironmentVariable("APP_VERSION")
                      ?? assemblyName.Version?.ToString()
                      ?? "Unknown",
            Environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
            // Хэш коммита из GitHub Actions
            GitCommit = Environment.GetEnvironmentVariable("GIT_COMMIT") ?? "N/A",
            BuildDate = GetBuildDate(assembly)
        };

        return Ok(response);
    }

    private static string GetBuildDate(Assembly assembly)
    {
        try
        {
            var location = assembly.Location;
            if (string.IsNullOrEmpty(location) || !System.IO.File.Exists(location))
                return "Unknown";

            return System.IO.File.GetLastWriteTimeUtc(location).ToString("yyyy-MM-dd HH:mm:ss UTC");
        }
        catch
        {
            return "Unknown";
        }
    }
}

public record VersionResponse
{
    public string ApplicationName { get; init; } = string.Empty;
    public string Version { get; init; } = string.Empty;
    public string Environment { get; init; } = string.Empty;
    public string GitCommit { get; init; } = string.Empty;
    public string BuildDate { get; init; } = string.Empty;
}