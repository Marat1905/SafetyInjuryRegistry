using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Domain.Interfaces;

/// <summary>
/// Репозиторий для работы с файлами травм
/// </summary>
public interface IInjuryFileRepository : IRepository<InjuryFile>
{
    /// <summary>
    /// Получить все файлы для конкретной травмы
    /// </summary>
    Task<IEnumerable<InjuryFile>> GetByInjuryIdAsync(Guid injuryId);

    /// <summary>
    /// Получить файл по идентификатору травмы и идентификатору файла
    /// </summary>
    Task<InjuryFile?> GetByInjuryAndFileIdAsync(Guid injuryId, Guid fileId);
}