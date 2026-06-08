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

public class InjuryFileRepositoryTests : IClassFixture<TestContainersFixture>
{
    private readonly TestContainersFixture _fixture;

    public InjuryFileRepositoryTests(TestContainersFixture fixture)
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
    public async Task GetByInjuryIdAsync_ShouldReturnFilesOrderedByCreatedAt()
    {
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);
        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
            Type = "Test",
            Description = "Desc",
            Category = InjuryCategory.FirstAidCase
        };
        context.Injuries.Add(injury);
        await context.SaveChangesAsync();

        var repository = new InjuryFileRepository(context);

        var file1 = new InjuryFile
        {
            Id = Guid.NewGuid(),
            InjuryId = injury.Id,
            FileName = "1.txt",
            ContentType = "text/plain",
            Data = new byte[1]
        };
        await repository.AddAsync(file1);

        await Task.Delay(10);

        var file2 = new InjuryFile
        {
            Id = Guid.NewGuid(),
            InjuryId = injury.Id,
            FileName = "2.txt",
            ContentType = "text/plain",
            Data = new byte[1]
        };
        await repository.AddAsync(file2);

        var files = await repository.GetByInjuryIdAsync(injury.Id);
        var fileList = files.ToList();

        fileList.Should().HaveCount(2);
        fileList[0].CreatedAt.Should().BeBefore(fileList[1].CreatedAt);
    }
    [Fact]
    public async Task GetByInjuryAndFileIdAsync_ShouldReturnCorrectFile()
    {
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);
        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
            Type = "Test",
            Description = "Desc",
            Category = InjuryCategory.Fatality
        };
        context.Injuries.Add(injury);
        await context.SaveChangesAsync();

        var file = new InjuryFile
        {
            Id = Guid.NewGuid(),
            InjuryId = injury.Id,
            FileName = "doc.pdf",
            ContentType = "application/pdf",
            Data = new byte[5]
        };
        context.InjuryFiles.Add(file);
        await context.SaveChangesAsync();

        var repository = new InjuryFileRepository(context);
        var result = await repository.GetByInjuryAndFileIdAsync(injury.Id, file.Id);

        result.Should().NotBeNull();
        result!.Id.Should().Be(file.Id);
    }

    [Fact]
    public async Task DeleteAsync_ShouldRemoveFile()
    {
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);
        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc),
            Type = "Test",
            Description = "Desc",
            Category = InjuryCategory.Fatality
        };
        context.Injuries.Add(injury);
        await context.SaveChangesAsync();

        var file = new InjuryFile
        {
            Id = Guid.NewGuid(),
            InjuryId = injury.Id,
            FileName = "del.txt",
            ContentType = "text/plain",
            Data = new byte[1]
        };
        context.InjuryFiles.Add(file);
        await context.SaveChangesAsync();

        var repository = new InjuryFileRepository(context);
        await repository.DeleteAsync(file);

        var exists = await context.InjuryFiles.AnyAsync(f => f.Id == file.Id);
        exists.Should().BeFalse();
    }
}