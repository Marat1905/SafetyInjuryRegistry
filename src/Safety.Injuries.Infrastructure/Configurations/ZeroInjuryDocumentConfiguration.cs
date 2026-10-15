using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Infrastructure.Configurations;

/// <summary>
/// Конфигурация таблицы и отображения для сущности <see cref="ZeroInjuryDocument"/> в базе данных.
/// </summary>
public class ZeroInjuryDocumentConfiguration : IEntityTypeConfiguration<ZeroInjuryDocument>
{
    public void Configure(EntityTypeBuilder<ZeroInjuryDocument> builder)
    {
        // Устанавливаем имя таблицы
        builder.ToTable("ZeroInjuryDocuments");

        // Первичный ключ
        builder.HasKey(d => d.Id);

        // Настройка поля FileName
        builder.Property(d => d.FileName)
            .IsRequired()
            .HasMaxLength(255);

        // Настройка поля ContentType (MIME-тип)
        builder.Property(d => d.ContentType)
            .IsRequired()
            .HasMaxLength(100);

        // Размер файла – обязательно
        builder.Property(d => d.Size)
            .IsRequired();

        // Бинарные данные документа – обязательно
        builder.Property(d => d.Data)
            .IsRequired();

        // Описание документа – необязательное, но с ограничением длины
        builder.Property(d => d.Description)
            .HasMaxLength(500);

        // Тип документа – обязательно, максимум 50 символов
        builder.Property(d => d.DocumentType)
            .IsRequired()
            .HasMaxLength(50);

        // Индекс для быстрого поиска документов по ProgramId
        builder.HasIndex(d => d.ProgramId);
    }
}