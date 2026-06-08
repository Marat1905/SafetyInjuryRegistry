using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.Infrastructure.Data;
using Safety.Injuries.Infrastructure.Repositories;

namespace Safety.Injuries.Infrastructure;

/// <summary>
/// Статический класс для регистрации зависимостей инфраструктурного слоя в DI-контейнере.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Добавляет в контейнер сервисы инфраструктуры: контекст базы данных и репозитории.
    /// </summary>
    /// <param name="services">Коллекция сервисов.</param>
    /// <param name="configuration">Конфигурация приложения (для строки подключения).</param>
    /// <returns>Тот же экземпляр <paramref name="services"/> для цепочки вызовов.</returns>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Добавление контекста БД с PostgreSQL провайдером
        services.AddDbContext<SafetyInjuriesDbContext>(options =>
           options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // Регистрация репозиториев с жизненным циклом Scoped
        services.AddScoped<IInjuryRepository, InjuryRepository>();
        services.AddScoped<IInjuryFileRepository, InjuryFileRepository>();

        return services;
    }
}