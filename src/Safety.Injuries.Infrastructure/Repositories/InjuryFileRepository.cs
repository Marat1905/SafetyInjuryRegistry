using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.Infrastructure.Common;
using Safety.Injuries.Infrastructure.Data;

namespace Safety.Injuries.Infrastructure.Repositories;

/// <summary>
/// Репозиторий для работы с сущностью <see cref="InjuryFile"/>.
/// Реализует методы получения файлов по идентификатору травмы и проверки принадлежности файла травме.
/// </summary>
/// <remarks>
/// Наследует базовые CRUD-операции от <see cref="BaseRepository{InjuryFile}"/>.
/// Добавляет методы <see cref="GetByInjuryIdAsync"/> и <see cref="GetByInjuryAndFileIdAsync"/>.
/// </remarks>
public class InjuryFileRepository : BaseRepository<InjuryFile>, IInjuryFileRepository
{
    /// <summary>
    /// Инициализирует новый экземпляр репозитория файлов травм.
    /// </summary>
    /// <param name="context">Контекст базы данных <see cref="SafetyInjuriesDbContext"/>.</param>
    public InjuryFileRepository(SafetyInjuriesDbContext context) : base(context)
    {
    }

    /// <inheritdoc />
    /// <remarks>
    /// Возвращает файлы, отсортированные по дате создания (<see cref="BaseEntity.CreatedAt"/>) по возрастанию.
    /// Использует индекс по полю <see cref="InjuryFile.InjuryId"/> для оптимизации запроса.
    /// </remarks>
    public async Task<IEnumerable<InjuryFile>> GetByInjuryIdAsync(Guid injuryId)
    {
        return await _dbSet
            .Where(f => f.InjuryId == injuryId)
            .OrderBy(f => f.CreatedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    /// <remarks>
    /// Проверяет одновременно идентификатор травмы и идентификатор файла,
    /// что гарантирует, что файл действительно принадлежит указанной травме.
    /// </remarks>
    public async Task<InjuryFile?> GetByInjuryAndFileIdAsync(Guid injuryId, Guid fileId)
    {
        return await _dbSet
            .FirstOrDefaultAsync(f => f.InjuryId == injuryId && f.Id == fileId);
    }
}