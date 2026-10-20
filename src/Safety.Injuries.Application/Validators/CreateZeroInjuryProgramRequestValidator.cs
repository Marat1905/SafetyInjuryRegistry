using FluentValidation;
using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Validators;

/// <summary>
/// Валидатор запроса на создание программы «Ноль травм».
/// </summary>
public class CreateZeroInjuryProgramRequestValidator : AbstractValidator<CreateZeroInjuryProgramRequest>
{
    public CreateZeroInjuryProgramRequestValidator()
    {
        RuleFor(x => x.StartDate)
            .NotEmpty().WithMessage("Дата начала обязательна")
            .Must(BeValidDate).WithMessage("Некорректный формат даты. Используйте YYYY-MM-DD")
            .Must(BeNotFutureDate).WithMessage("Дата начала не может быть в будущем");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Описание / основание обязательно")
            .MaximumLength(1000).WithMessage("Описание не должно превышать 1000 символов");

        RuleFor(x => x.TargetDays)
            .GreaterThan(0).WithMessage("Целевой период должен быть положительным числом дней")
            .LessThanOrEqualTo(3650).WithMessage("Целевой период не должен превышать 3650 дней");
    }

    private static bool BeValidDate(string date) => DateTime.TryParse(date, out _);

    private static bool BeNotFutureDate(string date)
    {
        if (!DateTime.TryParse(date, out var parsedDate))
            return false;

        return parsedDate.Date <= DateTime.UtcNow.Date;
    }
}