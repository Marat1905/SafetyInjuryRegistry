using FluentValidation;
using Safety.Injuries.Application.DTOs;

namespace Safety.Injuries.Application.Validators;

/// <summary>
/// Валидатор для модели загрузки файла (UploadFileForm)
/// </summary>
public class UploadFileFormValidator : AbstractValidator<UploadFileForm>
{
    // Допустимые MIME-типы файлов
    private static readonly string[] AllowedContentTypes = new[]
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/pdf"
    };

    // Максимальный размер файла: 10 MB
    private const long MaxFileSize = 10 * 1024 * 1024;

    public UploadFileFormValidator()
    {
        // Валидация описания (необязательное поле, но если указано, ограничиваем длину)
        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Описание не должно превышать 500 символов");

        // Валидация файла: не null
        RuleFor(x => x.File)
            .NotNull().WithMessage("Файл обязателен")
            .Must(file => file != null && file.Length > 0).WithMessage("Файл не выбран или пуст");

        // Валидация размера файла
        RuleFor(x => x.File)
            .Must(file => file == null || file.Length <= MaxFileSize)
            .WithMessage($"Размер файла не должен превышать {MaxFileSize / 1024 / 1024} MB");

        // Валидация MIME-типа (ContentType) – только если файл предоставлен
        RuleFor(x => x.File)
            .Must(file => file == null || AllowedContentTypes.Contains(file.ContentType.ToLowerInvariant()))
            .WithMessage($"Неподдерживаемый тип файла. Разрешены: {string.Join(", ", AllowedContentTypes)}");
    }
}