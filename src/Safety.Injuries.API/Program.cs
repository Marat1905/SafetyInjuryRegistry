using Asp.Versioning;
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
using Swashbuckle.AspNetCore.SwaggerGen;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// НАСТРОЙКА ВЕРСИОНИРОВАНИЯ API
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

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Safety Injuries API", Version = "v1" });
    // Добавляем фильтр для замены {version} в путях
    c.DocumentFilter<ReplaceVersionWithExactValueInPathFilter>();
});

//builder.Services.AddSwaggerGen(opt =>
//{
//    var xmlFileName = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
//    opt.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFileName), includeControllerXmlComments: true);
//    opt.SupportNonNullableReferenceTypes();
//});
// Add layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSingleton<IOrganizationNameDecryptor, OrganizationNameDecryptor>();
builder.Services.AddSingleton<IAuthorizationPolicyProvider, DynamicAuthorizationPolicyProvider>();

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
});
// FluentValidation
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<CreateInjuryRequestValidator>();

// Logging
builder.Services.AddLogging();
builder.Services.AddHealthChecks();
builder.Services.AddCustomJWTAuthentification();

//builder.Services.AddCors(options =>
//{
//    options.AddPolicy("AllowGatewayOnly", policy =>
//    {
//        policy.WithOrigins("http://localhost:5002") // Only Gateway
//              .AllowAnyMethod()
//              .AllowAnyHeader();
//    });
//});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Safety Injuries API v1");
        c.RoutePrefix = string.Empty;
    });
}

app.UseMiddleware<ExceptionMiddleware>();

//app.UseCors("AllowGatewayOnly");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

try
{
    //Initialize database
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<SafetyInjuriesDbContext>();

        if (app.Environment.IsDevelopment())
        {
            // Только для разработки - пересоздание БД
            //await context.Database.EnsureCreated();
            context.Database.EnsureCreated();
        }
        else
        {
            // Для production - применяем миграции
            context.Database.Migrate();
        }
    }
}
catch (Exception ex)
{
    // Логируем ошибку, но даем приложению (и сборщику миграций) жить дальше
    Console.WriteLine($"Database initialization failed: {ex.Message}");
}

app.Run();

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