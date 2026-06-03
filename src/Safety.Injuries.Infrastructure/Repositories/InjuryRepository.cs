using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.Infrastructure.Common;
using Safety.Injuries.Infrastructure.Data;

namespace Safety.Injuries.Infrastructure.Repositories;

public class InjuryRepository : BaseRepository<Injury>, IInjuryRepository
{
    public InjuryRepository(SafetyInjuriesDbContext context) : base(context)
    {

    }

    public async Task<Injury?> GetLatestAsync()
    {
        return await _dbSet
            .OrderByDescending(i => i.Date)
            .FirstOrDefaultAsync();
    }
}