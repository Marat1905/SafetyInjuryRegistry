namespace Safety.Injuries.Application.DTOs;

/// <summary>
/// Информация о файле травмы (ответ)
/// </summary>
public class InjuryFileDto
{
    /// <summary>Идентификатор файла</summary>
    public Guid Id { get; set; }

    /// <summary>Идентификатор травмы</summary>
    public Guid InjuryId { get; set; }

    /// <summary>Оригинальное имя файла</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>MIME-тип</summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Размер в байтах</summary>
    public long Size { get; set; }

    /// <summary>Описание файла</summary>
    public string? Description { get; set; }

    /// <summary>Дата загрузки</summary>
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Запрос на загрузку файла
/// </summary>
public class UploadFileRequest
{
    /// <summary>Описание файла (необязательно)</summary>
    public string? Description { get; set; }
}

/// <summary>
/// Информация о файле для списка
/// </summary>
public class FileInfoDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public string? Description { get; set; }
    public DateTime UploadedAt { get; set; }
}