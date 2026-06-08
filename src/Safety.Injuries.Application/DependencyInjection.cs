using Microsoft.Extensions.DependencyInjection;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Application.Services;

namespace Safety.Injuries.Application;

/// <summary>
/// Статический класс для регистрации зависимостей прикладного слоя в DI-контейнере.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Добавляет в контейнер сервисы приложения: AutoMapper, бизнес-сервисы.
    /// </summary>
    /// <param name="services">Коллекция сервисов.</param>
    /// <returns>Тот же экземпляр <paramref name="services"/> для цепочки вызовов.</returns>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        // Регистрация AutoMapper (сканирует сборки, где есть профили)
        services.AddAutoMapper(cfg => {
            // При необходимости можно добавить дополнительные настройки маппинга,
            // но в текущей реализации они не требуются.
        }, AppDomain.CurrentDomain.GetAssemblies());

        // Регистрация бизнес-сервисов (Scoped)
        services.AddScoped<IInjuryService, InjuryService>();
        services.AddScoped<IInjuryFileService, InjuryFileService>();

        return services;
    }
}