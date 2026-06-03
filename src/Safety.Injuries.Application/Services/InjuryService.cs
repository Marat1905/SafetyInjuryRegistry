using AutoMapper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Interfaces;

namespace Safety.Injuries.Application.Services;

public class InjuryService : IInjuryService
{
    private readonly IInjuryRepository _repository;
    private readonly IMapper _mapper;

    public InjuryService(IInjuryRepository repository, IMapper mapper)
    {
        _repository = repository;
        _mapper = mapper;
    }

    public async Task<IEnumerable<InjuryDto>> GetByMonthAsync(int year, int month)
    {
        // Используем FindAsync с фильтром по году и месяцу (UTC)
        var injuries = await _repository.FindAsync(i =>
            i.Date.Year == year && i.Date.Month == month && !i.IsDeleted);

        return _mapper.Map<IEnumerable<InjuryDto>>(injuries);
    }

    public async Task<IEnumerable<InjuryDto>> GetByYearAsync(int year)
    {
        var injuries = await _repository.FindAsync(i =>
            i.Date.Year == year && !i.IsDeleted);

        return _mapper.Map<IEnumerable<InjuryDto>>(injuries);
    }

    public async Task<InjuryDto?> GetLatestAsync()
    {
        var injury = await _repository.GetLatestAsync();
        return injury == null ? null : _mapper.Map<InjuryDto>(injury);
    }

    public async Task<InjuryDto> CreateAsync(CreateInjuryRequest request)
    {
        // Парсим дату из строки, игнорируя время и часовой пояс
        if (!DateTime.TryParse(request.Date, out var parsedDate))
            throw new ArgumentException("Invalid date format");

        var injury = _mapper.Map<Injury>(request);
        injury.Date = DateTime.SpecifyKind(parsedDate.Date, DateTimeKind.Utc); // только дата, UTC
        injury.CreatedAt = DateTime.UtcNow;
        injury.IsDeleted = false;

        var created = await _repository.AddAsync(injury);
        return _mapper.Map<InjuryDto>(created);
    }

    public async Task<InjuryDto> UpdateAsync(Guid id, UpdateInjuryRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null || existing.IsDeleted)
            throw new KeyNotFoundException($"Травма с id {id} не найдена");

        // Маппим обновляемые поля
        _mapper.Map(request, existing);
        existing.UpdatedAt = DateTime.UtcNow;

        var updated = await _repository.UpdateAsync(existing);
        return _mapper.Map<InjuryDto>(updated);
    }

    public async Task DeleteAsync(Guid id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null || existing.IsDeleted)
            throw new KeyNotFoundException($"Травма с id {id} не найдена");

        // Мягкое удаление
        existing.IsDeleted = true;
        existing.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(existing); // или реализовать DeleteAsync с soft-delete
    }
}
