using Microsoft.AspNetCore.Mvc;
using Moq;
using Safety.Injuries.API.Controllers;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;
using FluentAssertions;
using Xunit;

namespace Safety.Injuries.UnitTests.Controllers;

public class InjuriesControllerTests
{
    private readonly Mock<IInjuryService> _serviceMock;
    private readonly InjuriesController _controller;

    public InjuriesControllerTests()
    {
        _serviceMock = new Mock<IInjuryService>();
        _controller = new InjuriesController(_serviceMock.Object);
    }

    [Fact]
    public async Task GetByMonth_ReturnsOkWithInjuries()
    {
        var injuries = new List<InjuryDto> { new() { Id = Guid.NewGuid() } };
        _serviceMock.Setup(s => s.GetByMonthAsync(2026, 6)).ReturnsAsync(injuries);

        var result = await _controller.GetByMonth(2026, 6);

        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(injuries);
    }

    [Fact]
    public async Task GetLatest_WhenExists_ReturnsOk()
    {
        var injury = new InjuryDto { Id = Guid.NewGuid() };
        _serviceMock.Setup(s => s.GetLatestAsync()).ReturnsAsync(injury);

        var result = await _controller.GetLatest();

        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.Value.Should().Be(injury);
    }

    [Fact]
    public async Task GetLatest_WhenNotFound_ReturnsNotFound()
    {
        _serviceMock.Setup(s => s.GetLatestAsync()).ReturnsAsync((InjuryDto?)null);

        var result = await _controller.GetLatest();

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task Create_ReturnsCreatedAtAction()
    {
        var request = new CreateInjuryRequest { Date = "2026-06-08", Type = "Test", Description = "Desc", Category = "П1" };
        var created = new InjuryDto { Id = Guid.NewGuid(), Date = "2026-06-08" };
        _serviceMock.Setup(s => s.CreateAsync(request)).ReturnsAsync(created);

        var result = await _controller.Create(request);

        var createdResult = result as CreatedAtActionResult;
        createdResult.Should().NotBeNull();
        createdResult!.ActionName.Should().Be(nameof(InjuriesController.GetByMonth));
    }
}