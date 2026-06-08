using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Infrastructure.Configurations;

/// <summary>
/// Конфигурация таблицы и отображения для сущности <see cref="Injury"/> в базе данных.
/// Задаёт имя таблицы, первичный ключ, ограничения на поля, преобразование перечислений и связи.
/// </summary>
public class InjuryConfiguration : IEntityTypeConfiguration<Injury>
{
    /// <summary>
    /// Настраивает отображение сущности <see cref="Injury"/>.
    /// </summary>
    /// <param name="builder">Построитель конфигурации для сущности.</param>
    public void Configure(EntityTypeBuilder<Injury> builder)
    {
        // Устанавливаем имя таблицы в базе данных
        builder.ToTable("Injuries");

        // Настройка первичного ключа
        builder.HasKey(i => i.Id);

        // Конфигурация свойства Type
        builder.Property(i => i.Type)
            .IsRequired()                     // Поле обязательное
            .HasMaxLength(200);               // Максимальная длина строки

        // Конфигурация свойства Description
        builder.Property(i => i.Description)
            .IsRequired()
            .HasMaxLength(1000);

        // Конфигурация свойства Date – обязательно
        builder.Property(i => i.Date)
            .IsRequired();

        // Настройка свойства Category – храним как строку (значение enum)
        builder.Property(i => i.Category)
            .IsRequired()
            .HasConversion<string>()          // Преобразует enum в строку и обратно
            .HasMaxLength(50);                // Достаточная длина для названия enum

        // Настройка связи один-ко-многим с сущностью InjuryFile
        builder.HasMany(i => i.Files)
            .WithOne(f => f.Injury)           // У InjuryFile есть навигационное свойство Injury
            .HasForeignKey(f => f.InjuryId)   // Внешний ключ в таблице InjuryFiles
            .OnDelete(DeleteBehavior.Cascade); // При удалении травмы все файлы удаляются каскадно
    }
}