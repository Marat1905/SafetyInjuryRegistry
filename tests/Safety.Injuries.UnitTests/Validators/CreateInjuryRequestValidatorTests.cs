using FluentValidation.TestHelper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Validators;
using Xunit;

namespace Safety.Injuries.UnitTests.Validators;

public class CreateInjuryRequestValidatorTests
{
    private readonly CreateInjuryRequestValidator _validator = new();

    [Fact]
    public void Should_HaveError_WhenDateIsEmpty()
    {
        var model = new CreateInjuryRequest { Date = "" };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.Date);
    }

    [Fact]
    public void Should_HaveError_WhenDateIsFuture()
    {
        var model = new CreateInjuryRequest { Date = DateTime.UtcNow.AddDays(1).ToString("yyyy-MM-dd") };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.Date);
    }

    [Fact]
    public void Should_HaveError_WhenTypeExceedsMaxLength()
    {
        var model = new CreateInjuryRequest { Type = new string('A', 201) };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.Type);
    }

    [Theory]
    [InlineData("Fatality")]
    [InlineData("П1")]
    [InlineData("LostWorkdayCase")]
    [InlineData("П2")]
    public void Should_NotHaveError_WhenCategoryIsValid(string category)
    {
        var model = new CreateInjuryRequest { Category = category };
        var result = _validator.TestValidate(model);
        result.ShouldNotHaveValidationErrorFor(x => x.Category);
    }

    [Fact]
    public void Should_HaveError_WhenCategoryIsInvalid()
    {
        var model = new CreateInjuryRequest { Category = "Invalid" };
        var result = _validator.TestValidate(model);
        result.ShouldHaveValidationErrorFor(x => x.Category);
    }
}