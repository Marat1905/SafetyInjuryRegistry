using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.Infrastructure.Common;
using Safety.Injuries.Infrastructure.Data;

namespace Safety.Injuries.Infrastructure.Repositories;

/// <summary>
/// Реализация репозитория для файлов травм
/// </summary>
public class InjuryFileRepository : BaseRepository<InjuryFile>, IInjuryFileRepository
{
    public InjuryFileRepository(SafetyInjuriesDbContext context) : base(context)
    {
    }

    /// <inheritdoc />
    public async Task<IEnumerable<InjuryFile>> GetByInjuryIdAsync(Guid injuryId)
    {
        return await _dbSet
            .Where(f => f.InjuryId == injuryId)
            .OrderBy(f => f.CreatedAt)
            .ToListAsync();
    }

    /// <inheritdoc />
    public async Task<InjuryFile?> GetByInjuryAndFileIdAsync(Guid injuryId, Guid fileId)
    {
        return await _dbSet
            .FirstOrDefaultAsync(f => f.InjuryId == injuryId && f.Id == fileId);
    }
}