using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.Infrastructure.Data;
using Safety.Injuries.Infrastructure.Repositories;

namespace Safety.Injuries.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<SafetyInjuriesDbContext>(options =>
           options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // Основные репозитории
        services.AddScoped<IInjuryRepository, InjuryRepository>();


        return services;
    }
}

