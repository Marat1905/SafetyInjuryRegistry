using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using Safety.Injuries.Infrastructure.Data;
using Safety.Injuries.Infrastructure.Repositories;
using Safety.Injuries.IntegrationTests.Fixtures;
using Safety.Injuries.IntegrationTests.Helpers;
using Xunit;

namespace Safety.Injuries.IntegrationTests.Repositories;

public class InjuryRepositoryTests : IClassFixture<TestContainersFixture>
{
    private readonly TestContainersFixture _fixture;

    public InjuryRepositoryTests(TestContainersFixture fixture)
    {
        _fixture = fixture;
    }

    private SafetyInjuriesDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<SafetyInjuriesDbContext>()
            .UseNpgsql(_fixture.ConnectionString)
            .Options;
        return new SafetyInjuriesDbContext(options);
    }

    private async Task CleanDatabaseAsync(SafetyInjuriesDbContext context)
    {
        await DatabaseCleaner.CleanDatabaseAsync(context);
    }

    [Fact]
    public async Task AddAsync_ShouldAddInjury()
    {
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);
        var repository = new InjuryRepository(context);
        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(new DateTime(2025, 1, 1), DateTimeKind.Utc),
            Type = "Test",
            Description = "Desc",
            Category = InjuryCategory.FirstAidCase
        };

        var added = await repository.AddAsync(injury);

        added.Id.Should().Be(injury.Id);
        var fromDb = await context.Injuries.FindAsync(injury.Id);
        fromDb.Should().NotBeNull();
    }

    [Fact]
    public async Task GetLatestAsync_ShouldReturnMostRecent()
    {
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);
        var repository = new InjuryRepository(context);
        var old = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(new DateTime(2020, 1, 1), DateTimeKind.Utc),
            Type = "Old",
            Description = "Old",
            Category = InjuryCategory.Fatality
        };
        var recent = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(new DateTime(2025, 12, 31), DateTimeKind.Utc),
            Type = "Recent",
            Description = "Recent",
            Category = InjuryCategory.LostWorkdayCase
        };
        await repository.AddAsync(old);
        await repository.AddAsync(recent);

        var latest = await repository.GetLatestAsync();

        latest.Should().NotBeNull();
        latest!.Id.Should().Be(recent.Id);
    }

    [Fact]
    public async Task GetLatestByCategoriesAsync_ShouldFilterByCategories()
    {
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);
        var repository = new InjuryRepository(context);
        var p1 = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-1), DateTimeKind.Utc),
            Category = InjuryCategory.Fatality,
            Type = "P1",
            Description = "P1"
        };
        var p2 = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
            Category = InjuryCategory.LostWorkdayCase,
            Type = "P2",
            Description = "P2"
        };
        var p3 = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-2), DateTimeKind.Utc),
            Category = InjuryCategory.FirstAidCase,
            Type = "P3",
            Description = "P3"
        };
        await repository.AddAsync(p1);
        await repository.AddAsync(p2);
        await repository.AddAsync(p3);

        var latest = await repository.GetLatestByCategoriesAsync(new[] { InjuryCategory.Fatality, InjuryCategory.LostWorkdayCase });

        latest.Should().NotBeNull();
        latest!.Id.Should().Be(p2.Id);
    }

    [Fact]
    public async Task FindAsync_ShouldApplyPredicate()
    {
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);
        var repository = new InjuryRepository(context);
        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Type = "UniqueType",
            Date = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
            Description = "Desc",
            Category = InjuryCategory.Fatality
        };
        await repository.AddAsync(injury);

        var results = await repository.FindAsync(i => i.Type == "UniqueType");

        results.Should().ContainSingle();
    }

    [Fact]
    public async Task CountAsync_ShouldReturnCorrectCount()
    {
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);
        var repository = new InjuryRepository(context);
        await repository.AddAsync(new Injury
        {
            Id = Guid.NewGuid(),
            Type = "A",
            Date = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
            Description = "D",
            Category = InjuryCategory.Fatality
        });
        await repository.AddAsync(new Injury
        {
            Id = Guid.NewGuid(),
            Type = "B",
            Date = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
            Description = "D",
            Category = InjuryCategory.Fatality
        });

        var count = await repository.CountAsync(i => true);

        count.Should().Be(2);
    }
}