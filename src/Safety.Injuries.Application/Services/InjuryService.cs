using AutoMapper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Application.Mapping;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using Safety.Injuries.Domain.Interfaces;

namespace Safety.Injuries.Application.Services;

/// <summary>
/// Сервис управления травмами.
///
/// После каждой операции, изменяющей набор травм (создание, обновление, удаление),
/// запускается пересчёт статусов всех программ «Ноль травм», чтобы:
/// <list type="bullet">
/// <item><description>активная программа своевременно прерывалась при появлении значимой травмы;</description></item>
/// <item><description>прерванная программа автоматически «оживала», если травма-прерыватель
/// была удалена или переквалифицирована на незначимую категорию (П3–П6).</description></item>
/// </list>
/// </summary>
public class InjuryService : IInjuryService
{
    private readonly IInjuryRepository _repository;
    private readonly IMapper _mapper;
    private readonly IZeroInjuryProgramService _zeroInjuryProgramService;

    public InjuryService(
        IInjuryRepository repository,
        IMapper mapper,
        IZeroInjuryProgramService zeroInjuryProgramService)
    {
        _repository = repository;
        _mapper = mapper;
        _zeroInjuryProgramService = zeroInjuryProgramService;
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

        // Пересчёт статусов программ «Ноль травм»: возможно, новая значимая травма
        // прерывает активную программу.
        await SafeRecalculateZeroInjuryAsync();

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

        // Пересчёт статусов программ «Ноль травм»: категория могла измениться
        // с П1/П2 на П3–П6 (или наоборот), и прерванная ранее программа
        // должна автоматически восстановиться или быть прервана заново.
        await SafeRecalculateZeroInjuryAsync();

        return _mapper.Map<InjuryDto>(updated);
    }

    public async Task DeleteAsync(Guid id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            throw new KeyNotFoundException($"Травма с id {id} не найдена");

        // Физическое удаление
        await _repository.DeleteAsync(existing);

        // Пересчёт статусов программ «Ноль травм»: если была удалена травма,
        // прервавшая программу, она должна снова стать активной.
        await SafeRecalculateZeroInjuryAsync();
    }

    /// <summary>
    /// Безопасный вызов пересчёта статусов программ «Ноль травм».
    ///
    /// Пересчёт — второстепенная операция: если по какой-то причине он упадёт
    /// (например, из-за гонки или ошибки в данных), основная операция над травмой
    /// не должна падать вместе с ним. Ошибка проглатывается, чтобы не ломать UI.
    /// </summary>
    private async Task SafeRecalculateZeroInjuryAsync()
    {
        try
        {
            await _zeroInjuryProgramService.RecalculateAsync();
        }
        catch (Exception ex)
        {
            // Осознанно проглатываем — записи о травме уже сохранены,
            // а статус программы пересчитается при следующем запросе статуса
            // (GetStatusAsync также вызывает RecalculateAsync).
            Console.Error.WriteLine(
                $"[InjuryService] RecalculateAsync для программ «Ноль травм» завершился ошибкой: {ex.Message}");
        }
    }
}