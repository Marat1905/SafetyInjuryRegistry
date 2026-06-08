using System.Linq.Expressions;

namespace Safety.Injuries.Domain.Interfaces;

/// <summary>
/// Базовый интерфейс репозитория для выполнения CRUD-операций над сущностями.
/// </summary>
/// <typeparam name="T">Тип сущности, с которой работает репозиторий (должен быть ссылочным типом).</typeparam>
public interface IRepository<T> where T : class
{
    /// <summary>
    /// Получить сущность по её уникальному идентификатору.
    /// </summary>
    /// <param name="id">Идентификатор сущности (Guid).</param>
    /// <returns>Сущность, если найдена; иначе null.</returns>
    Task<T> GetByIdAsync(Guid id);

    /// <summary>
    /// Получить все сущности данного типа.
    /// </summary>
    /// <returns>Коллекция всех сущностей (может быть пустой).</returns>
    Task<IEnumerable<T>> GetAllAsync();

    /// <summary>
    /// Найти сущности, удовлетворяющие указанному условию.
    /// </summary>
    /// <param name="predicate">Лямбда-выражение для фильтрации (например, x => x.Name == "test").</param>
    /// <returns>Коллекция сущностей, соответствующих предикату.</returns>
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);

    /// <summary>
    /// Подсчитать количество сущностей, удовлетворяющих указанному условию.
    /// </summary>
    /// <param name="predicate">Лямбда-выражение для фильтрации.</param>
    /// <returns>Количество сущностей, соответствующих предикату.</returns>
    Task<int> CountAsync(Expression<Func<T, bool>> predicate);

    /// <summary>
    /// Добавить новую сущность в базу данных.
    /// </summary>
    /// <param name="entity">Сущность для добавления.</param>
    /// <returns>Добавленная сущность (с заполненным Id и временными метками).</returns>
    Task<T> AddAsync(T entity);

    /// <summary>
    /// Обновить существующую сущность.
    /// </summary>
    /// <param name="entity">Сущность с изменёнными данными.</param>
    /// <returns>Обновлённая сущность.</returns>
    Task<T> UpdateAsync(T entity);

    /// <summary>
    /// Удалить сущность из базы данных.
    /// </summary>
    /// <param name="entity">Сущность для удаления.</param>
    Task DeleteAsync(T entity);

    /// <summary>
    /// Проверить, существует ли сущность с указанным идентификатором.
    /// </summary>
    /// <param name="id">Идентификатор сущности.</param>
    /// <returns>true, если сущность найдена; иначе false.</returns>
    Task<bool> ExistsAsync(Guid id);
}