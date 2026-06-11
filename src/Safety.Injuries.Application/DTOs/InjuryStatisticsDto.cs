namespace Safety.Injuries.Application.DTOs;

/// <summary>
/// Статистика по значимым травмам (П1/П2) для отображения на панели статистики.
/// </summary>
public class InjuryStatisticsDto
{
    /// <summary>
    /// Количество значимых травм (П1/П2) за указанный месяц.
    /// </summary>
    public int MonthSignificantCount { get; set; }

    /// <summary>
    /// Количество значимых травм (П1/П2) за указанный год.
    /// </summary>
    public int YearSignificantCount { get; set; }

    /// <summary>
    /// Дата последней значимой травмы (в формате ISO, YYYY-MM-DD) или null, если таких травм нет.
    /// </summary>
    public string? LastSignificantDate { get; set; }

    /// <summary>
    /// Количество дней, прошедших с даты последней значимой травмы (без учёта дня травмы).
    /// Если значимых травм нет, возвращается 0.
    /// </summary>
    public int DaysWithoutInjury { get; set; }
}