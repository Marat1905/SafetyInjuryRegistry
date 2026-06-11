using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Domain.Interfaces;

/// <summary>
/// Репозиторий для работы с сущностью <see cref="InjuryFile"/>.
/// Позволяет получать файлы, привязанные к конкретной травме, а также проверять принадлежность файла травме.
/// </summary>
public interface IInjuryFileRepository : IRepository<InjuryFile>
{
    /// <summary>
    /// Получить все файлы, прикреплённые к указанной травме.
    /// Файлы возвращаются в порядке возрастания даты создания (от старых к новым).
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы.</param>
    /// <returns>Коллекция файлов (может быть пустой).</returns>
    Task<IEnumerable<InjuryFile>> GetByInjuryIdAsync(Guid injuryId);

    /// <summary>
    /// Получить конкретный файл по идентификатору травмы и идентификатору файла.
    /// Используется для проверки, что файл действительно принадлежит указанной травме.
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы.</param>
    /// <param name="fileId">Идентификатор файла.</param>
    /// <returns>Сущность файла, если найдена; иначе null.</returns>
    Task<InjuryFile?> GetByInjuryAndFileIdAsync(Guid injuryId, Guid fileId);
}