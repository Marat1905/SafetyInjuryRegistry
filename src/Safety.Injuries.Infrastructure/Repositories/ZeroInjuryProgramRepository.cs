using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.Infrastructure.Common;
using Safety.Injuries.Infrastructure.Data;

namespace Safety.Injuries.Infrastructure.Repositories;

/// <summary>
/// Репозиторий для работы с программами «Ноль травм» и их документами.
/// Наследует базовые CRUD-операции от <see cref="BaseRepository{ZeroInjuryProgram}"/>.
/// </summary>
public class ZeroInjuryProgramRepository : BaseRepository<ZeroInjuryProgram>, IZeroInjuryProgramRepository
{
    /// <summary>
    /// Инициализирует новый экземпляр репозитория программ «Ноль травм».
    /// </summary>
    /// <param name="context">Контекст базы данных <see cref="SafetyInjuriesDbContext"/>.</param>
    public ZeroInjuryProgramRepository(SafetyInjuriesDbContext context) : base(context)
    {
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryProgram?> GetCurrentAsync()
    {
        return await _dbSet
            .Include(p => p.Documents)
            .OrderByDescending(p => p.StartDate)
            .ThenByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync();
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryProgram?> GetActiveAsync()
    {
        return await _dbSet
            .Include(p => p.Documents)
            .Where(p => !p.IsFinalized)
            .OrderByDescending(p => p.StartDate)
            .FirstOrDefaultAsync();
    }

    /// <inheritdoc />
    public async Task<IEnumerable<ZeroInjuryProgram>> GetHistoryAsync()
    {
        return await _dbSet
            .Include(p => p.Documents)
            .OrderByDescending(p => p.StartDate)
            .ThenByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryProgram?> GetWithDocumentsAsync(Guid id)
    {
        return await _dbSet
            .Include(p => p.Documents)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryDocument?> GetDocumentAsync(Guid programId, Guid documentId)
    {
        return await _context.Set<ZeroInjuryDocument>()
            .FirstOrDefaultAsync(d => d.ProgramId == programId && d.Id == documentId);
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryDocument> AddDocumentAsync(ZeroInjuryDocument document)
    {
        await _context.Set<ZeroInjuryDocument>().AddAsync(document);
        await _context.SaveChangesAsync();
        return document;
    }

    /// <inheritdoc />
    public async Task DeleteDocumentAsync(ZeroInjuryDocument document)
    {
        _context.Set<ZeroInjuryDocument>().Remove(document);
        await _context.SaveChangesAsync();
    }
}