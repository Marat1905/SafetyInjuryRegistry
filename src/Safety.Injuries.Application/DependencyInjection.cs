using Microsoft.Extensions.DependencyInjection;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Application.Services;

namespace Safety.Injuries.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddAutoMapper(cfg => {
            // настройки если нужны
        }, AppDomain.CurrentDomain.GetAssemblies());
        services.AddScoped<IInjuryService, InjuryService>();
        services.AddScoped<IInjuryFileService, InjuryFileService>();
        return services;
    }
}