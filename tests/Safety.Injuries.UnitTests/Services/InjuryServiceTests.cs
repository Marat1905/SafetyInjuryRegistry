using AutoMapper;
using FluentAssertions;
using Moq;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Application.Services;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.UnitTests.Helpers;
using System.Linq.Expressions;
using Xunit;

namespace Safety.Injuries.UnitTests.Services;

/// <summary>
/// Юнит-тесты для <see cref="InjuryService"/>.
///
/// Сервис зависит от трёх компонентов:
/// <list type="bullet">
/// <item><description><see cref="IInjuryRepository"/> — доступ к данным о травмах;</description></item>
/// <item><description><see cref="IMapper"/> — преобразование DTO ↔ сущность;</description></item>
/// <item><description><see cref="IZeroInjuryProgramService"/> — пересчёт статусов
/// программ «Ноль травм» после каждой операции, меняющей набор травм.</description></item>
/// </list>
///
/// Зависимость от <see cref="IZeroInjuryProgramService"/> мокается: нас интересует
/// только факт вызова <c>RecalculateAsync</c>, а не его внутренняя логика
/// (для неё есть отдельные тесты на интеграционном уровне).
/// </summary>
public class InjuryServiceTests
{
    private readonly Mock<IInjuryRepository> _repositoryMock;
    private readonly Mock<IZeroInjuryProgramService> _zeroInjuryProgramServiceMock;
    private readonly IMapper _mapper;
    private readonly InjuryService _service;

    public InjuryServiceTests()
    {
        _repositoryMock = new Mock<IInjuryRepository>();
        _zeroInjuryProgramServiceMock = new Mock<IZeroInjuryProgramService>();
        _mapper = MapperHelper.CreateMapper();

        // По умолчанию RecalculateAsync возвращает завершённый Task.
        // Это позволяет использовать мок во всех тестах без индивидуальной настройки.
        _zeroInjuryProgramServiceMock
            .Setup(s => s.RecalculateAsync())
            .Returns(Task.CompletedTask);

        _service = new InjuryService(
            _repositoryMock.Object,
            _mapper,
            _zeroInjuryProgramServiceMock.Object);
    }

    // ------------------------------------------------------------------
    // GetByMonth
    // ------------------------------------------------------------------

    [Fact]
    public async Task GetByMonthAsync_ShouldReturnMappedInjuries()
    {
        var injuries = new List<Injury>
        {
            new()
            {
                Id = Guid.NewGuid(),
                Date = new DateTime(2026, 6, 15),
                Type = "Contusion",
                Description = "Test",
                Category = InjuryCategory.Fatality
            }
        };
        _repositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Injury, bool>>>()))
            .ReturnsAsync(injuries);

        var result = await _service.GetByMonthAsync(2026, 6);

        result.Should().HaveCount(1);
        result.First().Type.Should().Be("Contusion");
    }

    // ------------------------------------------------------------------
    // GetByYear
    // ------------------------------------------------------------------

    [Fact]
    public async Task GetByYearAsync_ShouldReturnMappedInjuries()
    {
        var injuries = new List<Injury>
        {
            new() { Id = Guid.NewGuid(), Date = new DateTime(2026, 1, 1), Type = "Fracture" }
        };
        _repositoryMock
            .Setup(r => r.FindAsync(It.IsAny<Expression<Func<Injury, bool>>>()))
            .ReturnsAsync(injuries);

        var result = await _service.GetByYearAsync(2026);

        result.Should().HaveCount(1);
    }

    // ------------------------------------------------------------------
    // GetLatest
    // ------------------------------------------------------------------

    [Fact]
    public async Task GetLatestAsync_WhenExists_ShouldReturnDto()
    {
        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.UtcNow,
            Type = "Fracture",
            Category = InjuryCategory.LostWorkdayCase
        };
        _repositoryMock.Setup(r => r.GetLatestAsync()).ReturnsAsync(injury);

        var result = await _service.GetLatestAsync();

        result.Should().NotBeNull();
        result!.Type.Should().Be("Fracture");
    }

    [Fact]
    public async Task GetLatestAsync_WhenNone_ShouldReturnNull()
    {
        _repositoryMock.Setup(r => r.GetLatestAsync()).ReturnsAsync((Injury?)null);

        var result = await _service.GetLatestAsync();

        result.Should().BeNull();
    }

    // ------------------------------------------------------------------
    // GetLatestSignificant
    // ------------------------------------------------------------------

    [Fact]
    public async Task GetLatestSignificantAsync_ShouldFilterByFatalityAndLostWorkday()
    {
        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.UtcNow,
            Category = InjuryCategory.Fatality
        };
        _repositoryMock
            .Setup(r => r.GetLatestByCategoriesAsync(It.Is<IEnumerable<InjuryCategory>>(c =>
                c.Contains(InjuryCategory.Fatality) &&
                c.Contains(InjuryCategory.LostWorkdayCase))))
            .ReturnsAsync(injury);

        var result = await _service.GetLatestSignificantAsync();

        result.Should().NotBeNull();
    }

    // ------------------------------------------------------------------
    // Статистика
    // ------------------------------------------------------------------

    [Fact]
    public async Task GetStatisticsAsync_ShouldComputeCorrectCounts()
    {
        var year = 2026;
        var month = 6;

        _repositoryMock
            .Setup(r => r.CountAsync(It.IsAny<Expression<Func<Injury, bool>>>()))
            .ReturnsAsync(2);

        var lastInjury = new Injury
        {
            Date = DateTime.UtcNow.AddDays(-5),
            Category = InjuryCategory.Fatality
        };
        _repositoryMock
            .Setup(r => r.GetLatestByCategoriesAsync(It.IsAny<IEnumerable<InjuryCategory>>()))
            .ReturnsAsync(lastInjury);

        var result = await _service.GetStatisticsAsync(year, month);

        result.MonthSignificantCount.Should().Be(2);
        result.YearSignificantCount.Should().Be(2);
        result.LastSignificantDate.Should().Be(lastInjury.Date.ToString("yyyy-MM-dd"));
        result.DaysWithoutInjury.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task GetStatisticsAsync_WhenNoSignificantInjuries_ShouldReturnZeroDays()
    {
        _repositoryMock
            .Setup(r => r.CountAsync(It.IsAny<Expression<Func<Injury, bool>>>()))
            .ReturnsAsync(0);
        _repositoryMock
            .Setup(r => r.GetLatestByCategoriesAsync(It.IsAny<IEnumerable<InjuryCategory>>()))
            .ReturnsAsync((Injury?)null);

        var result = await _service.GetStatisticsAsync(2026, 6);

        result.MonthSignificantCount.Should().Be(0);
        result.YearSignificantCount.Should().Be(0);
        result.LastSignificantDate.Should().BeNull();
        result.DaysWithoutInjury.Should().Be(0);
    }

    // ------------------------------------------------------------------
    // Create
    // ------------------------------------------------------------------

    [Fact]
    public async Task CreateAsync_ShouldMapAndAddInjury()
    {
        var request = new CreateInjuryRequest
        {
            Date = "2026-06-15",
            Type = "Burn",
            Description = "Chemical burn",
            Category = "П1"
        };

        Injury addedEntity = null!;
        _repositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Injury>()))
            .Callback<Injury>(i => addedEntity = i)
            .ReturnsAsync((Injury i) => i);

        var result = await _service.CreateAsync(request);

        result.Should().NotBeNull();
        addedEntity.Type.Should().Be("Burn");
        addedEntity.Category.Should().Be(InjuryCategory.Fatality);
        addedEntity.Date.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public async Task CreateAsync_ShouldTriggerZeroInjuryRecalculation()
    {
        var request = new CreateInjuryRequest
        {
            Date = "2026-06-15",
            Type = "Burn",
            Description = "Chemical burn",
            Category = "П2"
        };
        _repositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Injury>()))
            .ReturnsAsync((Injury i) => i);

        await _service.CreateAsync(request);

        // После создания травмы сервис обязан пересчитать статусы
        // программ «Ноль травм» — возможно, значимая травма прерывает активную.
        _zeroInjuryProgramServiceMock.Verify(
            s => s.RecalculateAsync(),
            Times.Once);
    }

    // ------------------------------------------------------------------
    // Update
    // ------------------------------------------------------------------

    [Fact]
    public async Task UpdateAsync_WhenInjuryNotFound_ShouldThrowKeyNotFoundException()
    {
        _repositoryMock
            .Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Injury?)null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.UpdateAsync(Guid.NewGuid(), new UpdateInjuryRequest()));
    }

    [Fact]
    public async Task UpdateAsync_ShouldUpdateOnlyProvidedFields()
    {
        var existing = new Injury
        {
            Id = Guid.NewGuid(),
            Type = "Old",
            Description = "Old desc",
            Category = InjuryCategory.FirstAidCase
        };
        _repositoryMock.Setup(r => r.GetByIdAsync(existing.Id)).ReturnsAsync(existing);
        _repositoryMock
            .Setup(r => r.UpdateAsync(It.IsAny<Injury>()))
            .ReturnsAsync((Injury i) => i);

        var updateRequest = new UpdateInjuryRequest
        {
            Type = "New Type",
            Description = "New desc",
            Category = "П2"
        };

        var result = await _service.UpdateAsync(existing.Id, updateRequest);

        result.Type.Should().Be("New Type");
        result.Description.Should().Be("New desc");
        existing.Category.Should().Be(InjuryCategory.LostWorkdayCase);
    }

    [Fact]
    public async Task UpdateAsync_ShouldTriggerZeroInjuryRecalculation()
    {
        var existing = new Injury
        {
            Id = Guid.NewGuid(),
            Type = "Old",
            Description = "Old",
            Category = InjuryCategory.Fatality
        };
        _repositoryMock.Setup(r => r.GetByIdAsync(existing.Id)).ReturnsAsync(existing);
        _repositoryMock
            .Setup(r => r.UpdateAsync(It.IsAny<Injury>()))
            .ReturnsAsync((Injury i) => i);

        await _service.UpdateAsync(existing.Id, new UpdateInjuryRequest
        {
            Category = "П3"
        });

        // После изменения категории (например, П1 → П3) сервис обязан
        // пересчитать статусы программ — прерванный период может восстановиться.
        _zeroInjuryProgramServiceMock.Verify(
            s => s.RecalculateAsync(),
            Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_WhenInjuryNotFound_ShouldNotTriggerRecalculation()
    {
        _repositoryMock
            .Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Injury?)null);

        try
        {
            await _service.UpdateAsync(Guid.NewGuid(), new UpdateInjuryRequest());
        }
        catch (KeyNotFoundException)
        {
            // Ожидаемо — тест проверяет не факт броска, а отсутствие вызова пересчёта.
        }

        _zeroInjuryProgramServiceMock.Verify(
            s => s.RecalculateAsync(),
            Times.Never,
            "если сущность не найдена, никаких операций с данными не происходит");
    }

    // ------------------------------------------------------------------
    // Delete
    // ------------------------------------------------------------------

    [Fact]
    public async Task DeleteAsync_ShouldRemoveWhenExists()
    {
        var injury = new Injury { Id = Guid.NewGuid() };
        _repositoryMock.Setup(r => r.GetByIdAsync(injury.Id)).ReturnsAsync(injury);
        _repositoryMock
            .Setup(r => r.DeleteAsync(injury))
            .Returns(Task.CompletedTask);

        await _service.DeleteAsync(injury.Id);

        _repositoryMock.Verify(r => r.DeleteAsync(injury), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WhenNotFound_ShouldThrow()
    {
        _repositoryMock
            .Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Injury?)null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.DeleteAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task DeleteAsync_ShouldTriggerZeroInjuryRecalculation()
    {
        var injury = new Injury { Id = Guid.NewGuid() };
        _repositoryMock.Setup(r => r.GetByIdAsync(injury.Id)).ReturnsAsync(injury);
        _repositoryMock
            .Setup(r => r.DeleteAsync(injury))
            .Returns(Task.CompletedTask);

        await _service.DeleteAsync(injury.Id);

        // После удаления травмы-прерывателя прерванная программа
        // должна автоматически восстановиться — сервис обязан это пересчитать.
        _zeroInjuryProgramServiceMock.Verify(
            s => s.RecalculateAsync(),
            Times.Once);
    }

    // ------------------------------------------------------------------
    // Устойчивость к ошибкам RecalculateAsync
    // ------------------------------------------------------------------

    [Fact]
    public async Task CreateAsync_WhenRecalculationThrows_ShouldStillReturnCreatedInjury()
    {
        // Пересчёт — второстепенная операция. Если он падает, запись о травме
        // уже сохранена и пользователь должен получить её в ответе.
        // Сервис оборачивает вызов в SafeRecalculateZeroInjuryAsync и проглатывает
        // исключение, чтобы не ломать основной сценарий.
        _zeroInjuryProgramServiceMock
            .Setup(s => s.RecalculateAsync())
            .ThrowsAsync(new InvalidOperationException("Тестовый сбой пересчёта"));

        var request = new CreateInjuryRequest
        {
            Date = "2026-06-15",
            Type = "Burn",
            Description = "Chemical burn",
            Category = "П1"
        };
        _repositoryMock
            .Setup(r => r.AddAsync(It.IsAny<Injury>()))
            .ReturnsAsync((Injury i) => i);

        var result = await _service.CreateAsync(request);

        result.Should().NotBeNull(
            "падение пересчёта не должно мешать успешно созданной травме вернуться клиенту");
    }
}