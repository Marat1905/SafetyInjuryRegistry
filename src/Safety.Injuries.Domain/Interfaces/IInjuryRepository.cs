using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Domain.Interfaces;

public interface IInjuryRepository : IRepository<Injury>
{
    /// <summary>
    /// Получить самую последнюю травму (по дате происшествия)
    /// </summary>
    Task<Injury?> GetLatestAsync();

}
