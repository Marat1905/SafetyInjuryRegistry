using AutoMapper;
using FluentAssertions;
using Moq;
using Safety.Injuries.Application.Services;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Interfaces;
using Safety.Injuries.UnitTests.Helpers;
using Xunit;

namespace Safety.Injuries.UnitTests.Services;

public class InjuryFileServiceTests
{
    private readonly Mock<IInjuryRepository> _injuryRepoMock;
    private readonly Mock<IInjuryFileRepository> _fileRepoMock;
    private readonly IMapper _mapper;
    private readonly InjuryFileService _service;

    public InjuryFileServiceTests()
    {
        _injuryRepoMock = new Mock<IInjuryRepository>();
        _fileRepoMock = new Mock<IInjuryFileRepository>();
        _mapper = MapperHelper.CreateMapper();
        _service = new InjuryFileService(_injuryRepoMock.Object, _fileRepoMock.Object, _mapper);
    }

    [Fact]
    public async Task GetFilesByInjuryIdAsync_WhenInjuryMissing_ThrowsKeyNotFound()
    {
        _injuryRepoMock.Setup(r => r.ExistsAsync(It.IsAny<Guid>())).ReturnsAsync(false);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetFilesByInjuryIdAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetFilesByInjuryIdAsync_ReturnsMappedFiles()
    {
        var injuryId = Guid.NewGuid();
        var files = new List<InjuryFile> { new() { Id = Guid.NewGuid(), FileName = "test.pdf", InjuryId = injuryId } };
        _injuryRepoMock.Setup(r => r.ExistsAsync(injuryId)).ReturnsAsync(true);
        _fileRepoMock.Setup(r => r.GetByInjuryIdAsync(injuryId)).ReturnsAsync(files);

        var result = await _service.GetFilesByInjuryIdAsync(injuryId);

        result.Should().HaveCount(1);
        result.First().FileName.Should().Be("test.pdf");
    }

    [Fact]
    public async Task UploadFileAsync_ShouldCreateAndAddFile()
    {
        var injuryId = Guid.NewGuid();
        var injury = new Injury { Id = injuryId };
        _injuryRepoMock.Setup(r => r.GetByIdAsync(injuryId)).ReturnsAsync(injury);

        // Добавить настройку мока для AddAsync
        _fileRepoMock.Setup(r => r.AddAsync(It.IsAny<InjuryFile>()))
            .ReturnsAsync((InjuryFile f) => f);

        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        var result = await _service.UploadFileAsync(injuryId, stream, "photo.png", "image/png", "desc");

        result.Should().NotBeNull();
        result.FileName.Should().Be("photo.png");
        _fileRepoMock.Verify(r => r.AddAsync(It.IsAny<InjuryFile>()), Times.Once);
    }

    [Fact]
    public async Task DownloadFileAsync_WhenFileNotFound_ThrowsKeyNotFound()
    {
        var injuryId = Guid.NewGuid();
        var fileId = Guid.NewGuid();
        _injuryRepoMock.Setup(r => r.ExistsAsync(injuryId)).ReturnsAsync(true);
        _fileRepoMock.Setup(r => r.GetByInjuryAndFileIdAsync(injuryId, fileId)).ReturnsAsync((InjuryFile?)null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.DownloadFileAsync(injuryId, fileId));
    }

    [Fact]
    public async Task DownloadFileAsync_ReturnsFileData()
    {
        var injuryId = Guid.NewGuid();
        var fileId = Guid.NewGuid();
        var fileEntity = new InjuryFile { Data = new byte[] { 0xFF }, FileName = "doc.pdf", ContentType = "application/pdf" };
        _injuryRepoMock.Setup(r => r.ExistsAsync(injuryId)).ReturnsAsync(true);
        _fileRepoMock.Setup(r => r.GetByInjuryAndFileIdAsync(injuryId, fileId)).ReturnsAsync(fileEntity);

        var (data, fileName, contentType) = await _service.DownloadFileAsync(injuryId, fileId);

        data.Should().Equal(fileEntity.Data);
        fileName.Should().Be("doc.pdf");
        contentType.Should().Be("application/pdf");
    }

    [Fact]
    public async Task DeleteFileAsync_ShouldRemoveWhenExists()
    {
        var injuryId = Guid.NewGuid();
        var fileId = Guid.NewGuid();
        var file = new InjuryFile { Id = fileId };
        _injuryRepoMock.Setup(r => r.ExistsAsync(injuryId)).ReturnsAsync(true);
        _fileRepoMock.Setup(r => r.GetByInjuryAndFileIdAsync(injuryId, fileId)).ReturnsAsync(file);

        await _service.DeleteFileAsync(injuryId, fileId);

        _fileRepoMock.Verify(r => r.DeleteAsync(file), Times.Once);
    }
}