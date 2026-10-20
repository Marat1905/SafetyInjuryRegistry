using AutoMapper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using Safety.Injuries.Domain.Interfaces;

namespace Safety.Injuries.Application.Services;

/// <summary>
/// Реализация сервиса программы «Ноль травм».
/// </summary>
/// <remarks>
/// Логика работы:
/// <list type="bullet">
/// <item><description>Одновременно может существовать только одна активная (не финализированная) программа.</description></item>
/// <item><description>Дата старта не может быть раньше даты последней значимой травмы (П1/П2).</description></item>
/// <item><description>Дата старта не может быть раньше даты завершения ПРЕДЫДУЩЕЙ (ближайшей по времени) программы —
/// и при создании, и при редактировании активной программы.</description></item>
/// <item><description>Новый период разрешено начинать в тот же день, когда предыдущий достиг цели.</description></item>
/// <item><description>Программа автоматически завершается успешно, когда проходит TargetDaysInternal дней без значимых травм.</description></item>
/// <item><description>Программа автоматически прерывается, если после даты старта произошла значимая травма (П1/П2).</description></item>
/// <item><description>Если травма, прервавшая программу, была удалена или переквалифицирована на незначимую
/// (П3–П6), финализация откатывается, и статус программы пересчитывается заново.</description></item>
/// </list>
/// </remarks>
public class ZeroInjuryProgramService : IZeroInjuryProgramService
{
    private readonly IZeroInjuryProgramRepository _repository;
    private readonly IInjuryRepository _injuryRepository;
    private readonly IMapper _mapper;

    /// <summary>
    /// Список категорий, которые считаются значимыми (П1/П2).
    /// Используется как для проверки прерывания, так и для отката финализации.
    /// </summary>
    private static readonly InjuryCategory[] SignificantCategories =
    {
        InjuryCategory.Fatality,
        InjuryCategory.LostWorkdayCase,
    };

    /// <summary>
    /// Инициализирует новый экземпляр сервиса программ «Ноль травм».
    /// </summary>
    public ZeroInjuryProgramService(
        IZeroInjuryProgramRepository repository,
        IInjuryRepository injuryRepository,
        IMapper mapper)
    {
        _repository = repository;
        _injuryRepository = injuryRepository;
        _mapper = mapper;
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryStatusDto> GetStatusAsync()
    {

        var current = await _repository.GetCurrentAsync();

        ZeroInjuryProgramDto? currentDto = null;
        ZeroInjuryProgramDto? lastFinalizedDto = null;

        if (current != null)
        {
            var dto = _mapper.Map<ZeroInjuryProgramDto>(current);
            if (current.IsFinalized)
            {
                // Текущая запись (самая свежая) уже финализирована — активной программы нет.
                lastFinalizedDto = dto;
            }
            else
            {
                // Есть активная программа.
                currentDto = dto;
            }
        }

        // ВАЖНО: даже когда есть активная программа, нужно найти последнюю ЗАВЕРШЁННУЮ,
        // чтобы правильно вычислить минимально допустимую дату старта при редактировании
        // текущей активной. Раньше этот блок отсутствовал, из-за чего в режиме
        // редактирования active-программы фронт получал занижённый nextAllowedStartDate
        // и позволял «сдвинуть» старт в прошлый (уже завершённый) период.
        if (currentDto != null)
        {
            var allPrograms = await _repository.GetHistoryAsync();
            var lastFinalized = allPrograms
                .Where(p => p.IsFinalized && p.FinalizedAt != null)
                .OrderByDescending(p => p.StartDate)
                .FirstOrDefault();

            if (lastFinalized != null)
            {
                lastFinalizedDto = _mapper.Map<ZeroInjuryProgramDto>(lastFinalized);
            }
        }

        // Последняя значимая травма.
        var lastSignificant = await _injuryRepository.GetLatestByCategoriesAsync(SignificantCategories);
        var lastSignificantDate = lastSignificant?.Date.Date;

        // Минимальная дата старта новой программы:
        // - не раньше последней значимой травмы;
        // - не раньше даты завершения последней завершённой программы.
        DateTime? nextAllowedStart = lastSignificantDate;

        if (lastFinalizedDto?.CompletedAt != null)
        {
            var afterFinalized = lastFinalizedDto.CompletedAt.Value.Date;
            nextAllowedStart = nextAllowedStart == null || afterFinalized > nextAllowedStart
                ? afterFinalized
                : nextAllowedStart;
        }

        return new ZeroInjuryStatusDto
        {
            CurrentProgram = currentDto,
            LastFinalizedProgram = lastFinalizedDto,
            LastSignificantInjuryDate = lastSignificantDate,
            NextAllowedStartDate = nextAllowedStart,
            // Новую программу можно запустить только если нет активной.
            CanStartNew = currentDto == null,
        };
    }

    /// <inheritdoc />
    public async Task<IEnumerable<ZeroInjuryProgramDto>> GetHistoryAsync()
    {

        var programs = await _repository.GetHistoryAsync();
        return _mapper.Map<IEnumerable<ZeroInjuryProgramDto>>(programs);
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryProgramDto> GetByIdAsync(Guid id)
    {
        var program = await _repository.GetWithDocumentsAsync(id);
        if (program == null)
            throw new KeyNotFoundException($"Программа «Ноль травм» с id {id} не найдена");

        return _mapper.Map<ZeroInjuryProgramDto>(program);
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryProgramDto> CreateAsync(
        CreateZeroInjuryProgramRequest request,
        string userId,
        string userName)
    {
        // 1) Проверяем, что нет активной программы.
        var active = await _repository.GetActiveAsync();
        if (active != null)
        {
            throw new InvalidOperationException(
                "Нельзя начать новую программу «Ноль травм», пока предыдущая не завершена успешно или с травмой.");
        }

        // 2) Парсим дату начала.
        if (!DateTime.TryParse(request.StartDate, out var parsedDate))
            throw new ArgumentException("Некорректный формат даты начала. Используйте yyyy-MM-dd");

        var startDate = DateTime.SpecifyKind(parsedDate.Date, DateTimeKind.Utc);

        if (startDate > DateTime.UtcNow.Date)
            throw new ArgumentException("Дата начала не может быть в будущем");

        // 3) Проверяем, что дата не раньше последней значимой травмы.
        var lastSignificant = await _injuryRepository.GetLatestByCategoriesAsync(SignificantCategories);

        if (lastSignificant != null && startDate < lastSignificant.Date.Date)
        {
            throw new InvalidOperationException(
                $"Дата начала не может быть раньше последней значимой травмы ({lastSignificant.Date:yyyy-MM-dd}).");
        }

        // 4) Проверяем, что дата не раньше завершения предыдущей (последней финализированной) программы.
        var lastProgram = await _repository.GetCurrentAsync();
        if (lastProgram != null && lastProgram.IsFinalized && lastProgram.FinalizedAt != null)
        {
            var prevCompletedAt = lastProgram.FinalizedAt.Value.Date;
            if (startDate < prevCompletedAt)
            {
                throw new InvalidOperationException(
                    $"Дата начала не может быть раньше завершения предыдущей программы ({prevCompletedAt:yyyy-MM-dd}).");
            }
        }

        // 5) Проверяем целевую длительность.
        if (request.TargetDays <= 0)
            throw new ArgumentException("Целевой период должен быть положительным числом дней");

        // 6) Создаём новую программу.
        var program = new ZeroInjuryProgram
        {
            Id = Guid.NewGuid(),
            StartDate = startDate,
            Description = request.Description?.Trim() ?? string.Empty,
            TargetDaysInternal = request.TargetDays,
            // Триггером считаем последнюю значимую травму только если старт начинается ровно с её даты.
            TriggeringInjuryId = (lastSignificant != null && startDate == lastSignificant.Date.Date)
                ? lastSignificant.Id
                : null,
            SetByUserId = userId,
            SetByUserName = userName,
            IsFinalized = false,
            IsSuccessfullyCompleted = false,
            CreatedAt = DateTime.UtcNow,
        };

        var created = await _repository.AddAsync(program);

        await RecalculateAsync();

        return _mapper.Map<ZeroInjuryProgramDto>(created);
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryProgramDto> UpdateAsync(
        Guid id,
        UpdateZeroInjuryProgramRequest request,
        string userId,
        string userName)
    {
        var program = await _repository.GetByIdAsync(id);
        if (program == null)
            throw new KeyNotFoundException($"Программа «Ноль травм» с id {id} не найдена");

        if (program.IsFinalized)
            throw new InvalidOperationException("Нельзя редактировать завершённую программу");

        // Обновляем дату старта, если она передана.
        if (!string.IsNullOrWhiteSpace(request.StartDate))
        {
            if (!DateTime.TryParse(request.StartDate, out var parsedDate))
                throw new ArgumentException("Некорректный формат даты начала. Используйте yyyy-MM-dd");

            var newStart = DateTime.SpecifyKind(parsedDate.Date, DateTimeKind.Utc);

            if (newStart > DateTime.UtcNow.Date)
                throw new ArgumentException("Дата начала не может быть в будущем");

            // 1) Нельзя сдвинуть старт активной программы раньше последней значимой травмы.
            var lastSignificant = await _injuryRepository.GetLatestByCategoriesAsync(SignificantCategories);

            if (lastSignificant != null && newStart < lastSignificant.Date.Date)
            {
                throw new InvalidOperationException(
                    $"Дата начала не может быть раньше последней значимой травмы ({lastSignificant.Date:yyyy-MM-dd}).");
            }

            // 2) Нельзя сдвинуть старт активной программы раньше даты завершения
            //    ПРЕДЫДУЩЕЙ программы (той, которая была до текущей активной).
            //    Этого шага раньше не было — именно из-за него редактирование
            //    позволяло «заехать» в уже завершённый период.
            var allPrograms = await _repository.GetHistoryAsync();
            var previousFinalized = allPrograms
                .Where(p =>
                    p.IsFinalized
                    && p.Id != program.Id
                    && p.FinalizedAt != null
                    && p.StartDate < program.StartDate)
                .OrderByDescending(p => p.StartDate)
                .FirstOrDefault();

            if (previousFinalized?.FinalizedAt != null)
            {
                var prevCompletedAt = previousFinalized.FinalizedAt.Value.Date;
                if (newStart < prevCompletedAt)
                {
                    throw new InvalidOperationException(
                        $"Дата начала не может быть раньше завершения предыдущей программы ({prevCompletedAt:yyyy-MM-dd}).");
                }
            }

            program.StartDate = newStart;
            program.TriggeringInjuryId = (lastSignificant != null && newStart == lastSignificant.Date.Date)
                ? lastSignificant.Id
                : null;
        }

        if (!string.IsNullOrWhiteSpace(request.Description))
            program.Description = request.Description.Trim();

        if (request.TargetDays.HasValue)
        {
            if (request.TargetDays.Value <= 0)
                throw new ArgumentException("Целевой период должен быть положительным числом дней");
            program.TargetDaysInternal = request.TargetDays.Value;
        }

        program.SetByUserId = userId;
        program.SetByUserName = userName;
        program.UpdatedAt = DateTime.UtcNow;

        var updated = await _repository.UpdateAsync(program);

        await RecalculateAsync();

        return _mapper.Map<ZeroInjuryProgramDto>(updated);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(Guid id)
    {
        var program = await _repository.GetByIdAsync(id);
        if (program == null)
            throw new KeyNotFoundException($"Программа «Ноль травм» с id {id} не найдена");

        await _repository.DeleteAsync(program);

        await RecalculateAsync();
    }

    /// <inheritdoc />
    public async Task<IEnumerable<ZeroInjuryDocumentDto>> GetDocumentsAsync(Guid programId)
    {
        var program = await _repository.GetWithDocumentsAsync(programId);
        if (program == null)
            throw new KeyNotFoundException($"Программа «Ноль травм» с id {programId} не найдена");

        return _mapper.Map<IEnumerable<ZeroInjuryDocumentDto>>(program.Documents);
    }

    /// <inheritdoc />
    public async Task<ZeroInjuryDocumentDto> UploadDocumentAsync(
        Guid programId,
        Stream fileStream,
        string fileName,
        string contentType,
        string documentType,
        string? description)
    {
        var program = await _repository.GetByIdAsync(programId);
        if (program == null)
            throw new KeyNotFoundException($"Программа «Ноль травм» с id {programId} не найдена");

        // Читаем поток целиком.
        using var memoryStream = new MemoryStream();
        await fileStream.CopyToAsync(memoryStream);
        var fileData = memoryStream.ToArray();

        var document = new ZeroInjuryDocument
        {
            Id = Guid.NewGuid(),
            ProgramId = programId,
            FileName = fileName,
            ContentType = contentType,
            Size = fileData.Length,
            Data = fileData,
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            DocumentType = string.IsNullOrWhiteSpace(documentType) ? "Other" : documentType.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        var created = await _repository.AddDocumentAsync(document);
        return _mapper.Map<ZeroInjuryDocumentDto>(created);
    }

    /// <inheritdoc />
    public async Task<(byte[] Data, string FileName, string ContentType)> DownloadDocumentAsync(
        Guid programId,
        Guid documentId)
    {
        var document = await _repository.GetDocumentAsync(programId, documentId);
        if (document == null)
            throw new KeyNotFoundException($"Документ с id {documentId} не найден для программы {programId}");

        return (document.Data, document.FileName, document.ContentType);
    }

    /// <inheritdoc />
    public async Task DeleteDocumentAsync(Guid programId, Guid documentId)
    {
        var document = await _repository.GetDocumentAsync(programId, documentId);
        if (document == null)
            throw new KeyNotFoundException($"Документ с id {documentId} не найден для программы {programId}");

        await _repository.DeleteDocumentAsync(document);
    }

    /// <inheritdoc />
    public async Task RecalculateAsync()
    {
        // Загружаем все программы и упорядочиваем их от старых к новым,
        // чтобы восстановленные прерванные периоды «вставали» на своё место
        // перед более поздними и не конфликтовали с ними.
        var programs = (await _repository.GetHistoryAsync())
            .OrderBy(p => p.StartDate)
            .ToList();

        // Последняя значимая травма — определяет прерывание активной программы.
        var lastSignificant = await _injuryRepository.GetLatestByCategoriesAsync(SignificantCategories);

        foreach (var program in programs)
        {
            // -----------------------------------------------------------------
            // Шаг 1. Откат финализации, если травма-прерыватель больше не значимая
            //         (переквалифицирована в П3–П6) или удалена.
            // -----------------------------------------------------------------
            if (program.IsFinalized
                && !program.IsSuccessfullyCompleted
                && program.InterruptingInjuryId.HasValue)
            {
                var interruptingInjury =
                    await _injuryRepository.GetByIdAsync(program.InterruptingInjuryId.Value);

                var stillSignificant =
                    interruptingInjury != null
                    && SignificantCategories.Contains(interruptingInjury.Category)
                    && interruptingInjury.Date.Date > program.StartDate.Date;

                if (!stillSignificant)
                {
                    // Травма удалена или её категория больше не значимая —
                    // программа должна снова стать активной (или получить
                    // другой статус по актуальным данным ниже).
                    program.IsFinalized = false;
                    program.IsSuccessfullyCompleted = false;
                    program.InterruptingInjuryId = null;
                    program.FinalizedAt = null;
                    program.UpdatedAt = DateTime.UtcNow;
                    await _repository.UpdateAsync(program);
                }
            }

            // -----------------------------------------------------------------
            // Шаг 2. Переоценка активных программ.
            // -----------------------------------------------------------------
            if (!program.IsFinalized)
            {
                // 2.1. Если после старта программы была значимая травма — прерываем.
                if (lastSignificant != null && lastSignificant.Date.Date > program.StartDate.Date)
                {
                    program.IsFinalized = true;
                    program.IsSuccessfullyCompleted = false;
                    program.InterruptingInjuryId = lastSignificant.Id;
                    program.FinalizedAt = lastSignificant.Date.Date;
                    program.UpdatedAt = DateTime.UtcNow;
                    await _repository.UpdateAsync(program);
                    continue;
                }

                // 2.2. Если целевой период истёк — завершаем успешно.
                if (program.IsPeriodElapsed)
                {
                    program.IsFinalized = true;
                    program.IsSuccessfullyCompleted = true;
                    program.InterruptingInjuryId = null;
                    program.FinalizedAt = program.StartDate.Date.AddDays(program.TargetDaysInternal);
                    program.UpdatedAt = DateTime.UtcNow;
                    await _repository.UpdateAsync(program);
                }
            }
        }
    }
}