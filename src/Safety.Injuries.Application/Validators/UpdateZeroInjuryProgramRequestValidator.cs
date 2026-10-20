using FluentValidation;
using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Validators;

/// <summary>
/// Валидатор запроса на обновление программы «Ноль травм».
/// Все поля опциональны; проверяются только переданные.
/// </summary>
public class UpdateZeroInjuryProgramRequestValidator : AbstractValidator<UpdateZeroInjuryProgramRequest>
{
    public UpdateZeroInjuryProgramRequestValidator()
    {
        When(x => !string.IsNullOrWhiteSpace(x.StartDate), () =>
        {
            RuleFor(x => x.StartDate!)
                .Must(BeValidDate).WithMessage("Некорректный формат даты. Используйте YYYY-MM-DD")
                .Must(BeNotFutureDate).WithMessage("Дата начала не может быть в будущем");
        });

        When(x => !string.IsNullOrWhiteSpace(x.Description), () =>
        {
            RuleFor(x => x.Description!)
                .MaximumLength(1000).WithMessage("Описание не должно превышать 1000 символов");
        });

        When(x => x.TargetDays.HasValue, () =>
        {
            RuleFor(x => x.TargetDays!.Value)
                .GreaterThan(0).WithMessage("Целевой период должен быть положительным числом дней")
                .LessThanOrEqualTo(3650).WithMessage("Целевой период не должен превышать 3650 дней");
        });
    }

    private static bool BeValidDate(string date) => DateTime.TryParse(date, out _);

    private static bool BeNotFutureDate(string date)
    {
        if (!DateTime.TryParse(date, out var parsedDate))
            return false;

        return parsedDate.Date <= DateTime.UtcNow.Date;
    }
}