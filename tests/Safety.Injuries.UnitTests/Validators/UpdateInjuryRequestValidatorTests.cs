using FluentValidation.TestHelper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Validators;
using Xunit;

namespace Safety.Injuries.UnitTests.Validators;

public class UpdateInjuryRequestValidatorTests
{
    private readonly UpdateInjuryRequestValidator _validator = new();

    [Fact]
    public void Should_Validate_WhenTypeIsProvided_AndIsNotEmpty()
    {
        var model = new UpdateInjuryRequest { Type = "" };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Should_NotValidateType_WhenTypeIsNull()
    {
        var model = new UpdateInjuryRequest { Type = null };
        var result = _validator.TestValidate(model);
        result.ShouldNotHaveValidationErrorFor(x => x.Type);
    }

    [Fact]
    public void Should_HaveError_WhenDescriptionIsProvidedButEmpty()
    {
        var model = new UpdateInjuryRequest { Description = "" };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void Should_HaveError_WhenCategoryIsInvalid()
    {
        var model = new UpdateInjuryRequest { Category = "InvalidCat" };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.Category);
    }
}