using FluentValidation;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Domain.Enums;

namespace Safety.Injuries.Application.Validators;

public class CreateInjuryRequestValidator : AbstractValidator<CreateInjuryRequest>
{
    public CreateInjuryRequestValidator()
    {
        RuleFor(x => x.Date)
            .NotEmpty().WithMessage("Дата обязательна")
            .Must(BeValidDate).WithMessage("Некорректный формат даты. Используйте YYYY-MM-DD")
            .Must(BeNotFutureDate).WithMessage("Дата не может быть в будущем");

        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("Тип травмы обязателен")
            .MaximumLength(200).WithMessage("Тип не должен превышать 200 символов");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Описание обязательно")
            .MaximumLength(1000).WithMessage("Описание не должно превышать 1000 символов");

        RuleFor(x => x.Category)
            .NotEmpty().WithMessage("Категория обязательна")
            .Must(BeValidCategory).WithMessage("Недопустимая категория. Допустимые значения: П1,П2,П3,П4,П5,П6 или Fatality,LostWorkdayCase,FirstAidCase,AccidentOrNearMiss,PreventedIncident,ThirdPartyInjury");
    }

    private static bool BeValidDate(string date) => DateTime.TryParse(date, out _);

    private static bool BeNotFutureDate(string date)
    {
        if (!DateTime.TryParse(date, out var parsedDate))
            return false; // формат уже проверяется в BeValidDate, но на всякий случай

        // Сравниваем только дату (без времени) в UTC
        return parsedDate.Date <= DateTime.UtcNow.Date;
    }

    private static bool BeValidCategory(string category)
    {
        if (string.IsNullOrWhiteSpace(category))
            return false;

        if (Enum.TryParse<InjuryCategory>(category, true, out _))
            return true;

        return category.ToUpper() switch
        {
            "П1" or "П2" or "П3" or "П4" or "П5" or "П6" => true,
            _ => false
        };
    }
}