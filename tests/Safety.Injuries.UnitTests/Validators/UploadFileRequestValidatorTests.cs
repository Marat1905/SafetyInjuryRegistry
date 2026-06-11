using FluentValidation.TestHelper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Validators;
using Xunit;

namespace Safety.Injuries.UnitTests.Validators;

public class UploadFileRequestValidatorTests
{
    private readonly UploadFileRequestValidator _validator = new();

    [Fact]
    public void Should_NotHaveError_WhenDescriptionIsNull()
    {
        var model = new UploadFileRequest { Description = null };
        var result = _validator.TestValidate(model);
        result.ShouldNotHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void Should_NotHaveError_WhenDescriptionIsValidLength()
    {
        var model = new UploadFileRequest { Description = new string('A', 500) };
        var result = _validator.TestValidate(model);
        result.ShouldNotHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void Should_HaveError_WhenDescriptionExceedsMaxLength()
    {
        var model = new UploadFileRequest { Description = new string('A', 501) };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.Description);
    }
}