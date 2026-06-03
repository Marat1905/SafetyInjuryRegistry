using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Interfaces;

/// <summary>
/// Сервис для управления файлами травм
/// </summary>
public interface IInjuryFileService
{
    /// <summary>
    /// Получить все файлы для травмы
    /// </summary>
    Task<IEnumerable<InjuryFileDto>> GetFilesByInjuryIdAsync(Guid injuryId);

    /// <summary>
    /// Загрузить новый файл для травмы
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы</param>
    /// <param name="fileStream">Поток данных файла</param>
    /// <param name="fileName">Оригинальное имя файла</param>
    /// <param name="contentType">MIME-тип</param>
    /// <param name="description">Описание</param>
    Task<InjuryFileDto> UploadFileAsync(Guid injuryId, Stream fileStream, string fileName, string contentType, string? description = null);

    /// <summary>
    /// Скачать файл (получить содержимое и метаданные)
    /// </summary>
    Task<(byte[] Data, string FileName, string ContentType)> DownloadFileAsync(Guid injuryId, Guid fileId);

    /// <summary>
    /// Удалить файл
    /// </summary>
    Task DeleteFileAsync(Guid injuryId, Guid fileId);
}