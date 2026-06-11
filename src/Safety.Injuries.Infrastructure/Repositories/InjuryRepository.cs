using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.Infrastructure.Common;
using Safety.Injuries.Infrastructure.Data;

namespace Safety.Injuries.Infrastructure.Repositories;

/// <summary>
/// Репозиторий для работы с сущностью <see cref="Injury"/>.
/// Реализует специализированные методы поиска последних записей и фильтрации по категориям.
/// </summary>
/// <remarks>
/// Наследует базовые CRUD-операции от <see cref="BaseRepository{Injury}"/>.
/// Добавляет методы <see cref="GetLatestAsync"/> и <see cref="GetLatestByCategoriesAsync"/>.
/// </remarks>
public class InjuryRepository : BaseRepository<Injury>, IInjuryRepository
{
    /// <summary>
    /// Инициализирует новый экземпляр репозитория травм.
    /// </summary>
    /// <param name="context">Контекст базы данных <see cref="SafetyInjuriesDbContext"/>.</param>
    public InjuryRepository(SafetyInjuriesDbContext context) : base(context) { }

    /// <inheritdoc />
    /// <remarks>
    /// Реализация: сортировка по полю <see cref="Injury.Date"/> по убыванию и получение первого элемента.
    /// </remarks>
    public async Task<Injury?> GetLatestAsync()
    {
        return await _dbSet
            .OrderByDescending(i => i.Date)
            .FirstOrDefaultAsync();
    }

    /// <inheritdoc />
    /// <remarks>
    /// Фильтрует травмы по списку категорий, затем сортирует по дате убывания и возвращает последнюю.
    /// </remarks>
    public async Task<Injury?> GetLatestByCategoriesAsync(IEnumerable<InjuryCategory> categories)
    {
        return await _dbSet
            .Where(i => categories.Contains(i.Category))
            .OrderByDescending(i => i.Date)
            .FirstOrDefaultAsync();
    }
}