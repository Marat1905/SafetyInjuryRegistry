using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Safety.Injuries.API.Auth;
using Safety.Injuries.API.Middleware;
using Safety.Injuries.Application;
using Safety.Injuries.Infrastructure;
using Safety.Injuries.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
//builder.Services.AddSwaggerGen(opt =>
//{
//    var xmlFileName = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
//    opt.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, xmlFileName), includeControllerXmlComments: true);
//    opt.SupportNonNullableReferenceTypes();
//});
// Add layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddSingleton<IAuthorizationPolicyProvider, DynamicAuthorizationPolicyProvider>();

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
});

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
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "API Gateway v1");
        c.RoutePrefix = string.Empty;
    });
    app.UseSwagger();
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
