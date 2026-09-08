using Asp.Versioning;
using AspNetCoreRateLimit;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Safety.Injuries.API.Auth;
using Safety.Injuries.API.Middleware;
using Safety.Injuries.API.Services;
using Safety.Injuries.Application;
using Safety.Injuries.Application.Validators;
using Safety.Injuries.Infrastructure;
using Safety.Injuries.Infrastructure.Data;
using Serilog;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// 1. НАСТРОЙКА SERILOG (Исправленный и безопасный паттерн)
builder.Host.UseSerilog((context, configuration) =>
{
    configuration.ReadFrom.Configuration(context.Configuration)
        .Enrich.FromLogContext()
        .Enrich.WithMachineName()
        .Enrich.WithThreadId();
});

// 2. РЕГИСТРАЦИЯ FLUENT VALIDATION
// Автоматически находит все классы, наследующие AbstractValidator, в указанной сборке
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<CreateInjuryRequestValidator>();

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Сериализуем все enum как строки
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// 3. НАСТРОЙКА ВЕРСИОНИРОВАНИЯ API
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
    options.ApiVersionReader = new UrlSegmentApiVersionReader();
})
.AddMvc()
.AddApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

// 4. НАСТРОЙКА SWAGGER
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Safety Injuries API", Version = "v1" });
    // Добавляем фильтр для замены {version} в путях
    c.DocumentFilter<ReplaceVersionWithExactValueInPathFilter>();
});

// 5. НАСТРОЙКА CORS
// Читаем настройки CORS из конфигурации
var corsSettings = builder.Configuration.GetSection("CorsSettings").Get<CorsSettings>()
    ?? new CorsSettings();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigins", policy =>
    {
        // Если в режиме разработки и список разрешённых источников не задан — разрешаем любые
        if (builder.Environment.IsDevelopment() && corsSettings.AllowedOrigins == null)
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        }
        else
        {
            // В продакшене используем строго определённые источники, методы и заголовки
            policy.WithOrigins(corsSettings.AllowedOrigins ?? Array.Empty<string>())
                  .WithMethods(corsSettings.AllowedMethods ?? new[] { "GET", "POST", "PUT", "DELETE", "OPTIONS" })
                  .WithHeaders(corsSettings.AllowedHeaders ?? new[] { "Content-Type", "Authorization", "X-Requested-With" })
                  .SetPreflightMaxAge(TimeSpan.FromMinutes(corsSettings.PreflightMaxAgeMinutes ?? 10));
        }
    });
});

// ========== НАСТРОЙКА RATE LIMITING ==========
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.AddSingleton<IIpPolicyStore, MemoryCacheIpPolicyStore>();
builder.Services.AddSingleton<IRateLimitCounterStore, MemoryCacheRateLimitCounterStore>();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();
builder.Services.AddSingleton<IProcessingStrategy, AsyncKeyLockProcessingStrategy>();

// ========== РЕГИСТРАЦИЯ СЛОЁВ И СПЕЦИФИЧНЫХ СЕРВИСОВ ==========
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton<IOrganizationNameDecryptor, OrganizationNameDecryptor>();
builder.Services.AddSingleton<IAuthorizationPolicyProvider, DynamicAuthorizationPolicyProvider>();

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
});

// Health Checks with database connectivity check
builder.Services.AddHealthChecks()
    .AddNpgSql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        name: "PostgreSQL",
        failureStatus: Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Unhealthy,
        tags: new[] { "db", "postgresql" });

builder.Services.AddCustomJWTAuthentification();

var app = builder.Build();

// ========== MIDDLEWARE PIPELINE ==========

// ========== ДОБАВЛЯЕМ ПРОМЕЖУТОЧНОЕ ПО RATE LIMITING ==========
// Должно быть добавлено до других middleware, но после использования CORS.
app.UseIpRateLimiting();

app.UseCors("AllowSpecificOrigins");

app.UseMiddleware<ExceptionMiddleware>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Safety Injuries API v1");
        c.RoutePrefix = string.Empty;
    });
}

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Карта health checks
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        var response = new
        {
            status = report.Status.ToString(),
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                description = e.Value.Description,
                duration = e.Value.Duration.TotalMilliseconds
            }),
            totalDuration = report.TotalDuration.TotalMilliseconds
        };
        await context.Response.WriteAsJsonAsync(response);
    }
});

// ========== ИНИЦИАЛИЗАЦИЯ И ЗАПУСК (ИСПРАВЛЕНО) ==========
try
{
    // 1. Инициализируем базу данных
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<SafetyInjuriesDbContext>();

        if (app.Environment.IsDevelopment())
        {
            // Только для разработки - пересоздание БД
            context.Database.EnsureCreated();
        }
        else
        {
            // Для production - применяем миграции
            context.Database.Migrate();
        }
    }

    // 2. Логируем успешный запуск (теперь этот лог ГАРАНТИРОВАННО запишется)
    app.Logger.LogInformation("=== ПРИЛОЖЕНИЕ УСПЕШНО ЗАПУЩЕНО И ГОТОВО К РАБОТЕ ===");

    // 3. Запускаем веб-сервер (блокирует выполнение до остановки приложения)
    await app.RunAsync();
}
catch (Exception ex)
{
    // Логируем фатальную ошибку, если приложение не смогло запуститься
    Log.Fatal(ex, "Application startup or database initialization failed");
}
finally
{
    // 4. Закрываем логгер ТОЛЬКО при реальном завершении работы приложения (например, по Ctrl+C)
    Log.CloseAndFlush();
}

// ========== ВСПОМОГАТЕЛЬНЫЕ КЛАССЫ ==========

/// <summary>
/// Фильтр для Swagger, который заменяет {version} в пути на актуальное значение версии.
/// </summary>
public class ReplaceVersionWithExactValueInPathFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        var paths = new OpenApiPaths();
        foreach (var path in swaggerDoc.Paths)
        {
            // Заменяем {version} в ключе пути на фактическую версию из документации
            var newKey = path.Key.Replace("{version}", swaggerDoc.Info.Version);
            paths.Add(newKey, path.Value);
        }
        swaggerDoc.Paths = paths;
    }
}

/// <summary>
/// Настройки CORS, читаемые из appsettings.json.
/// </summary>
public class CorsSettings
{
    /// <summary>
    /// Массив разрешённых источников (например, https://myfrontend.com).
    /// </summary>
    public string[]? AllowedOrigins { get; set; }

    /// <summary>
    /// Массив разрешённых HTTP-методов (если не указан, используются GET, POST, PUT, DELETE, OPTIONS).
    /// </summary>
    public string[]? AllowedMethods { get; set; }

    /// <summary>
    /// Массив разрешённых заголовков (если не указан, используются Content-Type, Authorization, X-Requested-With).
    /// </summary>
    public string[]? AllowedHeaders { get; set; }

    /// <summary>
    /// Время кеширования предварительного запроса (preflight) в минутах.
    /// </summary>
    public int? PreflightMaxAgeMinutes { get; set; }
}