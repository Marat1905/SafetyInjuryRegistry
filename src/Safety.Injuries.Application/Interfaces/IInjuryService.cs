using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Interfaces;

/// <summary>
/// Сервис для управления записями о травмах (CRUD, фильтрация, статистика).
/// </summary>
public interface IInjuryService
{
    /// <summary>
    /// Получить все травмы за указанный месяц.
    /// </summary>
    /// <param name="year">Год (например, 2026).</param>
    /// <param name="month">Месяц (от 1 до 12).</param>
    /// <returns>Коллекция DTO травм, отсортированных по дате (от старых к новым).</returns>
    Task<IEnumerable<InjuryDto>> GetByMonthAsync(int year, int month);

    /// <summary>
    /// Получить все травмы за указанный год.
    /// </summary>
    /// <param name="year">Год (например, 2026).</param>
    /// <returns>Коллекция DTO травм, отсортированных по дате.</returns>
    Task<IEnumerable<InjuryDto>> GetByYearAsync(int year);

    /// <summary>
    /// Получить самую последнюю травму (с максимальной датой происшествия).
    /// </summary>
    /// <returns>DTO последней травмы или null, если травм нет.</returns>
    Task<InjuryDto?> GetLatestAsync();

    /// <summary>
    /// Получить последнюю значимую травму (категории П1 или П2).
    /// Используется для сброса счётчика дней без происшествий.
    /// </summary>
    /// <returns>DTO последней значимой травмы или null, если таких травм нет.</returns>
    Task<InjuryDto?> GetLatestSignificantAsync();

    /// <summary>
    /// Получить статистику по значимым травмам (П1/П2) за указанные месяц и год,
    /// а также количество дней, прошедших с момента последней значимой травмы.
    /// </summary>
    /// <param name="year">Год.</param>
    /// <param name="month">Месяц.</param>
    /// <returns>Объект статистики.</returns>
    Task<InjuryStatisticsDto> GetStatisticsAsync(int year, int month);

    /// <summary>
    /// Создать новую запись о травме.
    /// </summary>
    /// <param name="request">Данные для создания травмы (дата, тип, описание, категория).</param>
    /// <returns>DTO созданной травмы.</returns>
    /// <exception cref="ArgumentException">Если не удаётся распарсить дату или категорию.</exception>
    Task<InjuryDto> CreateAsync(CreateInjuryRequest request);

    /// <summary>
    /// Обновить существующую запись о травме.
    /// </summary>
    /// <param name="id">Идентификатор травмы.</param>
    /// <param name="request">Данные для обновления (все поля опциональны).</param>
    /// <returns>DTO обновлённой травмы.</returns>
    /// <exception cref="KeyNotFoundException">Если травма с указанным id не найдена.</exception>
    Task<InjuryDto> UpdateAsync(Guid id, UpdateInjuryRequest request);

    /// <summary>
    /// Удалить запись о травме вместе со всеми связанными файлами.
    /// </summary>
    /// <param name="id">Идентификатор травмы.</param>
    /// <exception cref="KeyNotFoundException">Если травма с указанным id не найдена.</exception>
    Task DeleteAsync(Guid id);
}