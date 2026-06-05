namespace Safety.Injuries.Application.DTOs;

/// <summary>
/// Данные травмы для передачи клиенту
/// </summary>
public class InjuryDto
{
    /// <summary>Идентификатор</summary>
    public Guid Id { get; set; }

    /// <summary>Дата происшествия (ISO)</summary>
    public string Date { get; set; } = string.Empty;

    /// <summary>Тип травмы</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Описание</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>Категория происшествия (П1–П6)</summary>
    public string Category { get; set; } = string.Empty;
}

/// <summary>
/// Запрос на создание травмы
/// </summary>
public class CreateInjuryRequest
{
    /// <summary>Дата происшествия</summary>
    public string Date { get; set; } = string.Empty;

    /// <summary>Тип травмы</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Описание</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>Категория происшествия (строка: "Fatality", "LostWorkdayCase" и т.д. или "П1"–"П6")</summary>
    public string Category { get; set; } = string.Empty;
}

/// <summary>
/// Запрос на обновление травмы
/// </summary>
public class UpdateInjuryRequest
{
    /// <summary>Тип травмы</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Описание</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>Категория происшествия (опционально – если не указана, остаётся прежней)</summary>
    public string? Category { get; set; }
}