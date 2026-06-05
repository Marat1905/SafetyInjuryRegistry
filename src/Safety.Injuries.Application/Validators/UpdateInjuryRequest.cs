using FluentValidation;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Domain.Enums;

namespace Safety.Injuries.Application.Validators;

public class UpdateInjuryRequestValidator : AbstractValidator<UpdateInjuryRequest>
{
    public UpdateInjuryRequestValidator()
    {
        // Если поле Type передано (не null), оно не должно быть пустым и должно укладываться в лимит длины
        When(x => x.Type != null, () =>
        {
            RuleFor(x => x.Type)
                .NotEmpty().WithMessage("Тип не может быть пустым")
                .MaximumLength(200).WithMessage("Тип не должен превышать 200 символов");
        });

        // Если поле Description передано, оно не должно быть пустым
        When(x => x.Description != null, () =>
        {
            RuleFor(x => x.Description)
                .NotEmpty().WithMessage("Описание не может быть пустым")
                .MaximumLength(1000).WithMessage("Описание не должно превышать 1000 символов");
        });

        // Если категория передана, она должна быть допустимой
        When(x => x.Category != null, () =>
        {
            RuleFor(x => x.Category)
                .Must(BeValidCategory).WithMessage("Недопустимая категория. Допустимые значения: П1,П2,П3,П4,П5,П6 или Fatality,LostWorkdayCase,FirstAidCase,AccidentOrNearMiss,PreventedIncident,ThirdPartyInjury");
        });
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