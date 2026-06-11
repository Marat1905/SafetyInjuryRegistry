namespace Safety.Injuries.Domain.Entities;

/// <summary>
/// Файл, прикреплённый к записи о травме.
/// Может содержать фотографии, скан-копии документов, PDF-отчёты и другие вложения.
/// </summary>
public class InjuryFile : BaseEntity
{
    /// <summary>
    /// Идентификатор травмы, к которой привязан данный файл.
    /// Внешний ключ к таблице Injuries.
    /// </summary>
    public Guid InjuryId { get; set; }

    /// <summary>
    /// Оригинальное имя файла (включая расширение).
    /// </summary>
    /// <example>photo_of_injury.jpg</example>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// MIME-тип файла, определяющий его формат.
    /// Используется для правильной отдачи браузеру при скачивании.
    /// </summary>
    /// <example>image/jpeg, application/pdf, image/png</example>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// Размер файла в байтах.
    /// </summary>
    public long Size { get; set; }

    /// <summary>
    /// Бинарное содержимое файла.
    /// В базе данных хранится как столбец типа bytea (PostgreSQL).
    /// </summary>
    public byte[] Data { get; set; } = Array.Empty<byte>();

    /// <summary>
    /// Текстовое описание содержимого файла (необязательное поле).
    /// Максимальная длина – 500 символов.
    /// </summary>
    /// <example>Фотография места происшествия, крупный план</example>
    public string? Description { get; set; }

    /// <summary>
    /// Навигационное свойство к связанной травме.
    /// Позволяет получить полные данные о травме, к которой прикреплён файл.
    /// </summary>
    public virtual Injury Injury { get; set; } = null!;
}