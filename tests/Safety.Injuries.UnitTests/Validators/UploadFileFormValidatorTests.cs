using FluentValidation.TestHelper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Internal;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Validators;
using Xunit;

namespace Safety.Injuries.UnitTests.Validators;

public class UploadFileFormValidatorTests
{
    private readonly UploadFileFormValidator _validator = new();

    [Fact]
    public void Should_HaveError_WhenFileSizeExceeds10Mb()
    {
        // Создаём массив байтов размером 11 MB
        var content = new byte[11 * 1024 * 1024];
        using var stream = new MemoryStream(content);
        var file = new FormFile(stream, 0, content.Length, "file", "test.jpg")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/jpeg"
        };
        var model = new UploadFileForm { File = file };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.File);
    }

    // Остальные тесты без изменений
    [Fact]
    public void Should_HaveError_WhenFileIsNull()
    {
        var model = new UploadFileForm { File = null! };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.File);
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("application/pdf")]
    public void Should_NotHaveError_WhenContentTypeIsAllowed(string contentType)
    {
        var content = new byte[1024];
        using var stream = new MemoryStream(content);
        var file = new FormFile(stream, 0, content.Length, "file", "test.jpg")
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
        var model = new UploadFileForm { File = file };
        var result = _validator.TestValidate(model);
        result.ShouldNotHaveValidationErrorFor(x => x.File);
    }

    [Fact]
    public void Should_HaveError_WhenContentTypeIsNotAllowed()
    {
        var content = new byte[1024];
        using var stream = new MemoryStream(content);
        var file = new FormFile(stream, 0, content.Length, "file", "test.exe")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/octet-stream"
        };
        var model = new UploadFileForm { File = file };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.File);
    }
}