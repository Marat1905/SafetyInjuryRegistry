using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Interfaces;

/// <summary>
/// Сервис для управления файлами, прикреплёнными к записям о травмах.
/// </summary>
public interface IInjuryFileService
{
    /// <summary>
    /// Получить список всех файлов, принадлежащих указанной травме.
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы.</param>
    /// <returns>Коллекция DTO файлов (без бинарных данных).</returns>
    /// <exception cref="KeyNotFoundException">Если травма с указанным id не найдена.</exception>
    Task<IEnumerable<InjuryFileDto>> GetFilesByInjuryIdAsync(Guid injuryId);

    /// <summary>
    /// Загрузить новый файл и прикрепить его к травме.
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы.</param>
    /// <param name="fileStream">Поток, содержащий бинарные данные файла.</param>
    /// <param name="fileName">Оригинальное имя файла.</param>
    /// <param name="contentType">MIME-тип файла (например, image/jpeg).</param>
    /// <param name="description">Описание файла (необязательно, максимум 500 символов).</param>
    /// <returns>DTO загруженного файла.</returns>
    /// <exception cref="KeyNotFoundException">Если травма с указанным id не найдена.</exception>
    Task<InjuryFileDto> UploadFileAsync(Guid injuryId, Stream fileStream, string fileName, string contentType, string? description = null);

    /// <summary>
    /// Скачать файл, прикреплённый к травме.
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы.</param>
    /// <param name="fileId">Идентификатор файла.</param>
    /// <returns>Кортеж: бинарные данные, имя файла, MIME-тип.</returns>
    /// <exception cref="KeyNotFoundException">Если травма или файл не найдены.</exception>
    Task<(byte[] Data, string FileName, string ContentType)> DownloadFileAsync(Guid injuryId, Guid fileId);

    /// <summary>
    /// Удалить файл, прикреплённый к травме.
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы.</param>
    /// <param name="fileId">Идентификатор файла.</param>
    /// <exception cref="KeyNotFoundException">Если травма или файл не найдены.</exception>
    Task DeleteFileAsync(Guid injuryId, Guid fileId);
}