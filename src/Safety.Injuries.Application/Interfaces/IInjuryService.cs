using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Interfaces;

public interface IInjuryService
{
    /// <summary>Получить травмы за указанный месяц</summary>
    Task<IEnumerable<InjuryDto>> GetByMonthAsync(int year, int month);

    /// <summary>Получить травмы за указанный год</summary>
    Task<IEnumerable<InjuryDto>> GetByYearAsync(int year);

    /// <summary>Получить самую последнюю травму</summary>
    Task<InjuryDto?> GetLatestAsync();

    /// <summary>Получить последнюю травму категории П1 или П2 (для сброса счётчика)</summary>
    Task<InjuryDto?> GetLatestSignificantAsync();

    /// <summary>Получить агрегированную статистику по значимым травмам (П1/П2)</summary>
    Task<InjuryStatisticsDto> GetStatisticsAsync(int year, int month);

    /// <summary>Создать новую травму</summary>
    Task<InjuryDto> CreateAsync(CreateInjuryRequest request);

    /// <summary>Обновить существующую травму</summary>
    Task<InjuryDto> UpdateAsync(Guid id, UpdateInjuryRequest request);

    /// <summary>Удалить травму</summary>
    Task DeleteAsync(Guid id);
}