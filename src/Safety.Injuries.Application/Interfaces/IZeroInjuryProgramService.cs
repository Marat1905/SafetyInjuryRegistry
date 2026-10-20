using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Interfaces;

/// <summary>
/// Сервис управления программой «Ноль травм»: создание, обновление,
/// финализация, ведение истории и работа с прикреплёнными документами.
/// </summary>
public interface IZeroInjuryProgramService
{
    /// <summary>
    /// Получить текущую активную программу (если она есть) вместе со статусом:
    /// последняя значимая травма, минимально допустимая дата старта,
    /// возможность запуска новой программы.
    /// </summary>
    Task<ZeroInjuryStatusDto> GetStatusAsync();

    /// <summary>
    /// Получить историю всех программ «Ноль травм» (от новых к старым).
    /// </summary>
    Task<IEnumerable<ZeroInjuryProgramDto>> GetHistoryAsync();

    /// <summary>
    /// Получить одну программу по идентификатору.
    /// </summary>
    /// <param name="id">Идентификатор программы.</param>
    /// <exception cref="KeyNotFoundException">Если программа не найдена.</exception>
    Task<ZeroInjuryProgramDto> GetByIdAsync(Guid id);

    /// <summary>
    /// Создать новую программу «Ноль травм».
    /// </summary>
    /// <param name="request">Параметры новой программы.</param>
    /// <param name="userId">Идентификатор пользователя (инженер ТБ или админ).</param>
    /// <param name="userName">Отображаемое имя пользователя.</param>
    /// <exception cref="InvalidOperationException">
    /// Если уже есть активная программа, либо дата старта меньше даты последней значимой травмы.
    /// </exception>
    Task<ZeroInjuryProgramDto> CreateAsync(CreateZeroInjuryProgramRequest request, string userId, string userName);

    /// <summary>
    /// Обновить существующую активную программу.
    /// </summary>
    /// <param name="id">Идентификатор программы.</param>
    /// <param name="request">Новые значения (все поля опциональны).</param>
    /// <param name="userId">Идентификатор пользователя.</param>
    /// <param name="userName">Отображаемое имя пользователя.</param>
    /// <exception cref="KeyNotFoundException">Если программа не найдена.</exception>
    /// <exception cref="InvalidOperationException">Если программа уже завершена или дата старта некорректна.</exception>
    Task<ZeroInjuryProgramDto> UpdateAsync(Guid id, UpdateZeroInjuryProgramRequest request, string userId, string userName);

    /// <summary>
    /// Удалить программу «Ноль травм» вместе с документами.
    /// </summary>
    /// <param name="id">Идентификатор программы.</param>
    /// <exception cref="KeyNotFoundException">Если программа не найдена.</exception>
    Task DeleteAsync(Guid id);

    /// <summary>
    /// Получить список документов программы.
    /// </summary>
    /// <param name="programId">Идентификатор программы.</param>
    Task<IEnumerable<ZeroInjuryDocumentDto>> GetDocumentsAsync(Guid programId);

    /// <summary>
    /// Загрузить документ в программу.
    /// </summary>
    /// <param name="programId">Идентификатор программы.</param>
    /// <param name="fileStream">Поток с бинарными данными файла.</param>
    /// <param name="fileName">Оригинальное имя файла.</param>
    /// <param name="contentType">MIME-тип файла.</param>
    /// <param name="documentType">Тип документа (Order, Act, Report, Other).</param>
    /// <param name="description">Описание документа (необязательно).</param>
    Task<ZeroInjuryDocumentDto> UploadDocumentAsync(
        Guid programId,
        Stream fileStream,
        string fileName,
        string contentType,
        string documentType,
        string? description);

    /// <summary>
    /// Скачать документ.
    /// </summary>
    /// <param name="programId">Идентификатор программы.</param>
    /// <param name="documentId">Идентификатор документа.</param>
    Task<(byte[] Data, string FileName, string ContentType)> DownloadDocumentAsync(Guid programId, Guid documentId);

    /// <summary>
    /// Удалить документ.
    /// </summary>
    /// <param name="programId">Идентификатор программы.</param>
    /// <param name="documentId">Идентификатор документа.</param>
    Task DeleteDocumentAsync(Guid programId, Guid documentId);

    /// <summary>
    /// Полный пересчёт статусов всех программ «Ноль травм».
    ///
    /// Вызывается:
    /// <list type="bullet">
    /// <item><description>перед выдачей статуса (GetStatusAsync);</description></item>
    /// <item><description>перед выдачей истории (GetHistoryAsync);</description></item>
    /// <item><description>после создания, обновления или удаления любой травмы (InjuryService).</description></item>
    /// </list>
    ///
    /// Логика:
    /// <list type="bullet">
    /// <item><description>Если активная программа пересеклась со значимой травмой — прерывается.</description></item>
    /// <item><description>Если активная программа прошла весь целевой период — завершается успешно.</description></item>
    /// <item><description>Если прерванная программа ссылается на травму, которая больше не существует
    /// или больше не является значимой (П1/П2) — финализация откатывается, программа снова активна,
    /// и её статус переоценивается по актуальным данным.</description></item>
    /// </list>
    /// </summary>
    Task RecalculateAsync();
}