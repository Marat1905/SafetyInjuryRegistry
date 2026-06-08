using AutoMapper;
using FluentAssertions;
using Moq;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Services;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.UnitTests.Helpers;
using Xunit;

namespace Safety.Injuries.UnitTests.Services;

public class InjuryServiceTests
{
    private readonly Mock<IInjuryRepository> _repositoryMock;
    private readonly IMapper _mapper;
    private readonly InjuryService _service;

    public InjuryServiceTests()
    {
        _repositoryMock = new Mock<IInjuryRepository>();
        _mapper = MapperHelper.CreateMapper();
        _service = new InjuryService(_repositoryMock.Object, _mapper);
    }

    [Fact]
    public async Task GetByMonthAsync_ShouldReturnMappedInjuries()
    {
        // Arrange
        var injuries = new List<Injury>
        {
            new() { Id = Guid.NewGuid(), Date = new DateTime(2026, 6, 15), Type = "Contusion", Description = "Test", Category = InjuryCategory.Fatality }
        };
        _repositoryMock.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Injury, bool>>>()))
            .ReturnsAsync(injuries);

        // Act
        var result = await _service.GetByMonthAsync(2026, 6);

        // Assert
        result.Should().HaveCount(1);
        result.First().Type.Should().Be("Contusion");
    }

    [Fact]
    public async Task GetLatestAsync_WhenExists_ShouldReturnDto()
    {
        var injury = new Injury { Id = Guid.NewGuid(), Date = DateTime.UtcNow, Type = "Fracture", Category = InjuryCategory.LostWorkdayCase };
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

    [Fact]
    public async Task GetLatestSignificantAsync_ShouldFilterByFatalityAndLostWorkday()
    {
        var injury = new Injury { Id = Guid.NewGuid(), Date = DateTime.UtcNow, Category = InjuryCategory.Fatality };
        _repositoryMock.Setup(r => r.GetLatestByCategoriesAsync(It.Is<IEnumerable<InjuryCategory>>(c => c.Contains(InjuryCategory.Fatality) && c.Contains(InjuryCategory.LostWorkdayCase))))
            .ReturnsAsync(injury);

        var result = await _service.GetLatestSignificantAsync();

        result.Should().NotBeNull();
    }

    [Fact]
    public async Task GetStatisticsAsync_ShouldComputeCorrectCounts()
    {
        var year = 2026;
        var month = 6;
        var startOfMonth = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var endOfMonth = startOfMonth.AddMonths(1).AddDays(-1);
        var startOfYear = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var endOfYear = new DateTime(year, 12, 31, 0, 0, 0, DateTimeKind.Utc);

        _repositoryMock.Setup(r => r.CountAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Injury, bool>>>()))
            .ReturnsAsync(2);
        var lastInjury = new Injury { Date = DateTime.UtcNow.AddDays(-5), Category = InjuryCategory.Fatality };
        _repositoryMock.Setup(r => r.GetLatestByCategoriesAsync(It.IsAny<IEnumerable<InjuryCategory>>()))
            .ReturnsAsync(lastInjury);

        var result = await _service.GetStatisticsAsync(year, month);

        result.MonthSignificantCount.Should().Be(2);
        result.YearSignificantCount.Should().Be(2);
        result.LastSignificantDate.Should().Be(lastInjury.Date.ToString("yyyy-MM-dd"));
        result.DaysWithoutInjury.Should().BeGreaterThanOrEqualTo(0);
    }

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
        _repositoryMock.Setup(r => r.AddAsync(It.IsAny<Injury>()))
            .Callback<Injury>(i => addedEntity = i)
            .ReturnsAsync((Injury i) => i);

        var result = await _service.CreateAsync(request);

        result.Should().NotBeNull();
        addedEntity.Type.Should().Be("Burn");
        addedEntity.Category.Should().Be(InjuryCategory.Fatality);
        addedEntity.Date.Kind.Should().Be(DateTimeKind.Utc);
    }

    [Fact]
    public async Task UpdateAsync_WhenInjuryNotFound_ShouldThrowKeyNotFoundException()
    {
        _repositoryMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((Injury?)null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.UpdateAsync(Guid.NewGuid(), new UpdateInjuryRequest()));
    }

    [Fact]
    public async Task UpdateAsync_ShouldUpdateOnlyProvidedFields()
    {
        var existing = new Injury { Id = Guid.NewGuid(), Type = "Old", Description = "Old desc", Category = InjuryCategory.FirstAidCase };
        _repositoryMock.Setup(r => r.GetByIdAsync(existing.Id)).ReturnsAsync(existing);
        _repositoryMock.Setup(r => r.UpdateAsync(It.IsAny<Injury>())).ReturnsAsync((Injury i) => i);

        var updateRequest = new UpdateInjuryRequest { Type = "New Type", Category = "П2" };
        var result = await _service.UpdateAsync(existing.Id, updateRequest);

        result.Type.Should().Be("New Type");
        result.Description.Should().Be("Old desc");
        existing.Category.Should().Be(InjuryCategory.LostWorkdayCase);
    }

    [Fact]
    public async Task DeleteAsync_ShouldRemoveWhenExists()
    {
        var injury = new Injury { Id = Guid.NewGuid() };
        _repositoryMock.Setup(r => r.GetByIdAsync(injury.Id)).ReturnsAsync(injury);
        _repositoryMock.Setup(r => r.DeleteAsync(injury)).Returns(Task.CompletedTask);

        await _service.DeleteAsync(injury.Id);

        _repositoryMock.Verify(r => r.DeleteAsync(injury), Times.Once);
    }
}