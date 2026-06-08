using AutoMapper;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Application.Mapping;
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

public class InjuryFileServiceIntegrationTests : IClassFixture<TestContainersFixture>
{
    private readonly TestContainersFixture _fixture;

    public InjuryFileServiceIntegrationTests(TestContainersFixture fixture)
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
        services.AddSingleton<IMapper>(MapperHelper.CreateMapper());
        services.AddScoped<IInjuryFileService, InjuryFileService>();
        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task UploadFileAsync_ShouldStoreFileInDatabase()
    {
        var provider = BuildServiceProvider();
        var injuryRepo = provider.GetRequiredService<IInjuryRepository>();
        var fileService = provider.GetRequiredService<IInjuryFileService>();

        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.UtcNow,
            Type = "Test injury",
            Description = "For file upload",
            Category = InjuryCategory.Fatality
        };
        await injuryRepo.AddAsync(injury);

        using var stream = new MemoryStream(new byte[] { 0x01, 0x02, 0x03 });
        var dto = await fileService.UploadFileAsync(injury.Id, stream, "test.bin", "application/octet-stream", "test file");

        dto.Should().NotBeNull();
        dto.FileName.Should().Be("test.bin");

        // Проверка прямого доступа к БД
        using var context = new SafetyInjuriesDbContext(
            new DbContextOptionsBuilder<SafetyInjuriesDbContext>()
                .UseNpgsql(_fixture.ConnectionString).Options);
        var file = await context.InjuryFiles.FirstOrDefaultAsync(f => f.Id == dto.Id);
        file.Should().NotBeNull();
        file!.Data.Should().Equal(new byte[] { 0x01, 0x02, 0x03 });
    }

    [Fact]
    public async Task DownloadFileAsync_ShouldReturnCorrectData()
    {
        var provider = BuildServiceProvider();
        var fileService = provider.GetRequiredService<IInjuryFileService>();

        // Подготовка: создаём травму и файл
        using var context = new SafetyInjuriesDbContext(
            new DbContextOptionsBuilder<SafetyInjuriesDbContext>()
                .UseNpgsql(_fixture.ConnectionString).Options);
        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.UtcNow,
            Type = "Download test",
            Description = "Desc",
            Category = InjuryCategory.Fatality
        };
        context.Injuries.Add(injury);
        var file = new InjuryFile
        {
            Id = Guid.NewGuid(),
            InjuryId = injury.Id,
            FileName = "data.bin",
            ContentType = "application/octet-stream",
            Data = new byte[] { 0xAA, 0xBB, 0xCC },
            Size = 3
        };
        context.InjuryFiles.Add(file);
        await context.SaveChangesAsync();

        var (data, fileName, contentType) = await fileService.DownloadFileAsync(injury.Id, file.Id);

        data.Should().Equal(new byte[] { 0xAA, 0xBB, 0xCC });
        fileName.Should().Be("data.bin");
        contentType.Should().Be("application/octet-stream");
    }
}