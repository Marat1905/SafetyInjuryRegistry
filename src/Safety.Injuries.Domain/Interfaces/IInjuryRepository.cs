using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using System.Linq.Expressions;

namespace Safety.Injuries.Domain.Interfaces;

public interface IInjuryRepository : IRepository<Injury>
{
    /// <summary>Получить самую последнюю травму (по дате происшествия)</summary>
    Task<Injury?> GetLatestAsync();

    /// <summary>Получить последнюю травму с категорией из указанного списка</summary>
    Task<Injury?> GetLatestByCategoriesAsync(IEnumerable<InjuryCategory> categories);
}