using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Infrastructure.Configurations;

/// <summary>
/// Конфигурация таблицы и отображения для сущности <see cref="InjuryFile"/> в базе данных.
/// Задаёт имя таблицы, первичный ключ, обязательность и длину полей, а также индексы.
/// </summary>
public class InjuryFileConfiguration : IEntityTypeConfiguration<InjuryFile>
{
    /// <summary>
    /// Настраивает отображение сущности <see cref="InjuryFile"/>.
    /// </summary>
    /// <param name="builder">Построитель конфигурации для сущности.</param>
    public void Configure(EntityTypeBuilder<InjuryFile> builder)
    {
        // Устанавливаем имя таблицы
        builder.ToTable("InjuryFiles");

        // Первичный ключ
        builder.HasKey(f => f.Id);

        // Настройка поля FileName
        builder.Property(f => f.FileName)
            .IsRequired()
            .HasMaxLength(255);                // Ограничение длины имени файла

        // Настройка поля ContentType (MIME-тип)
        builder.Property(f => f.ContentType)
            .IsRequired()
            .HasMaxLength(100);                // Например, "application/pdf" – достаточно 100 символов

        // Размер файла – обязательно
        builder.Property(f => f.Size)
            .IsRequired();

        // Бинарные данные файла – обязательно
        builder.Property(f => f.Data)
            .IsRequired();

        // Описание файла – необязательное, но с ограничением длины
        builder.Property(f => f.Description)
            .HasMaxLength(500);                // Максимум 500 символов

        // Индекс для быстрого поиска файлов по InjuryId
        // Ускоряет запросы GetByInjuryIdAsync и каскадное удаление
        builder.HasIndex(f => f.InjuryId);
    }
}