using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Infrastructure.Configurations;

/// <summary>
/// Конфигурация таблицы и отображения для сущности <see cref="Injury"/> в базе данных.
/// Задаёт имя таблицы, первичный ключ, ограничения на поля, преобразование перечислений,
/// токен конкурентности на основе <c>xmin</c> и связи.
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

        // ------------------------------------------------------------------
        // Токен конкурентности на основе системной колонки PostgreSQL xmin.
        //
        // PostgreSQL автоматически ведёт для каждой строки невидимую колонку
        // xmin, в которой хранится идентификатор транзакции, создавшей текущую
        // версию строки. При любом UPDATE значение xmin меняется.
        //
        // EF Core использует xmin как «версию строки»:
        //   • при чтении (SELECT) подтягивает текущее значение в свойство RowVersion;
        //   • при обновлении/удалении добавляет в SQL условие
        //       WHERE xmin = @original_rowversion;
        //   • если 0 строк попали под условие (значит, кто-то успел изменить
        //     строку между чтением и записью) — выбрасывает
        //     DbUpdateConcurrencyException.
        //
        // Настройка .HasColumnName("xmin") — мапим C#-свойство RowVersion на
        // системный столбец xmin. Без этого маппинга EF считал бы, что нужно
        // создать собственный столбец rowversion, что неверно.
        //
        // Настройка .HasColumnType("xid") — сообщаем Npgsql, что тип столбца — xid
        // (внутренний PostgreSQL-тип, соответствующий uint в C#).
        //
        // Настройка .ValueGeneratedOnAddOrUpdate() — свойство управляется хранилищем:
        // EF не отправляет его в INSERT, но подхватывает после INSERT/UPDATE.
        //
        // Настройка .IsConcurrencyToken() — помечает свойство как токен конкурентности.
        //
        // Преимущества использования xmin вместо отдельного столбца rowversion:
        //   • не нужно добавлять новый столбец и индекс — xmin уже есть;
        //   • нулевые накладные расходы по диску и памяти;
        //   • полностью поддерживается Npgsql «из коробки».
        // ------------------------------------------------------------------
        builder.Property(i => i.RowVersion)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        // Индекс по дате — используется в фильтрации по месяцам и годам
        // (GetByMonthAsync, GetByYearAsync, GetLatestAsync).
        builder.HasIndex(i => i.Date);

        // Индекс по категории — используется в статистике (CountAsync по П1/П2)
        // и в GetLatestByCategoriesAsync.
        builder.HasIndex(i => i.Category);

        // Настройка связи один-ко-многим с сущностью InjuryFile
        builder.HasMany(i => i.Files)
            .WithOne(f => f.Injury)           // У InjuryFile есть навигационное свойство Injury
            .HasForeignKey(f => f.InjuryId)   // Внешний ключ в таблице InjuryFiles
            .OnDelete(DeleteBehavior.Cascade); // При удалении травмы все файлы удаляются каскадно
    }
}