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

public class InjuryServiceIntegrationTests : IClassFixture<TestContainersFixture>
{
    private readonly TestContainersFixture _fixture;

    public InjuryServiceIntegrationTests(TestContainersFixture fixture)
    {
        _fixture = fixture;
    }

    private IServiceProvider BuildServiceProvider()
    {
        var services = new ServiceCollection();
        services.AddDbContext<SafetyInjuriesDbContext>(options =>
            options.UseNpgsql(_fixture.ConnectionString));
        services.AddScoped<IInjuryRepository, InjuryRepository>();
        services.AddScoped<IInjuryFileRepository, InjuryFileRepository>();

        // ВАЖНО: не используем AddAutoMapper, регистрируем готовый IMapper
        services.AddSingleton<IMapper>(MapperHelper.CreateMapper());

        services.AddScoped<IInjuryService, InjuryService>();
        services.AddScoped<IInjuryFileService, InjuryFileService>();
        return services.BuildServiceProvider();
    }

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

        using var context = new SafetyInjuriesDbContext(
            new DbContextOptionsBuilder<SafetyInjuriesDbContext>()
                .UseNpgsql(_fixture.ConnectionString).Options);
        var fromDb = await context.Injuries.FindAsync(created.Id);
        fromDb.Should().NotBeNull();
        fromDb!.Type.Should().Be("Integration Test");
    }

    [Fact]
    public async Task GetByMonthAsync_ShouldReturnOnlyInjuriesFromThatMonth()
    {
        var provider = BuildServiceProvider();
        var service = provider.GetRequiredService<IInjuryService>();
        var context = new SafetyInjuriesDbContext(
            new DbContextOptionsBuilder<SafetyInjuriesDbContext>()
                .UseNpgsql(_fixture.ConnectionString).Options);

        // Очистка
        context.Injuries.RemoveRange(context.Injuries);
        await context.SaveChangesAsync();

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

    [Fact]
    public async Task GetStatisticsAsync_ShouldCalculateDaysWithoutInjuryCorrectly()
    {
        var provider = BuildServiceProvider();
        var service = provider.GetRequiredService<IInjuryService>();
        var context = new SafetyInjuriesDbContext(
            new DbContextOptionsBuilder<SafetyInjuriesDbContext>()
                .UseNpgsql(_fixture.ConnectionString).Options);

        context.Injuries.RemoveRange(context.Injuries);
        await context.SaveChangesAsync();

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