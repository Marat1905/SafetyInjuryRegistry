namespace Safety.Injuries.Domain.Entities;

/// <summary>
/// Документ, прикреплённый к программе «Ноль травм».
/// Может содержать PDF-сканы приказов, распоряжений, актов и других подтверждающих документов.
/// </summary>
public class ZeroInjuryDocument : BaseEntity
{
    /// <summary>
    /// Идентификатор программы «Ноль травм», к которой привязан данный документ.
    /// Внешний ключ к таблице ZeroInjuryPrograms.
    /// </summary>
    public Guid ProgramId { get; set; }

    /// <summary>
    /// Оригинальное имя файла (включая расширение).
    /// </summary>
    /// <example>распоряжение_238.pdf</example>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// MIME-тип файла, определяющий его формат.
    /// Используется для правильной отдачи браузеру при скачивании.
    /// </summary>
    /// <example>application/pdf</example>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Размер файла в байтах.
    /// </summary>
    public long Size { get; set; }

    /// <summary>
    /// Бинарное содержимое документа.
    /// В базе данных хранится как столбец типа bytea (PostgreSQL).
    /// </summary>
    public byte[] Data { get; set; } = Array.Empty<byte>();

    /// <summary>
    /// Текстовое описание содержимого документа (необязательное поле).
    /// Например: «Распоряжение №238 по СБЕ «Битумные Материалы и Гранулы» от 30.09.2026».
    /// Максимальная длина – 500 символов.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Тип документа: "Order" (приказ/распоряжение), "Act" (акт), "Report" (отчёт), "Other".
    /// Позволяет фильтровать документы в UI.
    /// </summary>
    public string DocumentType { get; set; } = "Other";

    /// <summary>
    /// Навигационное свойство к связанной программе «Ноль травм».
    /// </summary>
    public virtual ZeroInjuryProgram Program { get; set; } = null!;
}