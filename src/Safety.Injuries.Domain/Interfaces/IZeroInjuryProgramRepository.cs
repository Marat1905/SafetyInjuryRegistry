using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Domain.Interfaces;

/// <summary>
/// Репозиторий для работы с сущностями программы «Ноль травм»
/// и связанными с ней документами.
/// </summary>
public interface IZeroInjuryProgramRepository : IRepository<ZeroInjuryProgram>
{
    /// <summary>
    /// Получить текущую (самую новую) программу, независимо от её статуса.
    /// </summary>
    /// <returns>Сущность программы или null, если записей нет.</returns>
    Task<ZeroInjuryProgram?> GetCurrentAsync();

    /// <summary>
    /// Получить активную программу (ещё не финализированную).
    /// </summary>
    /// <returns>Сущность активной программы или null, если такой нет.</returns>
    Task<ZeroInjuryProgram?> GetActiveAsync();

    /// <summary>
    /// Получить историю программ, отсортированную по дате начала по убыванию.
    /// </summary>
    /// <returns>Коллекция всех программ (может быть пустой).</returns>
    Task<IEnumerable<ZeroInjuryProgram>> GetHistoryAsync();

    /// <summary>
    /// Получить программу вместе со списком документов.
    /// </summary>
    /// <param name="id">Идентификатор программы.</param>
    /// <returns>Сущность программы с загруженной коллекцией Documents или null.</returns>
    Task<ZeroInjuryProgram?> GetWithDocumentsAsync(Guid id);

    /// <summary>
    /// Получить конкретный документ программы.
    /// </summary>
    /// <param name="programId">Идентификатор программы.</param>
    /// <param name="documentId">Идентификатор документа.</param>
    /// <returns>Сущность документа или null.</returns>
    Task<ZeroInjuryDocument?> GetDocumentAsync(Guid programId, Guid documentId);

    /// <summary>
    /// Добавить документ в программу.
    /// </summary>
    /// <param name="document">Сущность документа.</param>
    /// <returns>Созданный документ.</returns>
    Task<ZeroInjuryDocument> AddDocumentAsync(ZeroInjuryDocument document);

    /// <summary>
    /// Удалить документ.
    /// </summary>
    /// <param name="document">Сущность документа.</param>
    Task DeleteDocumentAsync(ZeroInjuryDocument document);
}