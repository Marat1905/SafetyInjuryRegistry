using AutoMapper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Application.Mapping;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
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
            i.Date.Year == year && i.Date.Month == month);
        return _mapper.Map<IEnumerable<InjuryDto>>(injuries);
    }

    public async Task<IEnumerable<InjuryDto>> GetByYearAsync(int year)
    {
        var injuries = await _repository.FindAsync(i => i.Date.Year == year);
        return _mapper.Map<IEnumerable<InjuryDto>>(injuries);
    }

    public async Task<InjuryDto?> GetLatestAsync()
    {
        var injury = await _repository.GetLatestAsync();
        return injury == null ? null : _mapper.Map<InjuryDto>(injury);
    }

    public async Task<InjuryDto?> GetLatestSignificantAsync()
    {
        var categories = new[] { InjuryCategory.Fatality, InjuryCategory.LostWorkdayCase };
        var injury = await _repository.GetLatestByCategoriesAsync(categories);
        return injury == null ? null : _mapper.Map<InjuryDto>(injury);
    }

    public async Task<InjuryStatisticsDto> GetStatisticsAsync(int year, int month)
    {
        // Определяем границы месяца (UTC)
        var startOfMonth = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var endOfMonth = startOfMonth.AddMonths(1).AddDays(-1);

        // Границы года
        var startOfYear = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var endOfYear = new DateTime(year, 12, 31, 0, 0, 0, DateTimeKind.Utc);

        var significantCategories = new[] { InjuryCategory.Fatality, InjuryCategory.LostWorkdayCase };

        // Количество значимых травм за месяц
        var monthSignificantCount = await _repository.CountAsync(i =>
            i.Date >= startOfMonth && i.Date <= endOfMonth &&
            significantCategories.Contains(i.Category));

        // Количество значимых травм за год
        var yearSignificantCount = await _repository.CountAsync(i =>
            i.Date >= startOfYear && i.Date <= endOfYear &&
            significantCategories.Contains(i.Category));

        // Последняя значимая травма (глобально, не только за год)
        var lastSignificant = await _repository.GetLatestByCategoriesAsync(significantCategories);

        string? lastSignificantDate = null;
        int daysWithoutInjury = 0;

        if (lastSignificant != null)
        {
            lastSignificantDate = lastSignificant.Date.ToString("yyyy-MM-dd");
            var today = DateTime.UtcNow.Date;
            var lastDate = lastSignificant.Date.Date;
            daysWithoutInjury = (today - lastDate).Days - 1;
            if (daysWithoutInjury < 0) daysWithoutInjury = 0;
        }

        return new InjuryStatisticsDto
        {
            MonthSignificantCount = monthSignificantCount,
            YearSignificantCount = yearSignificantCount,
            LastSignificantDate = lastSignificantDate,
            DaysWithoutInjury = daysWithoutInjury
        };
    }

    public async Task<InjuryDto> CreateAsync(CreateInjuryRequest request)
    {
        // Парсим дату из строки, игнорируя время и часовой пояс
        if (!DateTime.TryParse(request.Date, out var parsedDate))
            throw new ArgumentException("Invalid date format");

        var injury = _mapper.Map<Injury>(request);
        injury.Date = DateTime.SpecifyKind(parsedDate.Date, DateTimeKind.Utc); // только дата, UTC
        injury.CreatedAt = DateTime.UtcNow;

        var created = await _repository.AddAsync(injury);
        return _mapper.Map<InjuryDto>(created);
    }

    public async Task<InjuryDto> UpdateAsync(Guid id, UpdateInjuryRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            throw new KeyNotFoundException($"Травма с id {id} не найдена");

        // Маппим все поля, кроме Category
        _mapper.Map(request, existing);

        // Если категория передана – обновляем вручную
        if (!string.IsNullOrEmpty(request.Category))
        {
            existing.Category = MappingProfile.MapCategoryFromString(request.Category);
        }

        existing.UpdatedAt = DateTime.UtcNow;

        var updated = await _repository.UpdateAsync(existing);
        return _mapper.Map<InjuryDto>(updated);
    }

    public async Task DeleteAsync(Guid id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            throw new KeyNotFoundException($"Травма с id {id} не найдена");

        // Физическое удаление
        await _repository.DeleteAsync(existing);
    }
}