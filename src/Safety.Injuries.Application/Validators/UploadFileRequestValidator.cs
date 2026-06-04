using FluentValidation;
using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Validators;

public class UploadFileRequestValidator : AbstractValidator<UploadFileRequest>
{
    public UploadFileRequestValidator()
    {
        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Описание не должно превышать 500 символов");
    }
}