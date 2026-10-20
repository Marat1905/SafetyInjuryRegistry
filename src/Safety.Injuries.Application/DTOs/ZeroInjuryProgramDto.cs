using Microsoft.AspNetCore.Http;

namespace Safety.Injuries.Application.DTOs;

/// <summary>
/// DTO программы «Ноль травм», содержащее все поля, включая вычисленные значения,
/// необходимые для отображения в UI: количество прошедших/оставшихся дней, статус,
/// дата фактического завершения и т.п.
/// </summary>
public class ZeroInjuryProgramDto
{
    /// <summary>Уникальный идентификатор программы.</summary>
    public Guid Id { get; set; }

    /// <summary>Дата начала периода (UTC, только дата).</summary>
    public DateTime StartDate { get; set; }

    /// <summary>Идентификатор травмы-триггера (П1/П2) или null, если запуск ручной.</summary>
    public Guid? TriggeringInjuryId { get; set; }

    /// <summary>Описание / основание программы.</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>Целевое количество дней периода (обычно 365).</summary>
    public int TargetDays { get; set; }

    /// <summary>Сколько дней прошло с начала периода.</summary>
    public int DaysPassed { get; set; }

    /// <summary>Сколько дней осталось до планового завершения.</summary>
    public int DaysRemaining { get; set; }

    /// <summary>
    /// Статус программы: "Active" — идёт отсчёт, "Completed" — успешно завершена,
    /// "Interrupted" — прервана значимой травмой.
    /// </summary>
    public string Status { get; set; } = "Active";

    /// <summary>Флаг завершения (успешного или с прерыванием).</summary>
    public bool IsCompleted { get; set; }

    /// <summary>Флаг успешного завершения (пройден весь целевой период без значимых травм).</summary>
    public bool IsSuccessfullyCompleted { get; set; }

    /// <summary>Идентификатор травмы, прервавшей программу (если была).</summary>
    public Guid? InterruptingInjuryId { get; set; }

    /// <summary>Дата фактического завершения программы (успешного или с прерыванием).</summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>Идентификатор пользователя (инженер ТБ или админ), установившего отсчёт.</summary>
    public string SetByUserId { get; set; } = string.Empty;

    /// <summary>Имя пользователя, установившего отсчёт (для UI).</summary>
    public string SetByUserName { get; set; } = string.Empty;

    /// <summary>Список прикреплённых документов.</summary>
    public List<ZeroInjuryDocumentDto> Documents { get; set; } = new();

    /// <summary>Дата создания записи.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Дата последнего обновления записи (может быть null).</summary>
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// DTO документа, прикреплённого к программе «Ноль травм».
/// </summary>
public class ZeroInjuryDocumentDto
{
    /// <summary>Уникальный идентификатор документа.</summary>
    public Guid Id { get; set; }

    /// <summary>Идентификатор программы, к которой привязан документ.</summary>
    public Guid ProgramId { get; set; }

    /// <summary>Оригинальное имя файла.</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>MIME-тип файла.</summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Размер файла в байтах.</summary>
    public long Size { get; set; }

    /// <summary>Описание документа (необязательное поле).</summary>
    public string? Description { get; set; }

    /// <summary>Тип документа: Order, Act, Report, Other.</summary>
    public string DocumentType { get; set; } = "Other";

    /// <summary>Дата загрузки документа.</summary>
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Запрос на создание новой программы «Ноль травм».
/// </summary>
public class CreateZeroInjuryProgramRequest
{
    /// <summary>Дата начала периода в формате yyyy-MM-dd.</summary>
    public string StartDate { get; set; } = string.Empty;

    /// <summary>Описание / основание программы.</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>Целевое количество дней (по умолчанию 365).</summary>
    public int TargetDays { get; set; } = 365;
}

/// <summary>
/// Запрос на обновление существующей программы.
/// Все поля опциональны — обновляются только переданные.
/// </summary>
public class UpdateZeroInjuryProgramRequest
{
    /// <summary>Новая дата начала периода в формате yyyy-MM-dd (опционально).</summary>
    public string? StartDate { get; set; }

    /// <summary>Новое описание (опционально).</summary>
    public string? Description { get; set; }

    /// <summary>Новое целевое количество дней (опционально).</summary>
    public int? TargetDays { get; set; }
}

/// <summary>
/// DTO для загрузки документа программы «Ноль травм» из формы.
/// </summary>
public class UploadZeroInjuryDocumentForm
{
    /// <summary>Описание документа (необязательно).</summary>
    public string? Description { get; set; }

    /// <summary>Тип документа: Order, Act, Report, Other.</summary>
    public string DocumentType { get; set; } = "Other";

    /// <summary>Сам файл.</summary>
    public IFormFile File { get; set; } = null!;
}

/// <summary>
/// DTO со сводным статусом программы: активная программа (если есть),
/// дата последней значимой травмы и минимально допустимая дата начала новой программы.
/// </summary>
public class ZeroInjuryStatusDto
{
    /// <summary>Текущая активная программа или null, если активной нет.</summary>
    public ZeroInjuryProgramDto? CurrentProgram { get; set; }

    /// <summary>Последняя завершённая программа (успешно или с прерыванием) или null.</summary>
    public ZeroInjuryProgramDto? LastFinalizedProgram { get; set; }

    /// <summary>Дата последней значимой травмы (П1/П2) или null, если таких не было.</summary>
    public DateTime? LastSignificantInjuryDate { get; set; }

    /// <summary>
    /// Минимальная допустимая дата начала новой программы.
    /// Не может быть меньше даты последней значимой травмы.
    /// </summary>
    public DateTime? NextAllowedStartDate { get; set; }

    /// <summary>
    /// Флаг: можно ли начать новую программу прямо сейчас
    /// (нет активной программы).
    /// </summary>
    public bool CanStartNew { get; set; }
}