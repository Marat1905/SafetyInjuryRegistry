using AutoMapper;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Application.Services;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.Infrastructure.Data;
using Safety.Injuries.Infrastructure.Repositories;
using Safety.Injuries.IntegrationTests.Fixtures;
using Safety.Injuries.IntegrationTests.Helpers;
using Xunit;

namespace Safety.Injuries.IntegrationTests.Services;

/// <summary>
/// Интеграционные тесты для <see cref="InjuryService"/>. Работают на реальной
/// PostgreSQL, поднятой в контейнере через <see cref="TestContainersFixture"/>.
///
/// Отдельно проверяются сценарии, в которых участвует программа «Ноль травм»:
/// после каждой операции, меняющей набор травм (создание, обновление, удаление),
/// сервис обязан вызвать <see cref="IZeroInjuryProgramService.RecalculateAsync"/>,
/// чтобы статус активной программы пересчитался (прервалась или восстановилась).
/// </summary>
public class InjuryServiceIntegrationTests : IClassFixture<TestContainersFixture>
{
    private readonly TestContainersFixture _fixture;

    public InjuryServiceIntegrationTests(TestContainersFixture fixture)
    {
        _fixture = fixture;
    }

    /// <summary>
    /// Собирает минимальный DI-контейнер, достаточный для работы <see cref="IInjuryService"/>
    /// и <see cref="IInjuryFileService"/> в интеграционных тестах.
    ///
    /// Набор регистраций:
    /// <list type="bullet">
    /// <item><description><see cref="SafetyInjuriesDbContext"/> — на PostgreSQL из Testcontainers;</description></item>
    /// <item><description><see cref="IInjuryRepository"/> и <see cref="IInjuryFileRepository"/> — рабочие репозитории;</description></item>
    /// <item><description><see cref="IZeroInjuryProgramRepository"/> — рабочий репозиторий программ «Ноль травм»;</description></item>
    /// <item><description>IMapper — собирается через <see cref="MapperHelper"/>;</description></item>
    /// <item><description><see cref="IInjuryService"/>, <see cref="IInjuryFileService"/>, <see cref="IZeroInjuryProgramService"/> — рабочие сервисы.</description></item>
    /// </list>
    ///
    /// Без регистрации <see cref="IZeroInjuryProgramService"/> активация <see cref="InjuryService"/>
    /// падает с ошибкой: <c>Unable to resolve service for type 'IZeroInjuryProgramService'</c>.
    /// </summary>
    private IServiceProvider BuildServiceProvider()
    {
        var services = new ServiceCollection();

        services.AddDbContext<SafetyInjuriesDbContext>(options =>
            options.UseNpgsql(_fixture.ConnectionString));

        // Репозитории.
        services.AddScoped<IInjuryRepository, InjuryRepository>();
        services.AddScoped<IInjuryFileRepository, InjuryFileRepository>();
        services.AddScoped<IZeroInjuryProgramRepository, ZeroInjuryProgramRepository>();

        // AutoMapper регистрируем как singleton с уже сконфигурированным профилем.
        // Не используем AddAutoMapper — это утянуло бы сканирование сборок и замедлило тесты.
        services.AddSingleton<IMapper>(MapperHelper.CreateMapper());

        // Сервисы прикладного слоя.
        services.AddScoped<IInjuryService, InjuryService>();
        services.AddScoped<IInjuryFileService, InjuryFileService>();
        services.AddScoped<IZeroInjuryProgramService, ZeroInjuryProgramService>();

        return services.BuildServiceProvider();
    }

    /// <summary>
    /// Создаёт контекст БД напрямую (в обход DI), чтобы потом можно было проверить
    /// результат операций сервиса на «сырой» таблице.
    /// </summary>
    private SafetyInjuriesDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<SafetyInjuriesDbContext>()
            .UseNpgsql(_fixture.ConnectionString)
            .Options;
        return new SafetyInjuriesDbContext(options);
    }

    // ------------------------------------------------------------------
    // CreateAsync
    // ------------------------------------------------------------------

    [Fact]
    public async Task CreateAsync_ShouldAddInjuryToDatabase()
    {
        var provider = BuildServiceProvider();
        var service = provider.GetRequiredService<IInjuryService>();

        var request = new CreateInjuryRequest
        {
            Date = "2026-06-08",
            Type = "Integration Test",
            Description = "Created via service",
            Category = "П1"
        };

        var created = await service.CreateAsync(request);

        created.Should().NotBeNull();
        created.Type.Should().Be("Integration Test");

        await using var context = CreateContext();
        var fromDb = await context.Injuries.FindAsync(created.Id);
        fromDb.Should().NotBeNull();
        fromDb!.Type.Should().Be("Integration Test");
    }

    [Fact]
    public async Task CreateAsync_WhenSignificantInjuryOccurs_ShouldInterruptActiveProgram()
    {
        // Arrange: готовим активную программу «Ноль травм», которая должна
        // быть прервана значимой травмой (П1/П2).
        await using (var seedContext = CreateContext())
        {
            await DatabaseCleaner.CleanDatabaseAsync(seedContext);
        }

        var provider = BuildServiceProvider();
        var zeroInjuryService = provider.GetRequiredService<IZeroInjuryProgramService>();
        var injuryService = provider.GetRequiredService<IInjuryService>();

        // Создаём активную программу с датой старта «месяц назад».
        var programStart = DateTime.UtcNow.Date.AddDays(-30);
        var program = await zeroInjuryService.CreateAsync(new CreateZeroInjuryProgramRequest
        {
            StartDate = programStart.ToString("yyyy-MM-dd"),
            Description = "Программа для интеграционного теста",
            TargetDays = 365
        }, "test-user", "Тестовый пользователь");

        program.Status.Should().Be("Active");

        // Act: создаём значимую травму (П1) после старта программы.
        await injuryService.CreateAsync(new CreateInjuryRequest
        {
            Date = DateTime.UtcNow.Date.AddDays(-5).ToString("yyyy-MM-dd"),
            Type = "Significant injury",
            Description = "Прерывает активную программу",
            Category = "П1"
        });

        // Assert: программа должна автоматически стать прерванной.
        var status = await zeroInjuryService.GetStatusAsync();
        status.CurrentProgram.Should().BeNull(
            "программа стала прерванной и перестала быть активной");
        status.LastFinalizedProgram.Should().NotBeNull();
        status.LastFinalizedProgram!.Status.Should().Be("Interrupted");
    }

    // ------------------------------------------------------------------
    // GetByMonthAsync
    // ------------------------------------------------------------------

    [Fact]
    public async Task GetByMonthAsync_ShouldReturnOnlyInjuriesFromThatMonth()
    {
        var provider = BuildServiceProvider();
        var service = provider.GetRequiredService<IInjuryService>();

        await using var context = CreateContext();
        await DatabaseCleaner.CleanDatabaseAsync(context);

        var june = new Injury
        {
            Id = Guid.NewGuid(),
            Date = new DateTime(2026, 6, 15, 0, 0, 0, DateTimeKind.Utc),
            Type = "June",
            Description = "Desc",
            Category = InjuryCategory.Fatality
        };
        var july = new Injury
        {
            Id = Guid.NewGuid(),
            Date = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
            Type = "July",
            Description = "Desc",
            Category = InjuryCategory.Fatality
        };
        context.Injuries.AddRange(june, july);
        await context.SaveChangesAsync();

        var result = await service.GetByMonthAsync(2026, 6);

        result.Should().HaveCount(1);
        result.First().Type.Should().Be("June");
    }

    // ------------------------------------------------------------------
    // GetStatisticsAsync
    // ------------------------------------------------------------------

    [Fact]
    public async Task GetStatisticsAsync_ShouldCalculateDaysWithoutInjuryCorrectly()
    {
        var provider = BuildServiceProvider();
        var service = provider.GetRequiredService<IInjuryService>();

        await using var context = CreateContext();
        await DatabaseCleaner.CleanDatabaseAsync(context);

        var lastSignificant = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.UtcNow.Date.AddDays(-10),
            Type = "Significant",
            Description = "Desc",
            Category = InjuryCategory.LostWorkdayCase
        };
        context.Injuries.Add(lastSignificant);
        await context.SaveChangesAsync();

        var stats = await service.GetStatisticsAsync(2026, 6);

        stats.LastSignificantDate.Should().Be(lastSignificant.Date.ToString("yyyy-MM-dd"));
        stats.DaysWithoutInjury.Should().Be(9);
    }
}