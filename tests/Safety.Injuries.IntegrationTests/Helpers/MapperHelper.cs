using AutoMapper;
using Microsoft.Extensions.Logging.Abstractions;

namespace Safety.Injuries.IntegrationTests.Helpers;

/// <summary>
/// Вспомогательный метод для создания экземпляра IMapper с настройками из приложения
/// </summary>
public static class MapperHelper
{
    public static IMapper CreateMapper()
    {
        var config = new MapperConfiguration(
    cfg => cfg.AddProfile<Safety.Injuries.Application.Mapping.MappingProfile>(),
    NullLoggerFactory.Instance // Передаем обязательный второй аргумент
);

        return config.CreateMapper();
    }
}
