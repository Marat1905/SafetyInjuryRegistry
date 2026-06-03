namespace Safety.Injuries.Domain.Entities;

/// <summary>
/// Файл, прикреплённый к травме (документ, фото и т.п.)
/// </summary>
public class InjuryFile : BaseEntity
{
    /// <summary>Идентификатор травмы, к которой привязан файл</summary>
    public Guid InjuryId { get; set; }

    /// <summary>Оригинальное имя файла</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>MIME-тип файла (например, image/jpeg, application/pdf)</summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Размер файла в байтах</summary>
    public long Size { get; set; }

    /// <summary>Содержимое файла (бинарные данные)</summary>
    public byte[] Data { get; set; } = Array.Empty<byte>();

    /// <summary>Описание файла (необязательно)</summary>
    public string? Description { get; set; }

    // Навигационное свойство
    public virtual Injury Injury { get; set; } = null!;
}