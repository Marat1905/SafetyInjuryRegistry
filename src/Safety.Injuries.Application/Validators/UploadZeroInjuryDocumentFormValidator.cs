using FluentValidation;
using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Validators;

/// <summary>
/// Валидатор для загрузки документа программы «Ноль травм».
/// </summary>
public class UploadZeroInjuryDocumentFormValidator : AbstractValidator<UploadZeroInjuryDocumentForm>
{
    /// <summary>Допустимые MIME-типы документов (расширены относительно файлов травм).</summary>
    private static readonly string[] AllowedContentTypes = new[]
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };

    /// <summary>Максимальный размер документа: 20 MB.</summary>
    private const long MaxFileSize = 20 * 1024 * 1024;

    /// <summary>Допустимые типы документов.</summary>
    private static readonly string[] AllowedDocumentTypes = new[]
    {
        "Order", "Act", "Report", "Other"
    };

    public UploadZeroInjuryDocumentFormValidator()
    {
        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Описание не должно превышать 500 символов");

        RuleFor(x => x.DocumentType)
            .NotEmpty().WithMessage("Тип документа обязателен")
            .Must(t => AllowedDocumentTypes.Contains(t))
            .WithMessage($"Недопустимый тип документа. Разрешены: {string.Join(", ", AllowedDocumentTypes)}");

        RuleFor(x => x.File)
            .NotNull().WithMessage("Файл обязателен")
            .Must(file => file != null && file.Length > 0).WithMessage("Файл не выбран или пуст");

        RuleFor(x => x.File)
            .Must(file => file == null || file.Length <= MaxFileSize)
            .WithMessage($"Размер файла не должен превышать {MaxFileSize / 1024 / 1024} MB");

        RuleFor(x => x.File)
            .Must(file => file == null || AllowedContentTypes.Contains(file.ContentType.ToLowerInvariant()))
            .WithMessage($"Неподдерживаемый тип файла. Разрешены: {string.Join(", ", AllowedContentTypes)}");
    }
}