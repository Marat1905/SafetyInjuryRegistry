using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;

namespace Safety.Injuries.Domain.Interfaces;

/// <summary>
/// Репозиторий для работы с сущностью <see cref="Injury"/>.
/// Предоставляет специализированные методы поиска последних записей и фильтрации по категориям.
/// </summary>
public interface IInjuryRepository : IRepository<Injury>
{
    /// <summary>
    /// Получить самую последнюю травму (с максимальной датой происшествия).
    /// </summary>
    /// <returns>Сущность последней травмы или null, если записи отсутствуют.</returns>
    Task<Injury?> GetLatestAsync();

    /// <summary>
    /// Получить последнюю травму, категория которой входит в указанный список.
    /// </summary>
    /// <param name="categories">Коллекция категорий травм (например, П1 и П2).</param>
    /// <returns>Сущность последней травмы подходящей категории или null, если таких нет.</returns>
    Task<Injury?> GetLatestByCategoriesAsync(IEnumerable<InjuryCategory> categories);
}