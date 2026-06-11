using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Safety.Injuries.API.Controllers;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;
using FluentAssertions;
using Xunit;

namespace Safety.Injuries.UnitTests.Controllers;

public class InjuryFilesControllerTests
{
    private readonly Mock<IInjuryFileService> _fileServiceMock;
    private readonly InjuryFilesController _controller;

    public InjuryFilesControllerTests()
    {
        _fileServiceMock = new Mock<IInjuryFileService>();
        var loggerMock = new Mock<ILogger<InjuryFilesController>>();
        _controller = new InjuryFilesController(_fileServiceMock.Object, loggerMock.Object);
    }

    [Fact]
    public async Task GetFiles_ReturnsOkWithFiles()
    {
        var injuryId = Guid.NewGuid();
        var files = new List<InjuryFileDto> { new() { Id = Guid.NewGuid() } };
        _fileServiceMock.Setup(s => s.GetFilesByInjuryIdAsync(injuryId)).ReturnsAsync(files);

        var result = await _controller.GetFiles(injuryId);

        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.Value.Should().BeEquivalentTo(files);
    }

    [Fact]
    public async Task UploadFile_ReturnsCreatedAtAction()
    {
        var injuryId = Guid.NewGuid();
        var formFile = new FormFile(new MemoryStream(new byte[] { 1 }), 0, 1, "file", "test.jpg")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/jpeg"
        };
        var uploadForm = new UploadFileForm { File = formFile, Description = "desc" };
        var createdDto = new InjuryFileDto { Id = Guid.NewGuid() };
        _fileServiceMock.Setup(s => s.UploadFileAsync(injuryId, It.IsAny<Stream>(), "test.jpg", "image/jpeg", "desc"))
            .ReturnsAsync(createdDto);

        var result = await _controller.UploadFile(injuryId, uploadForm);

        var createdResult = result as CreatedAtActionResult;
        createdResult.Should().NotBeNull();
        createdResult!.ActionName.Should().Be(nameof(InjuryFilesController.GetFiles));
    }
}